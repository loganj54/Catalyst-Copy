// ============================================================================
// SEARCH RESOURCES EDGE FUNCTION
// ============================================================================
// Step 3 of the Pipeline: Finds educational resources for learning topics
// using a cache-first approach with vector similarity, falling back to
// Claude's web search tool for new discoveries.
//
// FLOW:
// 1. Receive topic + search queries from blueprint
// 2. Generate embedding for the topic
// 3. Search curated_resources for similar resources (>95% similarity)
// 4. If cache hit: return cached resources
// 5. If cache miss: use Claude web search to find new videos
// 6. Store new resources with embeddings for future reuse
//
// INPUT: { blueprint_id, unit_id, topic, description, search_queries[] }
// OUTPUT: Array of educational resources (videos, articles, etc.)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  createSupabaseClient, 
  createSupabaseClientWithAuth,
} from '../_shared/supabase-client.ts';
import { 
  generateEmbedding, 
  createTopicEmbeddingText,
  createRichSignatureText,
  createNeedEmbeddingText,
  formatVectorForPostgres,
} from '../_shared/embeddings.ts';
import { 
  fetchTranscript, 
  extractVideoId,
  truncateTranscript,
} from '../_shared/transcript.ts';
import { 
  analyzeTranscript, 
  analyzeMetadata,
  generateRichSignature,
  type ContentAnalysis,
} from '../_shared/content-analyzer.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
const CLAUDE_MODEL = 'claude-haiku-4-5';
const SIMILARITY_THRESHOLD = 0.95; // 95% similarity required for cache hit
const MAX_CACHED_RESULTS = 3;
const MAX_SEARCH_RESULTS = 3;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SearchRequest {
  blueprint_id: string;
  unit_id: string;
  topic: string;
  description?: string;
  learning_objective?: string;
  search_queries: Array<{
    query: string;
    query_type: string;
    priority: number;
  }>;
}

interface ResourceResult {
  id?: string;
  url: string;
  title: string;
  description: string;
  platform: string;
  channel_name?: string;
  channel_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  topic_signature: string;
  concepts_covered: string[];
  difficulty_level: string;
  quality_score: number;
  similarity?: number;
  from_cache: boolean;
  query_type?: string;
  query_used?: string; // The search query that found this resource
  // New fields for transcript analysis
  transcript_analyzed?: boolean;
  transcript_source?: 'auto_generated' | 'manual' | 'metadata_only' | 'failed' | 'none';
  content_analysis?: ContentAnalysis;
  analysis_confidence?: number;
}

// ============================================================================
// YOUTUBE DATA API SEARCH
// ============================================================================

// Return type for YouTube search including metadata
interface YouTubeSearchResult {
  resources: ResourceResult[];
  searchMetadata: {
    queries_used: string[];
    search_method: 'youtube_api' | 'claude_web_search' | 'cache';
    total_api_results: number;
  };
}

/**
 * Search YouTube directly using the YouTube Data API v3
 * This is much more reliable than Claude's web search for finding videos
 */
async function searchYouTube(
  topic: string,
  searchQueries: Array<{ query: string; query_type: string; priority: number }>
): Promise<YouTubeSearchResult> {
  if (!YOUTUBE_API_KEY) {
    console.log('[search-resources] No YouTube API key, falling back to Claude web search');
    return { 
      resources: [], 
      searchMetadata: { 
        queries_used: [], 
        search_method: 'youtube_api',
        total_api_results: 0 
      } 
    };
  }

  const results: ResourceResult[] = [];
  const seenVideoIds = new Set<string>();
  const queriesActuallyUsed: string[] = [];
  let totalApiResults = 0;

  // Use the topic as main query, plus top priority queries
  const queriesToTry = [
    `${topic} tutorial`,
    `${topic} explained`,
    ...(searchQueries?.slice(0, 2).map(q => q.query) || [])
  ];

  console.log('[search-resources] Searching YouTube with queries:', queriesToTry);

  for (const query of queriesToTry) {
    if (results.length >= MAX_SEARCH_RESULTS) break;

    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('maxResults', '5');
      searchUrl.searchParams.set('relevanceLanguage', 'en');
      searchUrl.searchParams.set('safeSearch', 'strict');
      searchUrl.searchParams.set('videoCategoryId', '27'); // Education category
      searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

      console.log(`[search-resources] YouTube search: "${query}"`);
      queriesActuallyUsed.push(query);
      
      const response = await fetch(searchUrl.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[search-resources] YouTube API error:', response.status, errorText);
        continue;
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        console.log(`[search-resources] Found ${data.items.length} YouTube results for "${query}"`);
        totalApiResults += data.items.length;
        
        for (const item of data.items) {
          if (results.length >= MAX_SEARCH_RESULTS) break;
          
          const videoId = item.id?.videoId;
          if (!videoId || seenVideoIds.has(videoId)) continue;
          
          seenVideoIds.add(videoId);
          
          const snippet = item.snippet || {};
          
          results.push({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: snippet.title || 'YouTube Video',
            description: snippet.description?.substring(0, 500) || '',
            platform: 'YouTube',
            channel_name: snippet.channelTitle || null,
            channel_url: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : null,
            thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            duration_seconds: null, // Would need another API call to get this
            topic_signature: `Educational video about ${topic}: ${snippet.title}. ${snippet.description?.substring(0, 200) || ''}`,
            concepts_covered: [topic],
            difficulty_level: 'intermediate',
            quality_score: 0.8,
            from_cache: false,
            query_used: query, // Track which query found this video
          });
          
          console.log(`[search-resources] Added video: ${snippet.title}`);
        }
      } else {
        console.log(`[search-resources] No YouTube results for "${query}"`);
      }
    } catch (error) {
      console.error(`[search-resources] Error searching YouTube for "${query}":`, error);
    }
  }

  console.log(`[search-resources] YouTube search complete, found ${results.length} videos`);
  return {
    resources: results,
    searchMetadata: {
      queries_used: queriesActuallyUsed,
      search_method: 'youtube_api',
      total_api_results: totalApiResults,
    }
  };
}

// ============================================================================
// CLAUDE WEB SEARCH WITH TOOL USE (FALLBACK)
// ============================================================================

/**
 * Call Claude with web search tool to find educational videos
 * This is used as a fallback when YouTube API is not available
 */
async function searchWithClaude(
  topic: string,
  description: string,
  searchQueries: Array<{ query: string; query_type: string; priority: number }>
): Promise<ResourceResult[]> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  // Combine queries into a search request
  const queryStrings = searchQueries
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3) // Use top 3 priority queries
    .map(q => q.query);

  const systemPrompt = `You are an expert educational content curator who finds YouTube videos.

CRITICAL RULES:
1. YOUTUBE VIDEOS ONLY - Every URL must be from youtube.com or youtu.be
2. NO Wikipedia, blog posts, or articles - ONLY video content
3. If a search returns no results, TRY SIMPLER/BROADER search terms

SEARCH STRATEGY - START BROAD, THEN NARROW:
- First try: "[main topic] youtube tutorial" or "[main topic] youtube explained"
- If no results: simplify! Remove technical jargon, use common terms
- For physics: try "blackbody radiation explained" not "Planck distribution function numerical integration"
- For math: try "calculus derivatives tutorial" not "differentiation of polynomial functions step by step"
- IMPORTANT: If "site:youtube.com" returns nothing, search WITHOUT it - YouTube results will still appear

FALLBACK SEARCHES (if initial searches fail):
- Try just the core concept: "Planck's law explained"
- Try related broader topics: "thermal radiation physics"
- Try popular educational channels + topic: "Physics blackbody radiation"

SELECTION CRITERIA:
- Clear explanations and good production quality
- Relevant to the topic (even if not perfectly specific)
- Any YouTube channel is fine - prioritize quality over channel fame

For each video, generate a topic_signature (2-3 sentences) describing what it teaches.`;

  // Extract simpler search terms from the topic
  const simplifiedTopic = topic
    .replace(/and\s+/gi, '') // Remove "and"
    .replace(/calculations?/gi, '') // Remove "calculations"
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  const userPrompt = `Find ${MAX_SEARCH_RESULTS} YouTube videos for this educational topic:

TOPIC: ${topic}
${description ? `CONTEXT: ${description}` : ''}

SEARCH APPROACH - CRITICAL FOR SUCCESS:
1. START with simple, broad searches - complex queries often return nothing!
2. Try these search patterns IN ORDER until you find results:
   - "${simplifiedTopic} tutorial"
   - "${simplifiedTopic} explained" 
   - "${topic.split(' ')[0]} ${topic.split(' ')[1] || ''} youtube" (just first 2 words)
   - Related broader topic if specific searches fail

3. If a search returns EMPTY results, immediately try a SIMPLER search
4. DO NOT keep trying variations of the same complex query

EXAMPLE: For "Planck's Distribution and Spectral Radiance Calculations":
- DON'T search: "Planck distribution function numerical integration wavelength band"
- DO search: "Planck's law explained" or "blackbody radiation tutorial"

REQUIREMENTS:
- Return ONLY youtube.com or youtu.be URLs
- Find ${MAX_SEARCH_RESULTS} different videos covering different aspects if possible
- It's better to return 3 somewhat-related videos than 0 perfectly-specific ones

After finding videos, output them in this JSON format:

\`\`\`json
[
  {
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "title": "Exact Video Title",
    "description": "What this video covers",
    "platform": "YouTube",
    "channel_name": "Channel Name",
    "topic_signature": "2-3 sentences describing what concepts this video teaches and what problems it helps solve",
    "concepts_covered": ["concept1", "concept2"],
    "difficulty_level": "beginner|intermediate|advanced",
    "quality_score": 0.8
  }
]
\`\`\`

If you cannot find ANY YouTube videos after multiple search attempts, explain what you tried and suggest alternative search terms the user could try manually.`;

  console.log('[search-resources] Calling Claude with web search...');
  console.log(`  - Topic: ${topic}`);
  console.log(`  - Queries: ${queryStrings.join(' | ')}`);

  // Call Claude with web search tool enabled
  // Using the correct tool type identifier for the web search beta
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        }
      ],
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[search-resources] Claude API error:', response.status, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[search-resources] Claude response received');
  console.log('[search-resources] Full response structure:', JSON.stringify(data, null, 2).substring(0, 3000));
  console.log('[search-resources] Response content types:', data.content?.map((b: any) => b.type).join(', '));
  console.log('[search-resources] Number of content blocks:', data.content?.length || 0);

  // Log each content block type and structure
  for (let i = 0; i < (data.content?.length || 0); i++) {
    const block = data.content[i];
    console.log(`[search-resources] Block ${i}: type=${block.type}, keys=${Object.keys(block).join(',')}`);
    if (block.type === 'web_search_tool_result' || block.type === 'tool_result') {
      console.log(`[search-resources] Block ${i} content:`, JSON.stringify(block).substring(0, 1000));
    }
  }

  // With web search, Claude returns multiple content blocks:
  // - text blocks with explanations
  // - web_search_tool_result blocks with search results
  // We need to extract URLs from the web search results and any JSON from text blocks

  const results: ResourceResult[] = [];
  
  // First, try to extract from web_search_tool_result blocks
  const webSearchResults = data.content?.filter((block: any) => 
    block.type === 'web_search_tool_result' || 
    block.type === 'tool_result' ||
    block.type === 'tool_use'
  );
  
  if (webSearchResults && webSearchResults.length > 0) {
    console.log('[search-resources] Found web search result blocks:', webSearchResults.length);
    
    for (const searchResult of webSearchResults) {
      // Handle different possible structures
      const searchContent = searchResult.content || searchResult.search_results || [];
      
      if (Array.isArray(searchContent)) {
        for (const item of searchContent) {
          if (item.url) {
            results.push({
              url: item.url,
              title: item.title || 'Educational Resource',
              description: item.snippet || item.description || '',
              platform: detectPlatform(item.url),
              channel_name: extractChannelFromUrl(item.url),
              channel_url: null,
              thumbnail_url: item.thumbnail || generateYouTubeThumbnail(item.url),
              duration_seconds: null,
              topic_signature: `Educational resource about ${topic}: ${item.title || ''} - ${item.snippet || item.description || ''}`,
              concepts_covered: [topic],
              difficulty_level: 'intermediate',
              quality_score: 0.7,
              from_cache: false,
            });
          }
        }
      }
    }
  }

  // Also check text blocks for any JSON arrays with resources
  const textBlocks = data.content?.filter((block: any) => block.type === 'text') || [];
  
  for (const textBlock of textBlocks) {
    let text = textBlock.text || '';
    console.log('[search-resources] Processing text block, length:', text.length);
    
    // Try to extract JSON from code blocks first (```json ... ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
      console.log('[search-resources] Found JSON code block, extracted length:', text.length);
    }
    
    // Try to find JSON array in the text
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      console.log('[search-resources] Found JSON array match, length:', jsonMatch[0].length);
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[search-resources] Successfully parsed JSON, items:', parsed.length);
        if (Array.isArray(parsed)) {
          for (const r of parsed) {
            if (r.url) {
              console.log('[search-resources] Adding resource from JSON:', r.url);
              results.push({
                url: r.url || r.video_url || '',
                title: r.title || r.video_title || 'Untitled',
                description: r.description || r.summary || '',
                platform: r.platform || detectPlatform(r.url || ''),
                channel_name: r.channel_name || r.channel || r.creator || null,
                channel_url: r.channel_url || null,
                thumbnail_url: r.thumbnail_url || r.thumbnail || generateYouTubeThumbnail(r.url),
                duration_seconds: r.duration_seconds || r.duration || null,
                topic_signature: r.topic_signature || r.signature || `Educational resource about ${topic}`,
                concepts_covered: Array.isArray(r.concepts_covered) 
                  ? r.concepts_covered 
                  : (r.concepts ? r.concepts : [topic]),
                difficulty_level: r.difficulty_level || r.difficulty || 'intermediate',
                quality_score: typeof r.quality_score === 'number' 
                  ? r.quality_score 
                  : (typeof r.quality === 'number' ? r.quality : 0.7),
                from_cache: false,
              });
            }
          }
        }
      } catch (e) {
        // Not valid JSON, continue
        console.log('[search-resources] Failed to parse JSON:', e);
        console.log('[search-resources] JSON text (first 500 chars):', jsonMatch[0].substring(0, 500));
      }
    } else {
      console.log('[search-resources] No JSON array found in text block');
    }
    
    // Also try to extract URLs directly from text using regex
    const urlMatches = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s\)\"]+/g);
    if (urlMatches) {
      for (const url of urlMatches) {
        // Check if we already have this URL
        if (!results.find(r => r.url === url)) {
          results.push({
            url: url,
            title: 'YouTube Video',
            description: `Educational video about ${topic}`,
            platform: 'YouTube',
            channel_name: null,
            channel_url: null,
            thumbnail_url: generateYouTubeThumbnail(url),
            duration_seconds: null,
            topic_signature: `Educational video resource about ${topic}`,
            concepts_covered: [topic],
            difficulty_level: 'intermediate',
            quality_score: 0.6,
            from_cache: false,
          });
        }
      }
    }
  }

  console.log('[search-resources] Extracted resources:', results.length);
  
  // Deduplicate by URL
  const uniqueResults = results.filter((r, idx) => 
    results.findIndex(x => x.url === r.url) === idx
  );

  return uniqueResults.slice(0, MAX_SEARCH_RESULTS);
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('khanacademy.org')) return 'Khan Academy';
  if (url.includes('mit.edu') || url.includes('ocw.mit.edu')) return 'MIT OCW';
  if (url.includes('coursera.org')) return 'Coursera';
  if (url.includes('edx.org')) return 'edX';
  return 'Web';
}

/**
 * Extract YouTube video ID and generate thumbnail URL
 */
function generateYouTubeThumbnail(url: string): string | null {
  if (!url) return null;
  
  // Match youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }
  return null;
}

/**
 * Try to extract channel name from URL patterns
 */
function extractChannelFromUrl(url: string): string | null {
  if (url.includes('khanacademy.org')) return 'Khan Academy';
  if (url.includes('3blue1brown')) return '3Blue1Brown';
  if (url.includes('organicchemistrytutor')) return 'The Organic Chemistry Tutor';
  if (url.includes('professorleonard')) return 'Professor Leonard';
  if (url.includes('mit.edu')) return 'MIT OpenCourseWare';
  return null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createSupabaseClient();

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const authClient = createSupabaseClientWithAuth(authHeader);
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Could not verify user');
    }

    const body: SearchRequest = await req.json();
    const { blueprint_id, unit_id, topic, description, search_queries } = body;

    console.log('[search-resources] Starting resource search');
    console.log(`  - Blueprint: ${blueprint_id}`);
    console.log(`  - Unit: ${unit_id}`);
    console.log(`  - Topic: ${topic}`);
    console.log(`  - Queries: ${search_queries?.length || 0}`);

    if (!blueprint_id || !unit_id || !topic) {
      throw new Error('Missing required fields: blueprint_id, unit_id, topic');
    }

    // =========================================================================
    // STEP 1: Generate embedding for the topic (using need-based format)
    // =========================================================================
    
    // Use the new need-based embedding text that matches against rich resource signatures
    const queryText = createNeedEmbeddingText(
      topic,
      description,
      body.learning_objective, // Optional learning objective from blueprint
      search_queries?.map(q => q.query)
    );
    
    console.log('[search-resources] Generating query embedding (need-based format)...');
    console.log(`  - Query text length: ${queryText.length} chars`);
    const { embedding: queryEmbedding } = await generateEmbedding(queryText);
    const vectorString = formatVectorForPostgres(queryEmbedding);

    // =========================================================================
    // STEP 2: Search for similar cached resources
    // =========================================================================
    
    console.log('[search-resources] Searching cache with vector similarity...');
    
    const { data: cachedResources, error: searchError } = await supabase.rpc(
      'search_similar_resources',
      {
        query_embedding: vectorString,
        similarity_threshold: SIMILARITY_THRESHOLD,
        max_results: MAX_CACHED_RESULTS,
      }
    );

    if (searchError) {
      console.error('[search-resources] Cache search error:', searchError);
      // Continue with web search if cache fails
    }

    let results: ResourceResult[] = [];
    let cacheHit = false;
    let searchMetadata: {
      queries_used: string[];
      search_method: 'youtube_api' | 'claude_web_search' | 'cache';
      total_api_results: number;
    } = {
      queries_used: [],
      search_method: 'cache',
      total_api_results: 0,
    };

    // =========================================================================
    // STEP 3: Check if we have enough cached results
    // =========================================================================
    
    if (cachedResources && cachedResources.length >= 1) {
      console.log(`[search-resources] Cache HIT! Found ${cachedResources.length} resources`);
      cacheHit = true;
      searchMetadata = {
        queries_used: ['(cached - no search needed)'],
        search_method: 'cache',
        total_api_results: cachedResources.length,
      };

      results = cachedResources.map((r: any) => ({
        id: r.id,
        url: r.url,
        title: r.title,
        description: r.description,
        platform: r.platform,
        channel_name: r.channel_name,
        thumbnail_url: r.thumbnail_url,
        duration_seconds: r.duration_seconds,
        topic_signature: r.topic_signature,
        concepts_covered: r.concepts_covered || [],
        difficulty_level: r.difficulty_level,
        quality_score: r.quality_score,
        similarity: r.similarity,
        from_cache: true,
      }));

      // Increment times_served for cached resources
      for (const resource of cachedResources) {
        await supabase
          .from('curated_resources')
          .update({ times_served: (resource.times_served || 0) + 1 })
          .eq('id', resource.id);
      }

    } else {
      // =========================================================================
      // STEP 4: Cache miss - search for videos
      // =========================================================================
      
      console.log('[search-resources] Cache MISS - searching for videos...');
      
      // Try YouTube API first (more reliable), then fall back to Claude web search
      let webResults: ResourceResult[] = [];
      
      if (YOUTUBE_API_KEY) {
        console.log('[search-resources] Using YouTube Data API...');
        const youtubeResult = await searchYouTube(topic, search_queries || []);
        webResults = youtubeResult.resources;
        searchMetadata = youtubeResult.searchMetadata;
      }
      
      // Fall back to Claude web search if YouTube didn't return results
      if (webResults.length === 0) {
        console.log('[search-resources] Falling back to Claude web search...');
        webResults = await searchWithClaude(
          topic,
          description || '',
          search_queries || []
        );
        searchMetadata = {
          queries_used: search_queries?.map(q => q.query) || [topic],
          search_method: 'claude_web_search',
          total_api_results: webResults.length,
        };
      }

      if (webResults.length === 0) {
        console.log('[search-resources] No results from any search method');
      } else {
        console.log(`[search-resources] Found ${webResults.length} resources`);

        // Process each resource: analyze transcript and store with rich embedding
        for (const resource of webResults) {
          try {
            // =========================================================
            // STEP 4a: Check if resource already exists and is analyzed
            // =========================================================
            const { data: existingResource } = await supabase
              .from('curated_resources')
              .select('id, transcript_analyzed, content_analysis, topic_signature, analysis_confidence')
              .eq('url', resource.url)
              .single();

            if (existingResource?.transcript_analyzed && existingResource?.content_analysis) {
              // Resource already analyzed - use cached data
              console.log(`[search-resources] Using cached analysis for: ${resource.title}`);
              resource.id = existingResource.id;
              resource.topic_signature = existingResource.topic_signature;
              resource.content_analysis = existingResource.content_analysis;
              resource.analysis_confidence = existingResource.analysis_confidence;
              resource.transcript_analyzed = true;
              
              // Update times_served
              await supabase
                .from('curated_resources')
                .update({ times_served: supabase.rpc('increment_times_served', { resource_id: existingResource.id }) })
                .eq('id', existingResource.id);
              
              results.push(resource);
              continue;
            }

            // =========================================================
            // STEP 4b: Fetch and analyze transcript (if not cached)
            // =========================================================
            console.log(`[search-resources] Analyzing new resource: ${resource.title}`);
            
            let transcriptText: string | null = null;
            let transcriptSource: 'auto_generated' | 'manual' | 'metadata_only' | 'failed' = 'failed';
            let contentAnalysis: ContentAnalysis | null = null;
            let analysisConfidence = 0;

            // Try to fetch transcript for YouTube videos
            if (resource.platform === 'YouTube') {
              const videoId = extractVideoId(resource.url);
              if (videoId) {
                console.log(`[search-resources] Fetching transcript for video: ${videoId}`);
                const transcriptResult = await fetchTranscript(videoId);
                
                if (transcriptResult.success && transcriptResult.transcript) {
                  transcriptText = truncateTranscript(transcriptResult.transcript, 15000);
                  transcriptSource = transcriptResult.source;
                  console.log(`[search-resources] Got transcript: ${transcriptResult.wordCount} words (${transcriptSource})`);
                  
                  // Analyze with GPT-5-nano
                  const analysisResult = await analyzeTranscript(transcriptText, {
                    title: resource.title,
                    description: resource.description,
                    channelName: resource.channel_name,
                    duration_seconds: resource.duration_seconds,
                  });
                  
                  if (analysisResult.success && analysisResult.analysis) {
                    contentAnalysis = analysisResult.analysis;
                    analysisConfidence = analysisResult.confidence;
                    console.log(`[search-resources] Transcript analysis complete: ${contentAnalysis.concepts_taught.length} concepts`);
                  }
                } else {
                  console.log(`[search-resources] No transcript available: ${transcriptResult.error}`);
                }
              }
            }

            // =========================================================
            // STEP 4c: Fallback to metadata-only analysis
            // =========================================================
            if (!contentAnalysis) {
              console.log(`[search-resources] Using metadata-only analysis for: ${resource.title}`);
              transcriptSource = 'metadata_only';
              
              const metadataResult = await analyzeMetadata({
                title: resource.title,
                description: resource.description,
                channelName: resource.channel_name,
                duration_seconds: resource.duration_seconds,
              });
              
              if (metadataResult.success && metadataResult.analysis) {
                contentAnalysis = metadataResult.analysis;
                analysisConfidence = metadataResult.confidence; // Lower confidence (0.5 or 0.2)
              }
            }

            // =========================================================
            // STEP 4d: Generate rich signature and embedding
            // =========================================================
            let richSignature = resource.topic_signature; // Fallback to original
            let resourceVector: string | null = null;

            if (contentAnalysis) {
              // Create rich signature from detailed analysis
              richSignature = generateRichSignature(contentAnalysis, {
                title: resource.title,
                channelName: resource.channel_name,
              });
              
              // Update resource with analysis data
              resource.topic_signature = richSignature;
              resource.content_analysis = contentAnalysis;
              resource.concepts_covered = contentAnalysis.concepts_taught;
              resource.difficulty_level = contentAnalysis.difficulty_assessment;
              
              console.log(`[search-resources] Generated rich signature (${richSignature.length} chars)`);
            }

            // Generate embedding from rich signature
            try {
              const { embedding: resourceEmbedding } = await generateEmbedding(richSignature);
              resourceVector = formatVectorForPostgres(resourceEmbedding);
            } catch (embedError) {
              console.error('[search-resources] Error generating embedding, will store without:', embedError);
            }

            // =========================================================
            // STEP 4e: Store resource with full analysis
            // =========================================================
            const upsertData: any = {
              url: resource.url,
              title: resource.title,
              description: resource.description,
              platform: resource.platform,
              channel_name: resource.channel_name,
              channel_url: resource.channel_url,
              thumbnail_url: resource.thumbnail_url,
              duration_seconds: resource.duration_seconds,
              resource_type: 'video',
              original_search_query: search_queries?.[0]?.query || topic,
              topic_signature: richSignature,
              concepts_covered: resource.concepts_covered,
              difficulty_level: resource.difficulty_level,
              quality_score: resource.quality_score,
              times_served: 1,
              // New transcript analysis fields
              transcript_text: transcriptText,
              transcript_analyzed: true,
              transcript_source: transcriptSource,
              content_analysis: contentAnalysis,
              analysis_confidence: analysisConfidence,
              analyzed_at: new Date().toISOString(),
            };
            
            // Only include embedding if we have one
            if (resourceVector) {
              upsertData.topic_embedding = resourceVector;
            }

            const { data: insertedResource, error: insertError } = await supabase
              .from('curated_resources')
              .upsert(upsertData, {
                onConflict: 'url',
                ignoreDuplicates: false,
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('[search-resources] Error storing resource:', insertError);
              console.error('[search-resources] Insert error details:', JSON.stringify(insertError));
              
              // If upsert failed, try to fetch existing resource by URL
              const { data: existingRes } = await supabase
                .from('curated_resources')
                .select('id')
                .eq('url', resource.url)
                .single();
              
              if (existingRes) {
                resource.id = existingRes.id;
                console.log(`[search-resources] Found existing resource: ${resource.id}`);
              } else {
                console.error('[search-resources] Could not find or create resource for URL:', resource.url);
              }
            } else {
              resource.id = insertedResource?.id;
              console.log(`[search-resources] Stored analyzed resource: ${resource.title}, ID: ${resource.id}, confidence: ${analysisConfidence}`);
            }
            
            // Add analysis metadata to resource for response
            resource.transcript_analyzed = true;
            resource.transcript_source = transcriptSource;
            resource.analysis_confidence = analysisConfidence;

          } catch (storeError) {
            console.error('[search-resources] Error in resource storage flow:', storeError);
          }

          // Only add to results if we have an ID (can be linked to blueprint)
          if (resource.id) {
            results.push(resource);
          } else {
            console.warn('[search-resources] Skipping resource without ID:', resource.url);
          }
        }
      }
    }

    // =========================================================================
    // STEP 5: Link resources to blueprint via junction table
    // =========================================================================
    
    console.log(`[search-resources] Linking ${results.length} resources to blueprint...`);
    
    for (const resource of results) {
      console.log(`[search-resources] Resource: ${resource.title}, ID: ${resource.id}, URL: ${resource.url}`);
      
      if (resource.id) {
        const { data: linkData, error: linkError } = await supabase
          .from('blueprint_topic_resources')
          .upsert({
            blueprint_id,
            unit_id,
            resource_id: resource.id,
            relevance_score: resource.similarity || resource.quality_score || 0.8,
            query_type: search_queries?.[0]?.query_type || 'concept',
            from_cache: resource.from_cache,
          }, {
            onConflict: 'blueprint_id,unit_id,resource_id',
          })
          .select();

        if (linkError) {
          console.error('[search-resources] Error linking resource:', linkError);
          console.error('[search-resources] Link error details:', JSON.stringify(linkError));
        } else {
          console.log(`[search-resources] Successfully linked resource: ${resource.id}`);
        }
      } else {
        console.warn(`[search-resources] Resource missing ID, cannot link: ${resource.url}`);
      }
    }

    // =========================================================================
    // STEP 6: Update topic_responses to mark as searched
    // =========================================================================
    
    await supabase
      .from('topic_responses')
      .upsert({
        blueprint_id,
        unit_id,
        user_id: user.id,
        response: 'needs_help',
        searched_at: new Date().toISOString(),
      }, {
        onConflict: 'blueprint_id,unit_id',
      });

    // Calculate analysis stats
    const analyzedCount = results.filter(r => r.transcript_analyzed).length;
    const transcriptCount = results.filter(r => r.transcript_source === 'auto_generated' || r.transcript_source === 'manual').length;
    const avgConfidence = results.length > 0 
      ? results.reduce((sum, r) => sum + (r.analysis_confidence || 0), 0) / results.length 
      : 0;

    console.log('[search-resources] Complete!');
    console.log(`  - Results: ${results.length}`);
    console.log(`  - From cache: ${cacheHit}`);
    console.log(`  - Search method: ${searchMetadata.search_method}`);
    console.log(`  - Queries used: ${searchMetadata.queries_used.join(' | ')}`);
    console.log(`  - Analyzed: ${analyzedCount}/${results.length}, Transcripts: ${transcriptCount}, Avg confidence: ${avgConfidence.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        resources: results,
        cache_hit: cacheHit,
        cache_similarity: cacheHit && results[0]?.similarity 
          ? results[0].similarity 
          : null,
        total_count: results.length,
        // Search metadata for UI display
        search_metadata: searchMetadata,
        // Analysis metadata
        analysis_metadata: {
          analyzed_count: analyzedCount,
          transcript_count: transcriptCount,
          metadata_only_count: results.filter(r => r.transcript_source === 'metadata_only').length,
          average_confidence: avgConfidence,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[search-resources] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

