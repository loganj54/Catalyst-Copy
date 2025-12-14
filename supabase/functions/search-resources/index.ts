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
  formatVectorForPostgres,
} from '../_shared/embeddings.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
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
}

// ============================================================================
// CLAUDE WEB SEARCH WITH TOOL USE
// ============================================================================

/**
 * Call Claude with web search tool to find educational videos
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

  const systemPrompt = `You are an expert educational content curator. Your job is to find high-quality educational resources that help students learn specific topics.

CRITICAL: VIDEO-FIRST APPROACH (80% videos, 20% text)
- STRONGLY prioritize YouTube videos and video content
- At least 80% of your results MUST be videos
- Only include text articles/websites if you cannot find enough quality videos
- When searching, add "video" or "tutorial" to your search queries

When searching for videos, focus on:
- YouTube videos from reputable educators (Khan Academy, Professor Leonard, 3Blue1Brown, MIT OpenCourseWare, Organic Chemistry Tutor, Crash Course, etc.)
- Clear, well-explained video tutorials
- Content appropriate for the difficulty level
- Videos that directly address the topic

Only include text resources when:
- No suitable video exists for a niche topic
- A text resource provides unique value (interactive calculator, reference sheet, etc.)

For each resource you find, you MUST generate a detailed topic_signature that precisely describes what educational problem this resource solves. The signature should be 2-3 sentences and include:
- Specific concepts taught
- Mathematical formulas or methods covered (if applicable)
- Problem types it helps with
- Prerequisite knowledge assumed

This signature will be used to match this resource to future students with similar learning needs, so be thorough and precise.`;

  // Build diverse search queries - use DIFFERENT query types for each resource
  // This ensures we get a full A-Z roadmap: intro, tutorial, example, concept - not A-A-A
  const queryTypesUsed = searchQueries.map(q => q.query_type);
  const queriesWithTypes = searchQueries
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_SEARCH_RESULTS);
  
  // Create a formatted list showing WHICH query type each search should target
  const diverseQueryInstructions = queriesWithTypes.map((q, i) => 
    `${i + 1}. "${q.query}" [TYPE: ${q.query_type.toUpperCase()}] - Find a ${q.query_type === 'introduction' ? 'beginner-friendly intro' : q.query_type === 'tutorial' ? 'step-by-step tutorial' : q.query_type === 'example' ? 'worked example/solved problem' : q.query_type === 'concept' ? 'deep-dive explanation' : 'practice resource'}`
  ).join('\n');

  const userPrompt = `Find ${MAX_SEARCH_RESULTS} high-quality educational VIDEO resources for the following topic:

TOPIC: ${topic}
DESCRIPTION: ${description || 'No additional description provided'}

IMPORTANT - DIVERSE RESOURCE TYPES:
Each search query below targets a DIFFERENT type of content. You MUST find resources that match the specified type for EACH query. Do NOT return 3 of the same type!

${diverseQueryInstructions}

CRITICAL REQUIREMENTS:
1. VIDEO FIRST: At least ${Math.ceil(MAX_SEARCH_RESULTS * 0.8)} out of ${MAX_SEARCH_RESULTS} resources MUST be YouTube videos or video content
2. DIVERSE TYPES: Each resource should be a different type (one intro, one tutorial, one example, etc.) - NOT all the same!
3. Add "video tutorial" to your searches to prioritize video content over text articles

Search the web for educational VIDEOS matching these queries. After searching, you MUST output your findings as a JSON array with this EXACT format at the end of your response:

\`\`\`json
[
  {
    "url": "https://youtube.com/watch?v=...",
    "title": "Video Title",
    "description": "Brief description",
    "platform": "YouTube",
    "channel_name": "Channel Name",
    "topic_signature": "Detailed 2-3 sentence description of what this video teaches",
    "concepts_covered": ["concept1", "concept2"],
    "difficulty_level": "intermediate",
    "quality_score": 0.8,
    "resource_type": "introduction" | "tutorial" | "example" | "concept" | "practice"
  }
]
\`\`\`

This JSON output is REQUIRED. Do not skip it.`;

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
    // STEP 1: Generate embedding for the topic
    // =========================================================================
    
    const queryText = createTopicEmbeddingText(
      topic,
      description,
      search_queries?.map(q => q.query)
    );
    
    console.log('[search-resources] Generating query embedding...');
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

    // =========================================================================
    // STEP 3: Check if we have enough cached results
    // =========================================================================
    
    if (cachedResources && cachedResources.length >= 1) {
      console.log(`[search-resources] Cache HIT! Found ${cachedResources.length} resources`);
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
      // STEP 4: Cache miss - use Claude web search
      // =========================================================================
      
      console.log('[search-resources] Cache MISS - performing web search...');
      
      const webResults = await searchWithClaude(
        topic,
        description || '',
        search_queries || []
      );

      if (webResults.length === 0) {
        console.log('[search-resources] No results from web search');
      } else {
        console.log(`[search-resources] Found ${webResults.length} resources from web`);

        // Store each new resource with its embedding
        for (const resource of webResults) {
          try {
            // Generate embedding for this resource's topic signature
            const { embedding: resourceEmbedding } = await generateEmbedding(
              resource.topic_signature
            );
            const resourceVector = formatVectorForPostgres(resourceEmbedding);

            // Upsert into curated_resources (using URL as unique key)
            const { data: insertedResource, error: insertError } = await supabase
              .from('curated_resources')
              .upsert({
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
                topic_signature: resource.topic_signature,
                topic_embedding: resourceVector,
                concepts_covered: resource.concepts_covered,
                difficulty_level: resource.difficulty_level,
                quality_score: resource.quality_score,
                times_served: 1,
              }, {
                onConflict: 'url',
                ignoreDuplicates: false,
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('[search-resources] Error storing resource:', insertError);
              console.error('[search-resources] Insert error details:', JSON.stringify(insertError));
              
              // If upsert failed, try to fetch existing resource by URL
              const { data: existingResource } = await supabase
                .from('curated_resources')
                .select('id')
                .eq('url', resource.url)
                .single();
              
              if (existingResource) {
                resource.id = existingResource.id;
                console.log(`[search-resources] Found existing resource: ${resource.id}`);
              }
            } else {
              resource.id = insertedResource?.id;
              console.log(`[search-resources] Stored resource: ${resource.title}, ID: ${resource.id}`);
            }

          } catch (embedError) {
            console.error('[search-resources] Error generating resource embedding:', embedError);
          }

          results.push(resource);
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

    console.log('[search-resources] Complete!');
    console.log(`  - Results: ${results.length}`);
    console.log(`  - From cache: ${cacheHit}`);

    return new Response(
      JSON.stringify({
        success: true,
        resources: results,
        cache_hit: cacheHit,
        cache_similarity: cacheHit && results[0]?.similarity 
          ? results[0].similarity 
          : null,
        total_count: results.length,
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

