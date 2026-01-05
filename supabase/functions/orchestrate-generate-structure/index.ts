// ============================================================================
// ORCHESTRATE GENERATE STRUCTURE
// ============================================================================
// Composes atomic structure functions into complete structure generation workflow
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { OrchestrateGenerateStructureInput, OrchestrateGenerateStructureOutput, FunctionError } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

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
    const input: OrchestrateGenerateStructureInput = await req.json();
    const authHeader = req.headers.get('Authorization') || '';

    if (!input.blueprint_id) {
      return errorResponse({
        error: 'blueprint_id is required',
        code: 'INVALID_INPUT',
      });
    }

    console.log('[orchestrate-generate-structure] Starting workflow');
    console.log('  - Blueprint ID:', input.blueprint_id);

    // Get blueprint info
    const supabase = createSupabaseClient();
    const { data: blueprint, error: bpError } = await supabase
      .from('blueprints')
      .select('user_id')
      .eq('id', input.blueprint_id)
      .single();

    if (bpError || !blueprint) {
      throw new Error('Blueprint not found');
    }

    // STEP 1: Fetch analysis
    console.log('[orchestrate-generate-structure] Step 1: Fetching analysis...');
    const analysisResult = await callFunction('fetch-analysis', {
      blueprint_id: input.blueprint_id,
    }, authHeader);
    stepsCompleted.push('fetch-analysis');

    const analysis = analysisResult.analysis;
    const analysisId = analysisResult.analysis_id;

    // STEP 2: Check structure cache
    console.log('[orchestrate-generate-structure] Step 2: Checking cache...');
    const cacheResult = await callFunction('check-structure-cache', {
      analysis: analysis,
      threshold: 0.92,
    }, authHeader);
    stepsCompleted.push('check-structure-cache');

    let structure;
    let fromCache = false;
    let cacheSourceId = null;

    // STEP 3a: Adapt cached structure OR 3b: Generate new
    if (cacheResult.cache_hit) {
      console.log('[orchestrate-generate-structure] Step 3a: Adapting cached structure...');
      const adaptResult = await callFunction('adapt-cached-structure', {
        cached_structure: cacheResult.cached_structure,
        new_analysis: analysis,
      }, authHeader);
      stepsCompleted.push('adapt-cached-structure');
      structure = adaptResult.adapted_structure;
      fromCache = true;
      cacheSourceId = cacheResult.cache_id;
    } else {
      console.log('[orchestrate-generate-structure] Step 3b: Generating structure with AI...');
      const generateResult = await callFunction('generate-structure-with-ai', {
        analysis: analysis,
      }, authHeader);
      stepsCompleted.push('generate-structure-with-ai');
      structure = generateResult.structure;
      fromCache = false;
    }

    // STEP 4: Process equations (delegated to shared helper)
    console.log('[orchestrate-generate-structure] Step 4: Processing equations...');
    try {
      await callFunction('process-equations', {
        structure: structure,
        subject_area: analysis.subject_area,
        blueprint_id: input.blueprint_id,
        user_id: blueprint.user_id,
      }, authHeader);
      stepsCompleted.push('process-equations');
    } catch (eqError) {
      console.log('[orchestrate-generate-structure] Equation processing failed, continuing...');
    }

    // STEP 5: Source figures (delegated to shared helper)
    console.log('[orchestrate-generate-structure] Step 5: Sourcing figures...');
    try {
      await callFunction('source-figures', {
        structure: structure,
        subject_area: analysis.subject_area,
        blueprint_id: input.blueprint_id,
        user_id: blueprint.user_id,
      }, authHeader);
      stepsCompleted.push('source-figures');
    } catch (figError) {
      console.log('[orchestrate-generate-structure] Figure sourcing failed, continuing...');
    }

    // STEP 6: Store structure
    console.log('[orchestrate-generate-structure] Step 6: Storing structure...');
    const storeResult = await callFunction('store-structure', {
      structure: structure,
      blueprint_id: input.blueprint_id,
      analysis_id: analysisId,
      user_id: blueprint.user_id,
      from_cache: fromCache,
      cache_source_id: cacheSourceId,
    }, authHeader);
    stepsCompleted.push('store-structure');

    // STEP 7: Cache structure for future reuse
    console.log('[orchestrate-generate-structure] Step 7: Caching structure...');
    try {
      await callFunction('cache-structure', {
        structure: structure,
        analysis: analysis,
        analysis_id: analysisId,
      }, authHeader);
      stepsCompleted.push('cache-structure');
    } catch (cacheError) {
      console.log('[orchestrate-generate-structure] Structure caching failed, continuing...');
    }

    // Update blueprint status
    await supabase
      .from('blueprints')
      .update({ generation_status: 'complete' })
      .eq('id', input.blueprint_id);

    const totalTimeMs = Date.now() - startTime;
    const tokenSavings = fromCache ? '~90% tokens saved via cache' : 'Full AI generation';

    console.log('[orchestrate-generate-structure] Workflow complete!');
    console.log('  - Steps:', stepsCompleted.length);
    console.log('  - Time:', totalTimeMs, 'ms');
    console.log('  - From cache:', fromCache);

    const output: OrchestrateGenerateStructureOutput = {
      structure: structure,
      structure_id: storeResult.structure_id,
      from_cache: fromCache,
      metadata: {
        total_time_ms: totalTimeMs,
        steps_completed: stepsCompleted,
        token_savings: tokenSavings,
      },
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[orchestrate-generate-structure] Error:', error);
    
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

serve(withSelfHealing('orchestrate-generate-structure', handler));

