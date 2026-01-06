// ============================================================================
// LOAD RESOURCES DATABASE EDGE FUNCTION
// ============================================================================
// Orchestrates the complete pipeline for loading YouTube resources into the
// resources_from_make database with Pinecone vector embeddings.
//
// Pipeline:
// 1. Apify Actor → YouTube video search
// 2. SupaData API → Extract video transcripts
// 3. Grok 4.1 → Analyze transcripts
// 4. Database → Store in resources_from_make
// 5. OpenAI → Generate embeddings
// 6. Pinecone → Store vector embeddings
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { generateEmbedding } from '../_shared/embeddings.ts';
import { upsertVectors } from '../_shared/pinecone-client.ts';

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
const APIFY_ACTOR_ID = Deno.env.get('APIFY_ACTOR_ID');
const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY');
const SUPADATA_API_ENDPOINT = Deno.env.get('SUPADATA_API_ENDPOINT');
const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
const PINECONE_NAMESPACE = 'resources';

// ============================================================================
// TYPES
// ============================================================================

interface RequestBody {
  unit_id: string;
  topic: string;
  search_queries: string[];
  blueprint_id: string;
  description?: string;
}

interface ApifyVideo {
  url: string;
  title: string;
  channelName: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  description?: string;
}

interface GrokAnalysis {
  categories: string[];
  key_phrases: string[];
  summary: string;
  problems: string[];
}

interface ProcessedResource {
  success: boolean;
  resource_id?: string;
  url?: string;
  title?: string;
  error?: string;
}

// ============================================================================
// GROK ANALYSIS PROMPT
// ============================================================================

const GROK_ANALYSIS_PROMPT = `You are an expert in analyzing engineering educational video transcripts, particularly in fields like mechanical engineering, electrical, civil, aerospace, and all other engineering disciplines. Your task is to thoroughly analyze the provided transcript from a YouTube video and categorize it for a database system. This system recommends videos to students based on their specific learning needs, such as homework problems. For example, if a student needs help with "one-dimensional steady-state conduction through a flat wall with given temperature and heat flux boundary conditions," the system should match it to videos with highly specific key phrases.

Input: The full transcript of the YouTube video.

Output: Produce a structured JSON object with the following fields. Do not add extra text outside the JSON. ALWAYS respond in 100% valid JSON. Ensure the analysis is detailed, accurate, and based solely on the transcript content.

{
  "categories": [
    // An array of strings representing categorizations. Choose from these three options:
    // - "Introduction video" (if it's an overview or beginner-level intro without deep dives)
    // - "Good visuals and animations" (if the transcript describes or implies diagrams, animations, simulations, or visual aids)
    // - "Heavy on computation and math" (if it involves step-by-step calculations, equations, derivations, or problem-solving with numbers)
    // Only include the 1 category that clearly dominate based on the transcript.
  ],
  "key_phrases": [
    // An array of exactly 10 extremely specific, descriptive key phrases (strings) that capture the core content, topics, problems, methods, or concepts discussed. These should be detailed enough for precise database searching and matching to student queries.
    // Examples: "One-dimensional steady-state conduction through a flat wall with fixed temperature on one side and convective heat transfer on the other", "Solving transient heat conduction using lumped capacitance method with Biot number calculation", "Finite difference method for 2D heat conduction in a rectangular plate".
    // Make them searchable: Include specific boundary conditions, equations, materials, or scenarios mentioned. Avoid generic phrases like "heat transfer basics".
  ],
  "summary": "A brief 2-3 sentence summary of the video's main content and educational value.",
  "problems": [
    // An array of specific problems extracted from the transcript. Each entry: "Problem 1: [concise description of the problem, including key parameters, conditions, and what is being asked]."
    // Only include if the video features explicit homework-style or computational problems (e.g., numerical examples, derivations, or step-by-step solutions). List sequentially if multiple. Leave empty [] if none.
  ]
}`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Search for YouTube videos using Apify Actor
 */
async function searchYouTubeWithApify(searchQuery: string): Promise<ApifyVideo[]> {
  if (!APIFY_API_TOKEN || !APIFY_ACTOR_ID) {
    throw new Error('Apify credentials not configured');
  }

  console.log(`[Apify] Searching YouTube for: "${searchQuery}"`);
  console.log(`[Apify] Using Actor ID: ${APIFY_ACTOR_ID}`);

  // Input format for grow_media/youtube-search-api actor
  // This actor uses YouTube Data API v3 format
  const inputPayload = {
    q: searchQuery,  // The search query
    maxResults: 10,
    relevanceLanguage: "en",
    useFilters: false,
    channelType: "any",
    order: "relevance",
    safeSearch: "moderate",
    videoDefinition: "any",
    videoDuration: "any",
    videoLicense: "any",
  };

  console.log(`[Apify] Input payload:`, JSON.stringify(inputPayload, null, 2));

  const runResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputPayload),
  });

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify run failed: ${runResponse.status} - ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;
  const defaultDatasetId = runData.data.defaultDatasetId;

  console.log(`[Apify] Actor run started: ${runId}`);
  console.log(`[Apify] Dataset ID: ${defaultDatasetId}`);

  // Wait for the run to complete (poll with timeout)
  let attempts = 0;
  const maxAttempts = 60; // 60 seconds max wait (some actors take longer)
  let runStatus = 'RUNNING';

  while (runStatus === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
    
    const statusResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`);
    const statusData = await statusResponse.json();
    runStatus = statusData.data.status;
    
    attempts++;
    console.log(`[Apify] Run status: ${runStatus} (attempt ${attempts}/${maxAttempts})`);
  }

  if (runStatus !== 'SUCCEEDED') {
    console.error(`[Apify] Run failed with status: ${runStatus}`);
    throw new Error(`Apify run did not complete successfully: ${runStatus}`);
  }

  // IMPORTANT: Get the results from THIS run's dataset, not a cached one
  // Use the defaultDatasetId from the run response
  console.log(`[Apify] Fetching results from dataset: ${defaultDatasetId}`);
  const resultsResponse = await fetch(`https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`);
  
  if (!resultsResponse.ok) {
    throw new Error(`Failed to fetch Apify results: ${resultsResponse.status}`);
  }

  const results = await resultsResponse.json();
  console.log(`[Apify] Found ${results.length} videos`);

  // Map to our format
  return results.map((item: any) => ({
    url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
    title: item.title || '',
    channelName: item.channelName || item.channelTitle || '',
    channelUrl: item.channelUrl || '',
    thumbnailUrl: item.thumbnailUrl || item.thumbnail || '',
    duration: item.duration || item.lengthSeconds || 0,
    description: item.description || '',
  }));
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parse transcript from SupaData format to plain text
 * SupaData returns an array of segments: [{"text":"...", "offset":123, "duration":456}, ...]
 */
function parseTranscriptSegments(transcriptData: any): string {
  // If it's already a string, return it
  if (typeof transcriptData === 'string') {
    return transcriptData;
  }

  // If it's an array of segments, extract the text
  if (Array.isArray(transcriptData)) {
    const textSegments = transcriptData
      .filter(segment => segment && segment.text)
      .map(segment => segment.text.trim())
      .filter(text => text.length > 0);
    
    return textSegments.join(' ');
  }

  // If it's an object with a text property
  if (transcriptData && typeof transcriptData === 'object' && transcriptData.text) {
    return transcriptData.text;
  }

  // Fallback: try to stringify and extract
  return String(transcriptData);
}

/**
 * Get video transcript using SupaData API
 */
async function getTranscriptWithSupaData(videoUrl: string): Promise<string> {
  if (!SUPADATA_API_KEY) {
    throw new Error('SupaData API key not configured');
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${videoUrl}`);
  }

  console.log(`[SupaData] Fetching transcript for video: ${videoId}`);
  console.log(`[SupaData] Full URL: ${videoUrl}`);

  // SupaData API endpoint
  const endpoint = SUPADATA_API_ENDPOINT || 'https://api.supadata.ai/v1/transcript';
  
  // SupaData expects the full YouTube URL in the 'url' parameter
  let response;
  
  // Pattern 1: Full URL with x-api-key header
  response = await fetch(`${endpoint}?url=${encodeURIComponent(videoUrl)}`, {
    method: 'GET',
    headers: {
      'x-api-key': SUPADATA_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  // If that fails with 401, try with API key in different header
  if (!response.ok && response.status === 401) {
    console.log('[SupaData] Trying Authorization header...');
    response = await fetch(`${endpoint}?url=${encodeURIComponent(videoUrl)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPADATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // If still failing with 401, try API key as query param
  if (!response.ok && response.status === 401) {
    console.log('[SupaData] Trying API key as query param...');
    response = await fetch(`${endpoint}?url=${encodeURIComponent(videoUrl)}&apiKey=${SUPADATA_API_KEY}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SupaData API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Extract transcript from response (try common field names)
  const rawTranscript = data.transcript || data.text || data.content || data.data?.transcript || '';
  
  if (!rawTranscript) {
    throw new Error('No transcript found in SupaData response');
  }

  // Parse the transcript (handles both array format and plain text)
  const transcript = parseTranscriptSegments(rawTranscript);
  
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript parsing resulted in empty text');
  }

  console.log(`[SupaData] Transcript length: ${transcript.length} characters`);
  console.log(`[SupaData] First 200 chars: ${transcript.substring(0, 200)}...`);
  
  return transcript;
}

/**
 * Analyze transcript using Grok 4.1
 */
async function analyzeTranscriptWithGrok(transcript: string): Promise<GrokAnalysis> {
  if (!XAI_API_KEY) {
    throw new Error('XAI API key not configured');
  }

  console.log('[Grok] Analyzing transcript...');

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-non-reasoning',
      messages: [
        {
          role: 'system',
          content: GROK_ANALYSIS_PROMPT,
        },
        {
          role: 'user',
          content: `Transcript to analyze: ${transcript}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in Grok response');
  }

  // Parse the JSON response
  const analysis: GrokAnalysis = JSON.parse(content);
  
  console.log('[Grok] Analysis complete');
  console.log(`  - Categories: ${analysis.categories.join(', ')}`);
  console.log(`  - Key phrases: ${analysis.key_phrases.length}`);
  console.log(`  - Problems: ${analysis.problems.length}`);

  return analysis;
}

/**
 * Process a single video through the complete pipeline
 */
async function processVideo(
  video: ApifyVideo,
  searchQuery: string,
  supabase: any
): Promise<ProcessedResource> {
  try {
    console.log(`\n[Pipeline] Processing: ${video.title}`);

    // Step 1: Get transcript
    const transcript = await getTranscriptWithSupaData(video.url);

    // Step 2: Analyze with Grok
    const analysis = await analyzeTranscriptWithGrok(transcript);

    // Step 3: Generate UUID for resource (will be the database ID)
    const resourceId = crypto.randomUUID();

    // Step 4: Generate embedding for the summary
    console.log('[Pipeline] Generating embedding...');
    const { embedding } = await generateEmbedding(analysis.summary);

    // Step 5: Store in database
    console.log('[Pipeline] Storing in database...');
    const { data: dbData, error: dbError } = await supabase
      .from('resources_from_make')
      .insert({
        id: resourceId,  // Use 'id' column, not 'resource_id'
        url: video.url,
        title: video.title,
        description: video.description || analysis.summary,
        platform: 'YouTube',
        channel_name: video.channelName,
        channel_url: video.channelUrl,
        thumbnail_url: video.thumbnailUrl,
        duration_seconds: video.duration,
        resource_type: 'video',
        original_search_query: searchQuery,
        key_phrases: analysis.key_phrases,
        transcript: transcript,
        summary: analysis.summary,
        full_content_analysis: JSON.stringify({
          categories: analysis.categories,
          problems: analysis.problems,
        }),
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Step 6: Store in Pinecone
    // Use the same ID for Pinecone, and store it in metadata as 'resource_id'
    console.log('[Pipeline] Storing in Pinecone...');
    await upsertVectors(
      [
        {
          id: resourceId,
          values: embedding,
          metadata: {
            resource_id: resourceId,  // This links back to the 'id' column in the database
            title: video.title,
            platform: 'YouTube',
            url: video.url,
          },
        },
      ],
      PINECONE_NAMESPACE
    );

    console.log(`[Pipeline] ✅ Successfully processed: ${video.title}`);

    return {
      success: true,
      resource_id: resourceId,
      url: video.url,
      title: video.title,
    };
  } catch (error) {
    console.error(`[Pipeline] ❌ Error processing ${video.title}:`, error);
    return {
      success: false,
      url: video.url,
      title: video.title,
      error: error.message,
    };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: RequestBody = await req.json();
    const { unit_id, topic, search_queries, blueprint_id, description } = body;

    console.log('='.repeat(80));
    console.log('[load-resources-database] Starting pipeline');
    console.log(`  - Unit ID: ${unit_id}`);
    console.log(`  - Topic: ${topic}`);
    console.log(`  - Search queries: ${search_queries.length}`);
    console.log('='.repeat(80));

    // Validate required fields
    if (!unit_id || !topic || !search_queries || search_queries.length === 0) {
      throw new Error('Missing required fields: unit_id, topic, search_queries');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Collect all videos from all search queries
    const allVideos: ApifyVideo[] = [];
    const videoUrls = new Set<string>(); // Deduplicate by URL

    for (const query of search_queries) {
      try {
        const videos = await searchYouTubeWithApify(query);
        
        for (const video of videos) {
          if (!videoUrls.has(video.url)) {
            videoUrls.add(video.url);
            allVideos.push(video);
          }
        }
      } catch (error) {
        console.error(`[Pipeline] Error searching for "${query}":`, error);
        // Continue with other queries
      }
    }

    console.log(`\n[Pipeline] Found ${allVideos.length} unique videos to process`);

    if (allVideos.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No videos found for the given search queries',
          processed: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each video through the pipeline
    const results: ProcessedResource[] = [];
    
    for (const video of allVideos) {
      const result = await processVideo(video, search_queries[0], supabase);
      results.push(result);
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(80));
    console.log('[Pipeline] Complete!');
    console.log(`  - Total videos: ${results.length}`);
    console.log(`  - Successful: ${successful}`);
    console.log(`  - Failed: ${failed}`);
    console.log('='.repeat(80));

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          successful,
          failed,
        },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[load-resources-database] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

