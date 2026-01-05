// ============================================================================
// CACHE STRUCTURE ATOMIC FUNCTION
// ============================================================================
// Stores structure in cache for future reuse
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { cacheNewStructure } from '../_shared/structure-cache.ts';
import type { CacheStructureInput, CacheStructureOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - caches structure
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: CacheStructureInput = await req.json();
    
    if (!input.structure) {
      return errorResponse({
        error: 'structure is required',
        code: 'INVALID_INPUT',
        details: { field: 'structure' },
      });
    }

    if (!input.analysis) {
      return errorResponse({
        error: 'analysis is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis' },
      });
    }

    if (!input.analysis_id || input.analysis_id.trim().length === 0) {
      return errorResponse({
        error: 'analysis_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis_id' },
      });
    }

    console.log('[cache-structure] Caching structure...');
    console.log('  - Title:', input.structure.summary.title);
    console.log('  - Analysis ID:', input.analysis_id);

    // Call shared helper with retry
    let cacheId: string | null = null;
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      try {
        cacheId = await cacheNewStructure(
          input.structure,
          input.analysis,
          input.analysis_id
        );
        break;
      } catch (error) {
        if (retryCount < maxRetries) {
          console.log(`[cache-structure] Retry ${retryCount + 1}/${maxRetries}`);
          await sleep(1000);
          retryCount++;
        } else {
          throw error;
        }
      }
    }

    if (!cacheId) {
      return errorResponse({
        error: 'Failed to cache structure',
        code: 'DATABASE_ERROR',
      });
    }

    console.log('[cache-structure] Structure cached');
    console.log('  - Cache ID:', cacheId);

    const output: CacheStructureOutput = {
      cache_id: cacheId,
      metadata: {
        cached_at: new Date().toISOString(),
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
    console.error('[cache-structure] Error:', error);
    
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

/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Wrap handler with self-healing
serve(withSelfHealing('cache-structure', handler));

