// ============================================================================
// SEARCH RESOURCES WITH GROK 4.1 FAST REASONING WEB SEARCH
// ============================================================================
// Alternative search method using XAI's Grok 4.1 Fast Reasoning with live web search
// Makes a single search call and returns 3 results for cost efficiency
//
// FLOW:
// 1. Receive topic + search queries from blueprint
// 2. Check cache first for similar resources (>95% similarity)
// 3. If cache miss: Make ONE web search call with Grok 4.1 Fast Reasoning
// 4. Fetch transcripts for YouTube videos via Supadata API
// 5. Analyze transcripts with GPT-5-nano for rich content analysis
// 6. Generate embeddings from rich signatures for accurate caching
// 7. Store resources with full analysis in database
// 8. Generate contextual explanations for each resource
// 9. Link resources to blueprint
//
// INPUT: { blueprint_id, unit_id, topic, description, search_queries[] }
// OUTPUT: Array of 3 educational resources with analysis
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  createSupabaseClient, 
  createSupabaseClientWithAuth,
} from '../_shared/supabase-client.ts';
import { 
  generateEmbedding, 
  createNeedEmbeddingText,
  formatVectorForPostgres,
} from '../_shared/embeddings.ts';
import { 
  fetchTranscript, 
  extractVideoId as extractVideoIdFromTranscript,
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

const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
const GROK_MODEL = 'grok-4-1-fast-reasoning'; // Fast reasoning model with web search
const MAX_SEARCH_RESULTS = 3; // Fixed at 3 to save costs

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
  from_cache: boolean;
  resource_explanation?: string;
  // Transcript analysis fields
  transcript_analyzed?: boolean;
  transcript_source?: 'auto_generated' | 'manual' | 'metadata_only' | 'failed' | 'none';
  content_analysis?: ContentAnalysis;
  analysis_confidence?: number;
}

// ============================================================================
// GROK WEB SEARCH
// ============================================================================

/**
 * Call Grok 4.1 Fast Reasoning with live web search tool to find educational videos
 * Uses site:youtube.com to force YouTube-only results
 */
async function searchWithGrok(
  topic: string,
  description: string,
  learningObjective: string | undefined,
  searchQueries: Array<{ query: string; query_type: string; priority: number }>
): Promise<ResourceResult[]> {
  if (!XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not set');
  }

  // Simplify the topic for better YouTube search results
  // Remove overly academic language that doesn't work well on YouTube
  const simplifyForYouTube = (text: string): string => {
    // Remove common academic modifiers
    let simplified = text
      .replace(/\b(calculations?|analysis|applications?|methods?|techniques?|optimization|numerical|computational|advanced|detailed|comprehensive)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Keep it short - YouTube titles are usually simple
    const words = simplified.split(' ').filter(w => w.length > 2);
    if (words.length > 5) {
      simplified = words.slice(0, 5).join(' ');
    }
    
    return simplified;
  };

  // Create a simplified search term for YouTube
  const simplifiedTopic = simplifyForYouTube(topic);
  
  // Build search query with site:youtube.com to force YouTube results
  const youtubeQuery = `${simplifiedTopic} tutorial site:youtube.com`;

  console.log(`[search-resources-grok] Simplified topic: ${simplifiedTopic}`);
  console.log(`[search-resources-grok] YouTube search query: ${youtubeQuery}`);

  // System prompt focused on extracting YouTube URLs from search results
  const systemPrompt = `You are a helpful assistant that searches for educational YouTube videos and returns them as JSON.

CRITICAL: When searching, use "site:youtube.com" in your search to ONLY get YouTube results.

When you find YouTube videos, return ONLY a JSON array with no other text:
[{"url":"https://www.youtube.com/watch?v=VIDEO_ID","title":"Video Title","description":"What it teaches","channel_name":"Channel","difficulty_level":"beginner/intermediate/advanced","quality_score":0.8,"resource_explanation":"Why helpful"}]

Rules:
- Search with site:youtube.com
- Return exactly 3 YouTube videos
- If first search fails, try simpler terms like "${simplifiedTopic} explained site:youtube.com"
- ONLY return the JSON array, no other text or markdown`;

  // User prompt with the YouTube-specific search
  const userPrompt = `Search for: ${youtubeQuery}

Find 3 YouTube tutorial videos about: ${simplifiedTopic}
${learningObjective ? `Learning goal: ${learningObjective}` : ''}

If no results, try: "${simplifiedTopic} explained site:youtube.com" or "${simplifiedTopic} lecture site:youtube.com"

Return ONLY a JSON array with 3 YouTube video objects. No markdown, no explanation.`;

  console.log('[search-resources-grok] Calling Grok with web search...');
  console.log(`  - Topic: ${topic}`);
  console.log(`  - Simplified: ${simplifiedTopic}`);
  console.log(`  - YouTube query: ${youtubeQuery}`);

  // Call Grok with live_search tool enabled
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      search_parameters: {
        mode: "auto",
        return_citations: true,
        from_date: "2020-01-01",
        max_search_results: 10,
      },
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[search-resources-grok] Grok API error:', response.status, errorText);
    throw new Error(`Grok API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[search-resources-grok] Grok response received');
  console.log('[search-resources-grok] Response choices:', data.choices?.length || 0);

  const results: ResourceResult[] = [];
  
  // =========================================================================
  // STEP 1: Extract from tool results / citations if available
  // =========================================================================
  // Grok may return search results with citations
  if (data.citations && Array.isArray(data.citations)) {
    console.log(`[search-resources-grok] Found ${data.citations.length} citations`);
    for (const citation of data.citations) {
      const url = citation.url || citation.link;
      if (url && typeof url === 'string' && (url.includes('youtube.com/watch') || url.includes('youtu.be/'))) {
        if (!results.find(r => r.url === url) && results.length < MAX_SEARCH_RESULTS) {
          const videoId = extractVideoId(url);
          const thumbnail = videoId 
            ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            : undefined;
          
          results.push({
            url: url,
            title: citation.title || 'YouTube Video',
            description: citation.snippet || citation.description || `Educational video about ${topic}`,
            platform: 'YouTube',
            channel_name: undefined,
            channel_url: undefined,
            thumbnail_url: thumbnail,
            duration_seconds: undefined,
            topic_signature: `Educational video about ${topic}: ${citation.title || ''}. ${citation.snippet || ''}`,
            concepts_covered: [topic],
            difficulty_level: 'intermediate',
            quality_score: 0.75,
            from_cache: false,
          });
          console.log(`[search-resources-grok] Extracted YouTube URL from citations: ${url}`);
        }
      }
    }
  }

  // =========================================================================
  // STEP 2: Extract from message content (Claude-style JSON response)
  // =========================================================================
  const messageContent = data.choices?.[0]?.message?.content || '';
  console.log('[search-resources-grok] Processing message content, length:', messageContent.length);
  
  if (messageContent) {
    let text = messageContent;
    
    // Try to extract JSON from code blocks first (```json ... ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
      console.log('[search-resources-grok] Found JSON code block');
    }
    
    // Try to find JSON array in the text
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      console.log('[search-resources-grok] Found JSON array match');
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[search-resources-grok] Successfully parsed JSON, items:', parsed.length);
        if (Array.isArray(parsed)) {
          for (const r of parsed) {
            if (r.url && results.length < MAX_SEARCH_RESULTS) {
              // Skip if we already have this URL
              if (results.find(existing => existing.url === r.url)) continue;
              
              // Generate thumbnail from YouTube URL
              const videoId = extractVideoId(r.url);
              const thumbnail = videoId 
                ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                : undefined;

              results.push({
                url: r.url,
                title: r.title || 'YouTube Video',
                description: r.description || '',
                platform: 'YouTube',
                channel_name: r.channel_name || undefined,
                channel_url: undefined,
                thumbnail_url: thumbnail,
                duration_seconds: undefined,
                topic_signature: `Educational video about ${topic}: ${r.title}. ${r.description || ''}`,
                concepts_covered: [topic],
                difficulty_level: r.difficulty_level || 'intermediate',
                quality_score: typeof r.quality_score === 'number' ? r.quality_score : 0.8,
                from_cache: false,
                resource_explanation: r.resource_explanation || r.explanation || '',
              });
            }
          }
        }
      } catch (e) {
        console.log('[search-resources-grok] Failed to parse JSON:', e);
      }
    }
    
    // ALSO try to extract URLs directly from text using regex (fallback)
    const urlMatches = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s\)\"<>\]]+/g);
    if (urlMatches && urlMatches.length > 0) {
      console.log('[search-resources-grok] Found YouTube URLs via regex:', urlMatches.length);
      for (const url of urlMatches) {
        // Clean up the URL (remove trailing punctuation)
        const cleanUrl = url.replace(/[,.\]}>]+$/, '');
        if (!results.find(r => r.url === cleanUrl) && results.length < MAX_SEARCH_RESULTS) {
          const videoId = extractVideoId(cleanUrl);
          const thumbnail = videoId 
            ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            : undefined;

          results.push({
            url: cleanUrl,
            title: 'YouTube Video',
            description: `Educational video about ${topic}`,
            platform: 'YouTube',
            channel_name: undefined,
            channel_url: undefined,
            thumbnail_url: thumbnail,
            duration_seconds: undefined,
            topic_signature: `Educational video resource about ${topic}`,
            concepts_covered: [topic],
            difficulty_level: 'intermediate',
            quality_score: 0.7,
            from_cache: false,
          });
        }
      }
    }
  }

  console.log('[search-resources-grok] Extracted resources:', results.length);
  
  return results.slice(0, MAX_SEARCH_RESULTS);
}

/**
 * Extract YouTube video ID from URL
 */
function extractVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ============================================================================
// RESOURCE EXPLANATION GENERATION
// ============================================================================

/**
 * Generate contextual explanations for found resources in a batch
 * Uses Grok for consistency (and cost savings)
 */
async function generateResourceExplanations(
  topic: string,
  description: string | undefined,
  learningObjective: string | undefined,
  resources: ResourceResult[]
): Promise<ResourceResult[]> {
  if (!XAI_API_KEY || resources.length === 0) {
    return resources;
  }

  console.log(`[search-resources-grok] Generating explanations for ${resources.length} resources...`);

  const systemPrompt = `You are an expert educational tutor helping students understand why specific learning resources are helpful for their studies.

Your task is to evaluate and explain educational resources for relevance to the student's learning objective.

CRITICAL: You should mark resources as irrelevant ONLY in extreme cases (e.g., a cooking video for calculus, a makeup tutorial for physics).

For RELEVANT resources (99% of educational videos should be marked relevant):
- Set "is_relevant": true
- Write 2-3 sentences explaining what the resource covers and how it helps the student
- Be encouraging and specific, speak directly using "you" and "your"
- Don't just repeat the video title
- Even if the video is broader or narrower than the exact topic, it's still RELEVANT if it teaches related concepts

For COMPLETELY IRRELEVANT resources (EXTREME cases only - wrong subject entirely):
- Set "is_relevant": false
- Set "explanation": "NOT_RELEVANT"
- ONLY use this if the video is about a completely different subject (e.g., skincare for physics, cooking for math)

IMPORTANT: When in doubt, mark it as RELEVANT. It's better to include a somewhat-related resource than to exclude a helpful one.

OUTPUT FORMAT (JSON only):
{
  "explanations": [
    {
      "url": "the resource URL",
      "is_relevant": true or false,
      "explanation": "2-3 sentence explanation OR 'NOT_RELEVANT' if COMPLETELY off-topic"
    }
  ]
}`;

  // Build resource summaries for the prompt
  const resourceSummaries = resources.map((r, idx) => ({
    index: idx + 1,
    url: r.url,
    title: r.title,
    channel: r.channel_name || 'Unknown',
    description: r.description?.substring(0, 200) || '',
    concepts: r.concepts_covered?.slice(0, 3) || [],
    difficulty: r.difficulty_level,
  }));

  const userPrompt = `Evaluate and explain these educational resources for relevance:

LEARNING TOPIC: ${topic}
${description ? `TOPIC DESCRIPTION: ${description}` : ''}
${learningObjective ? `LEARNING OBJECTIVE: ${learningObjective}` : ''}

RESOURCES TO EVALUATE:
${JSON.stringify(resourceSummaries, null, 2)}

For each resource:
1. Be GENEROUS - if it's even partially related, mark as relevant
2. If relevant, write a 2-3 sentence explanation of what it covers and how it helps
3. If COMPLETELY off-topic (like skincare for physics), mark is_relevant as false and use "NOT_RELEVANT"

Output valid JSON only, no markdown.`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[search-resources-grok] Grok explanation API error:', response.status, errorText);
      return resources; // Return resources without explanations on error
    }

    const data = await response.json();
    
    // Extract text content from response
    const textContent = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    let explanations: Array<{ url: string; is_relevant?: boolean; explanation: string }> = [];
    
    // Try to extract JSON from the response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        explanations = parsed.explanations || [];
        console.log(`[search-resources-grok] Parsed ${explanations.length} resource explanations`);
      } catch (parseError) {
        console.error('[search-resources-grok] Failed to parse explanation JSON:', parseError);
      }
    }

    // Filter out ONLY explicitly irrelevant resources and map explanations back
    const relevantResources: ResourceResult[] = [];
    let filteredCount = 0;
    
    for (const resource of resources) {
      const matchingExplanation = explanations.find(e => e.url === resource.url);
      
      // Only filter if EXPLICITLY marked as not relevant
      // Be conservative - when in doubt, keep the resource
      if (matchingExplanation) {
        const explanation = matchingExplanation.explanation || '';
        const isExplicitlyIrrelevant = 
          matchingExplanation.is_relevant === false && 
          (explanation === 'NOT_RELEVANT' || 
           explanation.toLowerCase().includes('does not contain relevant content') ||
           explanation.toLowerCase().includes('not actually relevant'));
        
        if (isExplicitlyIrrelevant) {
          console.log(`[search-resources-grok] Filtering out explicitly irrelevant resource: ${resource.title}`);
          filteredCount++;
          continue; // Skip this resource
        }
        
        resource.resource_explanation = matchingExplanation.explanation;
      }
      
      relevantResources.push(resource);
    }

    if (filteredCount > 0) {
      console.log(`[search-resources-grok] Filtered out ${filteredCount} explicitly irrelevant resource(s)`);
    }
    console.log(`[search-resources-grok] ${relevantResources.length} relevant resources remaining`);
    
    return relevantResources;

  } catch (error) {
    console.error('[search-resources-grok] Error generating resource explanations:', error);
    return resources; // Return resources without explanations on error
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
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
    const { blueprint_id, unit_id, topic, description, learning_objective, search_queries } = body;

    console.log('[search-resources-grok] Starting Grok web search');
    console.log(`  - Blueprint: ${blueprint_id}`);
    console.log(`  - Unit: ${unit_id}`);
    console.log(`  - Topic: ${topic}`);
    console.log(`  - Description: ${description}`);
    console.log(`  - Learning objective: ${learning_objective}`);
    console.log(`  - Queries: ${search_queries?.length || 0}`);
    console.log(`  - Query details:`, JSON.stringify(search_queries, null, 2));

    if (!blueprint_id || !unit_id || !topic) {
      throw new Error('Missing required fields: blueprint_id, unit_id, topic');
    }

    // =========================================================================
    // STEP 1: Generate embedding and check cache first (just like original)
    // =========================================================================
    
    // Use the same need-based embedding format as the original search-resources
    const queryText = createNeedEmbeddingText(
      topic,
      description,
      learning_objective,
      search_queries?.map((q: any) => q.query)
    );
    
    console.log('[search-resources-grok] Generating query embedding for cache lookup...');
    const { embedding: queryEmbedding } = await generateEmbedding(queryText);
    const vectorString = formatVectorForPostgres(queryEmbedding);

    // Search cache first
    console.log('[search-resources-grok] Searching cache with vector similarity...');
    const { data: cachedResources, error: searchError } = await supabase.rpc(
      'search_similar_resources',
      {
        query_embedding: vectorString,
        similarity_threshold: 0.95, // Same as original
        max_results: 3,
      }
    );

    if (searchError) {
      console.error('[search-resources-grok] Cache search error:', searchError);
    }

    let results: ResourceResult[] = [];
    let cacheHit = false;

    // =========================================================================
    // STEP 2: Check if we have cached results
    // =========================================================================
    
    if (cachedResources && cachedResources.length >= 1) {
      console.log(`[search-resources-grok] Cache HIT! Found ${cachedResources.length} resources`);
      cacheHit = true;

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
      // STEP 3: Cache miss - Search with Grok
      // =========================================================================
      
      console.log('[search-resources-grok] Cache MISS - searching with Grok...');
      
      results = await searchWithGrok(
        topic,
        description || '',
        learning_objective,
        search_queries || []
      );
    }

    if (results.length === 0) {
      console.log('[search-resources-grok] No results found');
      // Return success with empty array instead of throwing error
      // Let the frontend handle the empty state
      return new Response(
        JSON.stringify({
          success: true,
          resources: [],
          cache_hit: false,
          total_count: 0,
          search_metadata: {
            queries_used: [search_queries?.[0]?.query || topic],
            search_method: 'grok_web_search',
            total_api_results: 0,
          },
          message: 'No educational videos found for this topic. Try adjusting your search terms.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // =========================================================================
    // STEP 4: Fetch transcripts and analyze resources (for new resources only)
    // =========================================================================
    
    if (!cacheHit && results.length > 0) {
      console.log('[search-resources-grok] Processing new resources with transcript analysis...');
      
      for (const resource of results) {
        try {
          // =========================================================
          // STEP 4a: Check if resource already exists and is analyzed
          // =========================================================
          const { data: existingResource } = await supabase
            .from('curated_resources')
            .select('id, transcript_analyzed, content_analysis, topic_signature, analysis_confidence, times_served')
            .eq('url', resource.url)
            .single();

          if (existingResource?.transcript_analyzed && existingResource?.content_analysis) {
            // Resource already analyzed - use cached data
            console.log(`[search-resources-grok] Using cached analysis for: ${resource.title}`);
            resource.id = existingResource.id;
            resource.topic_signature = existingResource.topic_signature;
            resource.content_analysis = existingResource.content_analysis;
            resource.analysis_confidence = existingResource.analysis_confidence;
            resource.transcript_analyzed = true;
            
            // Update times_served
            await supabase
              .from('curated_resources')
              .update({ times_served: (existingResource.times_served || 0) + 1 })
              .eq('id', existingResource.id);
            
            continue;
          }

          // =========================================================
          // STEP 4b: Fetch and analyze transcript (if not cached)
          // =========================================================
          console.log(`[search-resources-grok] Analyzing new resource: ${resource.title}`);
          
          let transcriptText: string | null = null;
          let transcriptSource: 'auto_generated' | 'manual' | 'metadata_only' | 'failed' = 'failed';
          let contentAnalysis: ContentAnalysis | null = null;
          let analysisConfidence = 0;

          // Try to fetch transcript for YouTube videos
          if (resource.platform === 'YouTube') {
            const videoId = extractVideoId(resource.url);
            if (videoId) {
              console.log(`[search-resources-grok] Fetching transcript for video: ${videoId}`);
              const transcriptResult = await fetchTranscript(videoId);
              
              if (transcriptResult.success && transcriptResult.transcript) {
                transcriptText = truncateTranscript(transcriptResult.transcript, 15000);
                transcriptSource = transcriptResult.source;
                console.log(`[search-resources-grok] Got transcript: ${transcriptResult.wordCount} words (${transcriptSource})`);
                
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
                  console.log(`[search-resources-grok] Transcript analysis complete: ${contentAnalysis.concepts_taught.length} concepts`);
                }
              } else {
                console.log(`[search-resources-grok] No transcript available: ${transcriptResult.error}`);
              }
            }
          }

          // =========================================================
          // STEP 4c: Fallback to metadata-only analysis
          // =========================================================
          if (!contentAnalysis) {
            console.log(`[search-resources-grok] Using metadata-only analysis for: ${resource.title}`);
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
            
            console.log(`[search-resources-grok] Generated rich signature (${richSignature.length} chars)`);
          }

          // Generate embedding from rich signature
          try {
            const { embedding: resourceEmbedding } = await generateEmbedding(richSignature);
            resourceVector = formatVectorForPostgres(resourceEmbedding);
          } catch (embedError) {
            console.error('[search-resources-grok] Error generating embedding, will store without:', embedError);
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
            // Transcript analysis fields
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
            console.error('[search-resources-grok] Error storing resource:', insertError);
            console.error('[search-resources-grok] Insert error details:', JSON.stringify(insertError));
            
            // If upsert failed, try to fetch existing resource by URL
            const { data: existingRes } = await supabase
              .from('curated_resources')
              .select('id')
              .eq('url', resource.url)
              .single();
            
            if (existingRes) {
              resource.id = existingRes.id;
              console.log(`[search-resources-grok] Found existing resource: ${resource.id}`);
            } else {
              console.error('[search-resources-grok] Could not find or create resource for URL:', resource.url);
            }
          } else {
            resource.id = insertedResource?.id;
            console.log(`[search-resources-grok] Stored analyzed resource: ${resource.title}, ID: ${resource.id}, confidence: ${analysisConfidence}`);
          }
          
          // Add analysis metadata to resource for response
          resource.transcript_analyzed = true;
          resource.transcript_source = transcriptSource;
          resource.analysis_confidence = analysisConfidence;

        } catch (storeError) {
          console.error('[search-resources-grok] Error in resource storage flow:', storeError);
        }
      }
    }

    // =========================================================================
    // STEP 5: Link resources to blueprint via junction table
    // =========================================================================
    
    console.log(`[search-resources-grok] Linking ${results.length} resources to blueprint...`);
    
    for (const resource of results) {
      if (resource.id) {
        const { error: linkError } = await supabase
          .from('blueprint_topic_resources')
          .upsert({
            blueprint_id,
            unit_id,
            resource_id: resource.id,
            relevance_score: resource.quality_score || 0.8,
            query_type: search_queries?.[0]?.query_type || 'concept',
            from_cache: false,
            resource_explanation: resource.resource_explanation || null,
          }, {
            onConflict: 'blueprint_id,unit_id,resource_id',
          });

        if (linkError) {
          console.error('[search-resources-grok] Error linking resource:', linkError);
        } else {
          console.log(`[search-resources-grok] Successfully linked resource: ${resource.id}`);
        }
      }
    }

    // =========================================================================
    // STEP 6: Update topic_responses
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

    // =========================================================================
    // STEP 7: Generate contextual explanations for resources (batch AI call)
    // =========================================================================
    
    if (results.length > 0) {
      console.log(`[search-resources-grok] Generating explanations for ${results.length} resources...`);
      const beforeCount = results.length;
      const resultsBeforeFiltering = [...results]; // Keep a copy
      
      results = await generateResourceExplanations(
        topic,
        description,
        learning_objective,
        results
      );
      
      const afterCount = results.length;
      console.log(`[search-resources-grok] After explanation generation: ${afterCount} resources (filtered ${beforeCount - afterCount})`);
      
      // If ALL resources were filtered out, that's a problem - return the original results
      if (afterCount === 0 && beforeCount > 0) {
        console.error('[search-resources-grok] ⚠️ ALL resources were filtered as irrelevant! This is likely an error.');
        console.error('[search-resources-grok] Explanation generation may have failed. Returning resources without explanations.');
        results = resultsBeforeFiltering; // Restore original results
      } else {
        // Update junction table with resource explanations (only if we have results)
        console.log('[search-resources-grok] Updating junction table with resource explanations...');
        for (const resource of results) {
          if (resource.id && resource.resource_explanation) {
            await supabase
              .from('blueprint_topic_resources')
              .update({ resource_explanation: resource.resource_explanation })
              .eq('blueprint_id', blueprint_id)
              .eq('unit_id', unit_id)
              .eq('resource_id', resource.id);
          }
        }
      }
    }

    // Calculate analysis stats
    const analyzedCount = results.filter(r => r.transcript_analyzed).length;
    const transcriptCount = results.filter(r => r.transcript_source === 'auto_generated' || r.transcript_source === 'manual').length;
    const avgConfidence = results.length > 0 
      ? results.reduce((sum, r) => sum + (r.analysis_confidence || 0), 0) / results.length 
      : 0;

    console.log('[search-resources-grok] Complete!');
    console.log(`  - Results: ${results.length}`);
    console.log(`  - From cache: ${cacheHit}`);
    console.log(`  - Search method: ${cacheHit ? 'cache' : 'grok_web_search'}`);
    console.log(`  - Analyzed: ${analyzedCount}/${results.length}, Transcripts: ${transcriptCount}, Avg confidence: ${avgConfidence.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        resources: results,
        cache_hit: cacheHit,
        total_count: results.length,
        search_metadata: {
          queries_used: [search_queries?.[0]?.query || topic],
          search_method: cacheHit ? 'cache' : 'grok_web_search',
          total_api_results: results.length,
        },
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
    console.error('[search-resources-grok] Error:', error);

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

