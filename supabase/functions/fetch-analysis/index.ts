// ============================================================================
// FETCH ANALYSIS ATOMIC FUNCTION
// ============================================================================
// Fetches document analysis from the database for a given blueprint
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type {
  FetchAnalysisInput,
  FetchAnalysisOutput,
  FunctionError
} from '../_shared/types.ts';

/**
 * Main handler - fetches analysis
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: FetchAnalysisInput = await req.json();
    
    if (!input.blueprint_id && !input.document_id) {
      return errorResponse({
        error: 'Either blueprint_id or document_id is required',
        code: 'INVALID_INPUT',
        details: { fields: ['blueprint_id', 'document_id'] },
      });
    }

    console.log('[fetch-analysis] Fetching analysis');
    console.log('  - Blueprint ID:', input.blueprint_id);
    console.log('  - Document ID:', input.document_id);

    const supabase = createSupabaseClient(req);
    let analysis = null;
    let analysisId = null;

    // Strategy 1: Fetch by blueprint_id
    if (input.blueprint_id) {
      const { data: blueprint, error: bpError } = await supabase
        .from('blueprints')
        .select('document_id')
        .eq('id', input.blueprint_id)
        .single();

      if (bpError) {
        console.error('[fetch-analysis] Error fetching blueprint:', bpError);
        throw new Error(`Failed to fetch blueprint: ${bpError.message}`);
      }

      if (blueprint?.document_id) {
        const { data: analysisData, error: analysisError } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('document_id', blueprint.document_id)
          .single();

        if (!analysisError && analysisData) {
          analysis = analysisData.analysis;
          analysisId = analysisData.id;
        }
      }
    }

    // Strategy 2: Fetch by document_id
    if (!analysis && input.document_id) {
      const { data: analysisData, error: analysisError } = await supabase
        .from('document_analyses')
        .select('*')
        .eq('document_id', input.document_id)
        .single();

      if (!analysisError && analysisData) {
        analysis = analysisData.analysis;
        analysisId = analysisData.id;
      }
    }

    if (!analysis) {
      return errorResponse({
        error: 'No analysis found for the given blueprint or document',
        code: 'NOT_FOUND',
        details: { 
          blueprint_id: input.blueprint_id,
          document_id: input.document_id
        },
      });
    }

    const fetchTime = Date.now() - startTime;

    console.log('[fetch-analysis] Analysis fetched successfully');
    console.log('  - Analysis ID:', analysisId);
    console.log('  - Document type:', analysis.document_type);
    console.log('  - Sections:', analysis.sections?.length || 0);
    console.log('  - Time:', fetchTime, 'ms');

    const output: FetchAnalysisOutput = {
      analysis,
      analysis_id: analysisId,
      metadata: {
        fetch_time_ms: fetchTime
      }
    };

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[fetch-analysis] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'FETCH_ERROR',
      details: { stack: error.stack },
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
      status: error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_FOUND' ? 404 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Wrap handler with self-healing
serve(withSelfHealing('fetch-analysis', handler));


