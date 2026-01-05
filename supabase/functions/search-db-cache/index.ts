// ============================================================================
// SEARCH DB CACHE ATOMIC FUNCTION
// ============================================================================
// Performs vector similarity search in curated_resources table
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { formatVectorForPostgres } from '../_shared/embeddings.ts';
import type { SearchDbCacheInput, SearchDbCacheOutput, FunctionError } from '../_shared/types.ts';

const TIMEOUT_MS = 5000;

/**
 * Main handler - searches cached resources by vector similarity
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: SearchDbCacheInput = await req.json();
    
    if (!input.embedding || !Array.isArray(input.embedding)) {
      return errorResponse({
        error: 'Embedding field is required and must be an array',
        code: 'INVALID_INPUT',
        details: { field: 'embedding', received: typeof input.embedding },
      });
    }

    if (input.embedding.length !== 1536) {
      return errorResponse({
        error: 'Embedding must be a 1536-dimensional vector',
        code: 'INVALID_INPUT',
        details: { field: 'embedding', length: input.embedding.length, expected: 1536 },
      });
    }

    const threshold = input.threshold ?? 0.95;
    const maxResults = input.max_results ?? 3;

    if (threshold < 0 || threshold > 1) {
      return errorResponse({
        error: 'Threshold must be between 0 and 1',
        code: 'INVALID_INPUT',
        details: { field: 'threshold', value: threshold },
      });
    }

    if (maxResults < 1 || maxResults > 50) {
      return errorResponse({
        error: 'max_results must be between 1 and 50',
        code: 'INVALID_INPUT',
        details: { field: 'max_results', value: maxResults },
      });
    }

    console.log('[search-db-cache] Searching cache...');
    console.log(`  - Threshold: ${threshold}`);
    console.log(`  - Max results: ${maxResults}`);

    // Format embedding for PostgreSQL
    const vectorString = formatVectorForPostgres(input.embedding);

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Call RPC function with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let cachedResources;
    let searchError;

    try {
      const result = await supabase.rpc(
        'search_similar_resources',
        {
          query_embedding: vectorString,
          similarity_threshold: threshold,
          max_results: maxResults,
        }
      );

      cachedResources = result.data;
      searchError = result.error;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`TIMEOUT: Database search exceeded ${TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (searchError) {
      console.error('[search-db-cache] Database error:', searchError);
      return errorResponse({
        error: `Database error: ${searchError.message}`,
        code: 'DATABASE_ERROR',
        details: searchError,
      });
    }

    const searchTimeMs = Date.now() - startTime;
    const cacheHit = cachedResources && cachedResources.length > 0;

    console.log(`[search-db-cache] Search complete in ${searchTimeMs}ms`);
    console.log(`  - Cache hit: ${cacheHit}`);
    console.log(`  - Results found: ${cachedResources?.length || 0}`);

    // Map database results to Resource type
    const resources = (cachedResources || []).map((r: any) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      description: r.description,
      platform: r.platform,
      channel_name: r.channel_name,
      channel_url: r.channel_url,
      thumbnail_url: r.thumbnail_url,
      duration_seconds: r.duration_seconds,
      topic_signature: r.topic_signature,
      concepts_covered: r.concepts_covered || [],
      difficulty_level: r.difficulty_level,
      quality_score: r.quality_score,
      similarity: r.similarity,
      from_cache: true,
      transcript_analyzed: r.transcript_analyzed,
      transcript_source: r.transcript_source,
      content_analysis: r.content_analysis,
      analysis_confidence: r.analysis_confidence,
    }));

    // Extract similarity scores
    const similarityScores = resources.map(r => r.similarity || 0);

    const output: SearchDbCacheOutput = {
      resources,
      cache_hit: cacheHit,
      similarity_scores: similarityScores,
      metadata: {
        search_time_ms: searchTimeMs,
        total_matches: resources.length,
      },
    };

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[search-db-cache] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Helper to create error response
 */
function errorResponse(error: FunctionError): Response {
  return new Response(
    JSON.stringify(error),
    {
      status: error.code === 'INVALID_INPUT' ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Wrap handler with self-healing
serve(withSelfHealing('search-db-cache', handler));

