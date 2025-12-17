// ============================================================================
// SEARCH PROBLEM WALKTHROUGHS EDGE FUNCTION
// ============================================================================
// Specialized function for finding problem-solving walkthrough videos
// Uses problem_solving_queries from the learning structure to find videos
// that demonstrate how to solve similar problems step-by-step
//
// FLOW:
// 1. Receive unit info with problem_solving_queries
// 2. Search YouTube for problem walkthrough videos
// 3. Analyze transcripts to verify problem-solving content
// 4. Store results with is_problem_walkthrough=true flag
//
// INPUT: { blueprint_id, unit_id, topic, problem_solving_queries[] }
// OUTPUT: Array of problem walkthrough videos
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
  type ContentAnalysis,
} from '../_shared/content-analyzer.ts';
import { PROMPTS } from '../_shared/prompts.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
const SIMILARITY_THRESHOLD = 0.95; // 95% similarity required for cache hit
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
  problem_details?: {
    original_problem_id?: string;
    key_equations?: string[];
    common_mistakes?: string[];
  };
  problem_solving_queries: Array<{
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
  query_used?: string;
  transcript_analyzed?: boolean;
  transcript_source?: 'auto_generated' | 'manual' | 'metadata_only' | 'failed' | 'none';
  content_analysis?: ContentAnalysis;
  analysis_confidence?: number;
  resource_explanation?: string;
}

// ============================================================================
// YOUTUBE SEARCH FOR PROBLEM WALKTHROUGHS
// ============================================================================

async function searchYouTubeForWalkthroughs(
  topic: string,
  problemSolvingQueries: Array<{ query: string; query_type: string; priority: number }>
): Promise<ResourceResult[]> {
  if (!YOUTUBE_API_KEY) {
    console.log('[search-problem-walkthroughs] No YouTube API key available');
    return [];
  }

  const results: ResourceResult[] = [];
  const seenVideoIds = new Set<string>();

  // Use problem-solving queries (prioritize walkthrough and example types)
  const queriesToTry = problemSolvingQueries
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map(q => q.query);

  console.log('[search-problem-walkthroughs] Searching YouTube with queries:', queriesToTry);

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

      console.log(`[search-problem-walkthroughs] YouTube search: "${query}"`);
      
      const response = await fetch(searchUrl.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[search-problem-walkthroughs] YouTube API error:', response.status, errorText);
        continue;
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        console.log(`[search-problem-walkthroughs] Found ${data.items.length} YouTube results`);
        
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
            duration_seconds: null,
            topic_signature: `Problem walkthrough video about ${topic}: ${snippet.title}. ${snippet.description?.substring(0, 200) || ''}`,
            concepts_covered: [topic],
            difficulty_level: 'intermediate',
            quality_score: 0.8,
            from_cache: false,
            query_used: query,
          });
          
          console.log(`[search-problem-walkthroughs] Added video: ${snippet.title}`);
        }
      }
    } catch (error) {
      console.error(`[search-problem-walkthroughs] Error searching YouTube:`, error);
    }
  }

  console.log(`[search-problem-walkthroughs] Found ${results.length} walkthrough videos`);
  return results;
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

    const body: SearchRequest = await req.json();
    const { blueprint_id, unit_id, topic, description, learning_objective, problem_solving_queries, problem_details } = body;

    console.log(`[search-problem-walkthroughs] Starting search for unit: ${unit_id}`);
    console.log(`[search-problem-walkthroughs] Topic: ${topic}`);
    console.log(`[search-problem-walkthroughs] Problem solving queries: ${problem_solving_queries?.length || 0}`);

    if (!problem_solving_queries || problem_solving_queries.length === 0) {
      throw new Error('No problem_solving_queries provided. This endpoint requires problem-solving queries.');
    }

    // Get authenticated client
    const authClient = createSupabaseClientWithAuth(authHeader);
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Could not verify user');
    }

    // Search YouTube for problem walkthrough videos
    console.log('[search-problem-walkthroughs] Searching YouTube for walkthrough videos...');
    const resources = await searchYouTubeForWalkthroughs(topic, problem_solving_queries);

    if (resources.length === 0) {
      console.log('[search-problem-walkthroughs] No walkthrough videos found');
      return new Response(
        JSON.stringify({ 
          success: true,
          resources: [],
          message: 'No problem walkthrough videos found. Try different search terms.',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Analyze transcripts for problem-solving content
    console.log('[search-problem-walkthroughs] Analyzing transcripts...');
    const analyzedResources: ResourceResult[] = [];
    
    for (const resource of resources) {
      try {
        const videoId = extractVideoId(resource.url);
        if (!videoId) {
          console.log(`[search-problem-walkthroughs] Could not extract video ID from: ${resource.url}`);
          analyzedResources.push(resource);
          continue;
        }

        // Fetch transcript
        const transcriptResult = await fetchTranscript(videoId);
        
        if (transcriptResult.success && transcriptResult.transcript) {
          // Analyze transcript for problem-solving content
          const truncated = truncateTranscript(transcriptResult.transcript, 8000);
          const analysis = await analyzeTranscript(
            truncated,
            topic,
            description || '',
            learning_objective || ''
          );
          
          analyzedResources.push({
            ...resource,
            transcript_analyzed: true,
            transcript_source: transcriptResult.source,
            content_analysis: analysis,
            analysis_confidence: analysis.relevance_score,
          });
          
          console.log(`[search-problem-walkthroughs] Analyzed: ${resource.title} (confidence: ${analysis.relevance_score})`);
        } else {
          // Fallback to metadata analysis
          const analysis = await analyzeMetadata(
            resource.title,
            resource.description,
            topic,
            description || '',
            learning_objective || ''
          );
          
          analyzedResources.push({
            ...resource,
            transcript_analyzed: false,
            transcript_source: 'metadata_only',
            content_analysis: analysis,
            analysis_confidence: analysis.relevance_score,
          });
          
          console.log(`[search-problem-walkthroughs] Metadata only: ${resource.title}`);
        }
      } catch (error) {
        console.error(`[search-problem-walkthroughs] Error analyzing resource:`, error);
        analyzedResources.push(resource);
      }
    }

    // Sort by analysis confidence
    analyzedResources.sort((a, b) => (b.analysis_confidence || 0) - (a.analysis_confidence || 0));

    // Generate contextual explanations for the resources
    console.log('[search-problem-walkthroughs] Generating resource explanations...');
    try {
      const explanationResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2048,
          temperature: 0.4,
          system: PROMPTS.resourceExplanation.system,
          messages: [{
            role: 'user',
            content: PROMPTS.resourceExplanation.user(
              topic,
              description,
              learning_objective,
              analyzedResources.map(r => ({
                url: r.url,
                title: r.title,
                channel_name: r.channel_name,
                description: r.description,
                concepts_covered: r.content_analysis?.concepts_taught || r.concepts_covered,
                difficulty_level: r.difficulty_level,
              }))
            ),
          }],
        }),
      });

      if (explanationResponse.ok) {
        const explanationData = await explanationResponse.json();
        const explanationText = explanationData.content?.[0]?.text;
        
        if (explanationText) {
          const explanations = JSON.parse(explanationText);
          
          // Match explanations to resources by URL
          for (const resource of analyzedResources) {
            const explanation = explanations.explanations?.find((e: any) => e.url === resource.url);
            if (explanation) {
              resource.resource_explanation = explanation.explanation;
            }
          }
        }
      }
    } catch (error) {
      console.error('[search-problem-walkthroughs] Error generating explanations:', error);
    }

    // Store resources in database with is_problem_walkthrough=true
    console.log('[search-problem-walkthroughs] Storing resources in database...');
    
    for (const resource of analyzedResources) {
      try {
        // Generate embedding for the resource
        const embeddingText = createRichSignatureText(
          resource.title,
          resource.description,
          resource.content_analysis?.concepts_taught || resource.concepts_covered,
          resource.difficulty_level
        );
        
        const embedding = await generateEmbedding(embeddingText);
        const embeddingVector = formatVectorForPostgres(embedding);

        // Store in curated_resources
        const { data: curatedResource, error: curatedError } = await supabase
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
            topic_signature: resource.topic_signature,
            concepts_covered: resource.concepts_covered,
            difficulty_level: resource.difficulty_level,
            quality_score: resource.quality_score,
            embedding: embeddingVector,
            transcript_analyzed: resource.transcript_analyzed,
            transcript_source: resource.transcript_source,
            content_analysis: resource.content_analysis,
          }, {
            onConflict: 'url',
          })
          .select()
          .single();

        if (curatedError) {
          console.error('[search-problem-walkthroughs] Error storing curated resource:', curatedError);
          continue;
        }

        // Link to blueprint with is_problem_walkthrough=true
        const { error: linkError } = await supabase
          .from('blueprint_topic_resources')
          .insert({
            blueprint_id,
            unit_id,
            resource_id: curatedResource.id,
            relevance_score: resource.analysis_confidence || resource.quality_score,
            from_cache: resource.from_cache,
            resource_explanation: resource.resource_explanation,
            is_problem_walkthrough: true, // Mark as problem walkthrough
          });

        if (linkError) {
          console.error('[search-problem-walkthroughs] Error linking resource:', linkError);
        }
      } catch (error) {
        console.error('[search-problem-walkthroughs] Error storing resource:', error);
      }
    }

    console.log('[search-problem-walkthroughs] Complete!');

    return new Response(
      JSON.stringify({ 
        success: true,
        resources: analyzedResources,
        search_metadata: {
          queries_used: problem_solving_queries.map(q => q.query),
          search_method: 'youtube_api',
          total_results: analyzedResources.length,
        },
        analysis_metadata: {
          transcript_count: analyzedResources.filter(r => r.transcript_analyzed).length,
          metadata_only_count: analyzedResources.filter(r => !r.transcript_analyzed).length,
          average_confidence: analyzedResources.reduce((sum, r) => sum + (r.analysis_confidence || 0), 0) / analyzedResources.length,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[search-problem-walkthroughs] Error:', error);
    
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

