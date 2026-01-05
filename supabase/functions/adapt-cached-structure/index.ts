// ============================================================================
// ADAPT CACHED STRUCTURE ATOMIC FUNCTION
// ============================================================================
// Adapts cached structure to new document using AI
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { adaptCachedStructure } from '../_shared/structure-cache.ts';
import type { AdaptCachedStructureInput, AdaptCachedStructureOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - adapts cached structure
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: AdaptCachedStructureInput = await req.json();
    
    if (!input.cached_structure) {
      return errorResponse({
        error: 'cached_structure is required',
        code: 'INVALID_INPUT',
        details: { field: 'cached_structure' },
      });
    }

    if (!input.new_analysis) {
      return errorResponse({
        error: 'new_analysis is required',
        code: 'INVALID_INPUT',
        details: { field: 'new_analysis' },
      });
    }

    console.log('[adapt-cached-structure] Adapting structure...');
    console.log('  - From:', input.cached_structure.summary.title);
    console.log('  - To:', input.new_analysis.specific_topic);

    // Call shared helper
    const adaptedStructure = await adaptCachedStructure(
      input.cached_structure,
      input.new_analysis
    );

    const adaptationTimeMs = Date.now() - startTime;

    console.log('[adapt-cached-structure] Adaptation complete');
    console.log('  - Time:', adaptationTimeMs, 'ms');

    const output: AdaptCachedStructureOutput = {
      adapted_structure: adaptedStructure,
      metadata: {
        adaptation_time_ms: adaptationTimeMs,
        changes_made: ['Structure adapted to new analysis'],
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
    console.error('[adapt-cached-structure] Error:', error);
    
    // Fallback: return original structure
    if (input?.cached_structure) {
      const output: AdaptCachedStructureOutput = {
        adapted_structure: input.cached_structure,
        metadata: {
          adaptation_time_ms: 0,
          changes_made: ['Adaptation failed, returned original'],
        },
      };

      return new Response(
        JSON.stringify(output),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
serve(withSelfHealing('adapt-cached-structure', handler));

