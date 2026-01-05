// ============================================================================
// FETCH ANALYSIS ATOMIC FUNCTION
// ============================================================================
// Retrieves document analysis by blueprint_id or document_id
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { FetchAnalysisInput, FetchAnalysisOutput, FunctionError } from '../_shared/types.ts';

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
        error: 'At least one of blueprint_id or document_id is required',
        code: 'INVALID_INPUT',
        details: { fields: ['blueprint_id', 'document_id'] },
      });
    }

    console.log('[fetch-analysis] Fetching analysis...');
    console.log('  - Blueprint ID:', input.blueprint_id || '(not provided)');
    console.log('  - Document ID:', input.document_id || '(not provided)');

    // Create Supabase client
    const supabase = createSupabaseClient();

    let analysis: any = null;
    let retryCount = 0;
    const maxRetries = 1;

    // Strategy 1: Try blueprint_id
    if (input.blueprint_id && !analysis) {
      console.log('[fetch-analysis] Trying blueprint_id...');
      
      while (retryCount <= maxRetries && !analysis) {
        const result = await supabase
          .from('document_analyses')
          .select('*')
          .eq('blueprint_id', input.blueprint_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (result.data) {
          analysis = result.data;
          break;
        }

        if (result.error && retryCount < maxRetries) {
          console.log(`[fetch-analysis] Retry ${retryCount + 1}/${maxRetries}`);
          await sleep(500);
          retryCount++;
        } else {
          break;
        }
      }
    }

    // Strategy 2: Try document_id
    if (input.document_id && !analysis) {
      console.log('[fetch-analysis] Trying document_id...');
      retryCount = 0;
      
      while (retryCount <= maxRetries && !analysis) {
        const result = await supabase
          .from('document_analyses')
          .select('*')
          .eq('document_id', input.document_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (result.data) {
          analysis = result.data;
          break;
        }

        if (result.error && retryCount < maxRetries) {
          console.log(`[fetch-analysis] Retry ${retryCount + 1}/${maxRetries}`);
          await sleep(500);
          retryCount++;
        } else {
          break;
        }
      }
    }

    if (!analysis) {
      console.log('[fetch-analysis] No analysis found');
      return errorResponse({
        error: 'No analysis found for this blueprint/document',
        code: 'NOT_FOUND',
        details: {
          blueprint_id: input.blueprint_id,
          document_id: input.document_id,
        },
      });
    }

    const fetchTimeMs = Date.now() - startTime;

    console.log('[fetch-analysis] Analysis found');
    console.log('  - Analysis ID:', analysis.id);
    console.log('  - Time:', fetchTimeMs, 'ms');

    const output: FetchAnalysisOutput = {
      analysis: analysis.raw_analysis,
      analysis_id: analysis.id,
      metadata: {
        fetch_time_ms: fetchTimeMs,
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
    console.error('[fetch-analysis] Error:', error);
    
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
      status: error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_FOUND' ? 404 : 500,
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
serve(withSelfHealing('fetch-analysis', handler));

