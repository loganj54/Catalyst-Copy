// ============================================================================
// ORCHESTRATE ANALYZE DOCUMENT
// ============================================================================
// Composes atomic analysis functions into complete document analysis workflow
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { OrchestrateAnalyzeDocumentInput, OrchestrateAnalyzeDocumentOutput, FunctionError } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

/**
 * Call an atomic edge function
 */
async function callFunction(functionName: string, input: any, authHeader: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${functionName} failed: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Main orchestrator handler
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();
  const stepsCompleted: string[] = [];

  try {
    const input: OrchestrateAnalyzeDocumentInput = await req.json();
    const authHeader = req.headers.get('Authorization') || '';

    if (!input.blueprint_id) {
      return errorResponse({
        error: 'blueprint_id is required',
        code: 'INVALID_INPUT',
      });
    }

    console.log('[orchestrate-analyze-document] Starting workflow');
    console.log('  - Blueprint ID:', input.blueprint_id);
    console.log('  - Force reanalyze:', input.force_reanalyze || false);

    // Get blueprint to find document_id
    const supabase = createSupabaseClient();
    const { data: blueprint, error: bpError } = await supabase
      .from('blueprints')
      .select('document_id, file_metadata, content, user_id')
      .eq('id', input.blueprint_id)
      .single();

    if (bpError || !blueprint) {
      throw new Error('Blueprint not found');
    }

    const documentId = blueprint.document_id;

    // STEP 1: Check if analysis already exists
    if (documentId && !input.force_reanalyze) {
      console.log('[orchestrate-analyze-document] Step 1: Checking for existing analysis...');
      try {
        const existingCheck = await callFunction('check-existing-analysis', {
          document_id: documentId,
        }, authHeader);

        stepsCompleted.push('check-existing-analysis');

        if (existingCheck.exists) {
          console.log('[orchestrate-analyze-document] Using existing analysis');
          const totalTimeMs = Date.now() - startTime;

          const output: OrchestrateAnalyzeDocumentOutput = {
            analysis: existingCheck.analysis,
            analysis_id: existingCheck.analysis_id,
            reused: true,
            metadata: {
              total_time_ms: totalTimeMs,
              steps_completed: stepsCompleted,
            },
          };

          return new Response(JSON.stringify(output), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.log('[orchestrate-analyze-document] No existing analysis found, continuing...');
      }
    }

    // STEP 2: Fetch document from storage
    const fileUrl = blueprint.file_metadata?.url;
    let pdfBase64: string | undefined;
    let textContent: string | undefined;

    if (fileUrl) {
      console.log('[orchestrate-analyze-document] Step 2: Fetching document...');
      const fetchResult = await callFunction('fetch-document', {
        file_url: fileUrl,
      }, authHeader);
      stepsCompleted.push('fetch-document');

      // STEP 3: Parse PDF if needed
      if (fetchResult.content_type.includes('pdf')) {
        console.log('[orchestrate-analyze-document] Step 3: Parsing PDF...');
        const parseResult = await callFunction('parse-pdf-to-base64', {
          pdf_buffer: fetchResult.content,
        }, authHeader);
        stepsCompleted.push('parse-pdf-to-base64');
        pdfBase64 = parseResult.base64;
      } else {
        textContent = fetchResult.content;
      }
    }

    // Get text from blueprint if no file
    if (!pdfBase64 && !textContent) {
      textContent = blueprint.content?.textInput || blueprint.content?.description || '';
    }

    if (!pdfBase64 && !textContent) {
      throw new Error('No content available for analysis');
    }

    // STEP 4: Analyze with Claude
    console.log('[orchestrate-analyze-document] Step 4: Analyzing with Claude...');
    const analysisResult = await callFunction('analyze-with-claude', {
      pdf_base64: pdfBase64,
      text: textContent,
      task_type: blueprint.task_type || 'homework',
    }, authHeader);
    stepsCompleted.push('analyze-with-claude');

    // STEP 5: Store analysis
    console.log('[orchestrate-analyze-document] Step 5: Storing analysis...');
    const storeResult = await callFunction('store-analysis', {
      analysis: analysisResult.analysis,
      document_id: documentId || null,
      user_id: blueprint.user_id,
      blueprint_id: input.blueprint_id,
      source_type: pdfBase64 ? 'pdf' : 'text',
    }, authHeader);
    stepsCompleted.push('store-analysis');

    // STEP 6: Generate blueprint name
    console.log('[orchestrate-analyze-document] Step 6: Generating name...');
    try {
      const nameResult = await callFunction('generate-blueprint-name', {
        analysis: analysisResult.analysis,
        current_title: 'Untitled Blueprint',
      }, authHeader);
      stepsCompleted.push('generate-blueprint-name');

      // Update blueprint with generated name
      await supabase
        .from('blueprints')
        .update({ 
          title: nameResult.blueprint_name,
          generation_status: 'analyzed',
        })
        .eq('id', input.blueprint_id);
    } catch (nameError) {
      console.log('[orchestrate-analyze-document] Name generation failed, continuing...');
    }

    const totalTimeMs = Date.now() - startTime;

    console.log('[orchestrate-analyze-document] Workflow complete!');
    console.log('  - Steps:', stepsCompleted.length);
    console.log('  - Time:', totalTimeMs, 'ms');

    const output: OrchestrateAnalyzeDocumentOutput = {
      analysis: analysisResult.analysis,
      analysis_id: storeResult.analysis_id,
      reused: false,
      metadata: {
        total_time_ms: totalTimeMs,
        steps_completed: stepsCompleted,
      },
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[orchestrate-analyze-document] Error:', error);
    
    return errorResponse({
      error: error.message || 'Workflow failed',
      code: 'INTERNAL_ERROR',
      details: { steps_completed: stepsCompleted },
    });
  }
};

function errorResponse(error: FunctionError): Response {
  return new Response(JSON.stringify(error), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(withSelfHealing('orchestrate-analyze-document', handler));

