// ============================================================================
// CHECK EXISTING ANALYSIS ATOMIC FUNCTION
// ============================================================================
// Checks if document already has analysis in document_analyses table
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { CheckExistingAnalysisInput, CheckExistingAnalysisOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - checks for existing analysis
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: CheckExistingAnalysisInput = await req.json();
    
    if (!input.document_id || input.document_id.trim().length === 0) {
      return errorResponse({
        error: 'document_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'document_id' },
      });
    }

    console.log('[check-existing-analysis] Checking for analysis...');
    console.log('  - Document ID:', input.document_id);

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Query for existing analysis with retry
    let existing;
    let queryError;
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      const result = await supabase
        .from('document_analyses')
        .select('*')
        .eq('document_id', input.document_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      existing = result.data;
      queryError = result.error;

      if (!queryError) {
        break; // Success
      }

      if (retryCount < maxRetries) {
        console.log(`[check-existing-analysis] Retry ${retryCount + 1}/${maxRetries}`);
        await sleep(500);
        retryCount++;
      } else {
        break; // Failed after retries
      }
    }

    if (queryError) {
      console.error('[check-existing-analysis] Database error:', queryError);
      
      // Return exists: false as fallback
      const output: CheckExistingAnalysisOutput = {
        exists: false,
      };

      return new Response(
        JSON.stringify(output),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const exists = !!existing;

    console.log('[check-existing-analysis] Result:', exists ? 'Found' : 'Not found');

    const output: CheckExistingAnalysisOutput = {
      exists,
      ...(existing && {
        analysis_id: existing.id,
        analysis: existing.raw_analysis,
        metadata: {
          created_at: existing.created_at,
        },
      }),
    };

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[check-existing-analysis] Error:', error);
    
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
serve(withSelfHealing('check-existing-analysis', handler));

