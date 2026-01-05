// ============================================================================
// CHECK STRUCTURE CACHE ATOMIC FUNCTION
// ============================================================================
// Checks for similar cached learning structure via vector similarity
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { checkStructureCache } from '../_shared/structure-cache.ts';
import type { CheckStructureCacheInput, CheckStructureCacheOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - checks structure cache
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: CheckStructureCacheInput = await req.json();
    
    if (!input.analysis) {
      return errorResponse({
        error: 'analysis is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis' },
      });
    }

    const threshold = input.threshold ?? 0.92;
    
    if (threshold < 0 || threshold > 1) {
      return errorResponse({
        error: 'threshold must be between 0 and 1',
        code: 'INVALID_INPUT',
        details: { field: 'threshold', value: threshold },
      });
    }

    console.log('[check-structure-cache] Checking cache...');
    console.log('  - Subject:', input.analysis.subject_area);
    console.log('  - Topic:', input.analysis.specific_topic);
    console.log('  - Threshold:', threshold);

    // Call shared helper
    const cacheResult = await checkStructureCache(input.analysis, threshold);

    if (cacheResult.cache_hit) {
      console.log('[check-structure-cache] Cache HIT!');
      console.log('  - Similarity:', cacheResult.similarity);
      console.log('  - Times used:', cacheResult.times_used);
      console.log('  - Quality:', cacheResult.quality_score);
    } else {
      console.log('[check-structure-cache] Cache miss');
    }

    const output: CheckStructureCacheOutput = cacheResult;

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[check-structure-cache] Error:', error);
    
    // Fallback to cache miss on error
    const output: CheckStructureCacheOutput = {
      cache_hit: false,
    };

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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
serve(withSelfHealing('check-structure-cache', handler));

