// ============================================================================
// ANALYZE WITH CLAUDE ATOMIC FUNCTION
// ============================================================================
// Calls Claude API with vision for document analysis
// Extracted from analyze-document/index.ts lines 454-462
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { callClaudeWithPDFAndText } from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';
import type { AnalyzeWithClaudeInput, AnalyzeWithClaudeOutput, FunctionError, AnalysisResult } from '../_shared/types.ts';

/**
 * Main handler - analyzes with Claude
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: AnalyzeWithClaudeInput = await req.json();
    
    if (!input.pdf_base64 && !input.text) {
      return errorResponse({
        error: 'At least one of pdf_base64 or text is required',
        code: 'INVALID_INPUT',
        details: { fields: ['pdf_base64', 'text'] },
      });
    }

    if (!input.task_type || input.task_type.trim().length === 0) {
      return errorResponse({
        error: 'task_type is required',
        code: 'INVALID_INPUT',
        details: { field: 'task_type' },
      });
    }

    console.log('[analyze-with-claude] Calling Claude...');
    console.log('  - Has PDF:', !!input.pdf_base64);
    console.log('  - Has text:', !!input.text);
    console.log('  - Task type:', input.task_type);

    // Prepare PDF document if provided
    let pdfDocument = null;
    if (input.pdf_base64) {
      pdfDocument = {
        base64Data: input.pdf_base64,
        mediaType: 'application/pdf' as const,
        filename: 'document.pdf',
      };
    }

    // Call Claude with retry
    let analysis: AnalysisResult;
    let retryCount = 0;
    const maxRetries = 1;

    while (true) {
      try {
        analysis = await callClaudeWithPDFAndText<AnalysisResult>(
          PROMPTS.documentAnalysis.system,
          PROMPTS.documentAnalysis.user('', input.task_type),
          pdfDocument,
          input.text || null,
          { temperature: 0.3, maxTokens: 12288 }
        );
        break;
      } catch (error) {
        if (retryCount < maxRetries && !error.message.includes('RATE_LIMITED')) {
          console.log(`[analyze-with-claude] Retry ${retryCount + 1}/${maxRetries}`);
          await sleep(2000);
          retryCount++;
        } else {
          throw error;
        }
      }
    }

    const analysisTimeMs = Date.now() - startTime;

    console.log('[analyze-with-claude] Analysis complete');
    console.log('  - Document type:', analysis.document_type);
    console.log('  - Sections:', analysis.sections?.length || 0);
    console.log('  - Time:', analysisTimeMs, 'ms');

    const output: AnalyzeWithClaudeOutput = {
      analysis,
      model: 'claude-haiku-4-5',
      metadata: {
        tokens_used: 0, // Would need to track from API response
        analysis_time_ms: analysisTimeMs,
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
    console.error('[analyze-with-claude] Error:', error);
    
    // Check for rate limiting
    if (error.message?.includes('429') || error.message?.includes('RATE_LIMITED')) {
      return errorResponse({
        error: 'API rate limit exceeded',
        code: 'RATE_LIMITED',
      });
    }

    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'API_ERROR',
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
      status: error.code === 'INVALID_INPUT' ? 400 : error.code === 'RATE_LIMITED' ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Response(resolve => setTimeout(resolve, ms));
}

// Wrap handler with self-healing
serve(withSelfHealing('analyze-with-claude', handler));

