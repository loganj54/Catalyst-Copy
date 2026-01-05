// ============================================================================
// ORCHESTRATE GENERATE STRUCTURE FUNCTION (SECTION-LEVEL CACHING)
// ============================================================================
// Orchestrates the complete structure generation workflow with section-level caching.
// Checks cache for each section, generates only cache-missed sections, combines results.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { generateAllSectionEmbeddings, prepareSectionsForCache } from '../_shared/section-embeddings.ts';
import type {
  OrchestrateGenerateStructureInput,
  OrchestrateGenerateStructureOutput,
  LearningStructure,
  SectionCacheResult,
  FunctionError
} from '../_shared/types.ts';

/**
 * Main handler - orchestrates section-level structure generation
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const steps: string[] = [];
    
    // Parse and validate input
    const input: OrchestrateGenerateStructureInput = await req.json();
    
    if (!input.blueprint_id) {
      return errorResponse({
        error: 'blueprint_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'blueprint_id' },
      });
    }

    console.log('[orchestrate-generate-structure] Starting section-level generation workflow');
    console.log('  - Blueprint ID:', input.blueprint_id);

    // STEP 1: Fetch analysis
    console.log('[orchestrate-generate-structure] Step 1: Fetching analysis');
    const analysisResponse = await callFunction(req, 'fetch-analysis', {
      blueprint_id: input.blueprint_id
    });
    
    if (!analysisResponse.analysis) {
      throw new Error('Failed to fetch analysis');
    }
    
    const analysis = analysisResponse.analysis;
    const analysisId = analysisResponse.analysis_id;
    steps.push('fetch-analysis');
    
    console.log('  - Analysis fetched:', analysis.subject_area, '-', analysis.specific_topic);
    console.log('  - Sections in analysis:', analysis.sections?.length || 0);

    // STEP 2: Generate embeddings for all sections
    console.log('[orchestrate-generate-structure] Step 2: Generating section embeddings');
    const sectionsWithEmbeddings = await generateAllSectionEmbeddings(analysis);
    steps.push('generate-embeddings');
    
    console.log('  - Embeddings generated for', sectionsWithEmbeddings.length, 'sections');

    // STEP 3: Check cache for each section
    console.log('[orchestrate-generate-structure] Step 3: Checking cache');
    const cacheResponse = await callFunction(req, 'check-structure-cache', {
      analysis,
      threshold: 0.95,
      sections_with_embeddings: sectionsWithEmbeddings
    });
    
    const cacheResults: SectionCacheResult[] = cacheResponse.cache_results || [];
    steps.push('check-structure-cache');
    
    console.log('  - Cache check complete');
    console.log('  - Cache hits:', cacheResponse.cached_sections);
    console.log('  - Cache misses:', cacheResponse.generated_sections);
    console.log('  - Hit rate:', `${(cacheResponse.overall_cache_hit_rate * 100).toFixed(1)}%`);

    // STEP 4: Separate cache hits from misses
    const cachedUnits = new Map<string, any>();
    const sectionsToGenerate: string[] = [];
    
    for (const result of cacheResults) {
      if (result.cache_hit && result.cached_unit) {
        cachedUnits.set(result.section_id, [result.cached_unit]);
      } else {
        sectionsToGenerate.push(result.section_id);
      }
    }

    // STEP 5: Generate structure for cache-missed sections (if any)
    let generatedUnits = new Map<string, any>();
    
    if (sectionsToGenerate.length > 0) {
      console.log('[orchestrate-generate-structure] Step 5: Generating structure for missed sections');
      const generateResponse = await callFunction(req, 'generate-structure-mixed', {
        analysis,
        cache_results: cacheResults,
        sections_to_generate: sectionsToGenerate
      });
      
      generatedUnits = new Map(Object.entries(generateResponse.generated_units || {}));
      steps.push('generate-structure-mixed');
      
      console.log('  - Generated units for', generatedUnits.size, 'sections');
    } else {
      console.log('[orchestrate-generate-structure] Step 5: Skipping generation - all sections cached!');
      steps.push('skip-generation-all-cached');
    }

    // STEP 6: Combine cached and generated units into full structure
    console.log('[orchestrate-generate-structure] Step 6: Combining cached and generated units');
    const fullStructure = combineUnitsIntoStructure(
      analysis,
      cachedUnits,
      generatedUnits,
      cacheResults
    );
    steps.push('combine-units');
    
    console.log('  - Structure combined');
    console.log('  - Total content sections:', fullStructure.content_sections?.length || 0);

    // STEP 7: Process equations (optional - can be skipped if not needed)
    // Note: This step is kept for compatibility but may not be necessary for cached units
    steps.push('skip-process-equations');

    // STEP 8: Source figures (optional - can be skipped if not needed)
    // Note: This step is kept for compatibility but may not be necessary for cached units
    steps.push('skip-source-figures');

    // STEP 9: Store structure
    console.log('[orchestrate-generate-structure] Step 9: Storing structure');
    const storeResponse = await callFunction(req, 'store-structure', {
      blueprint_id: input.blueprint_id,
      structure: fullStructure,
      from_cache: sectionsToGenerate.length === 0 ? 'full' : (cachedUnits.size > 0 ? 'partial' : 'none'),
      cache_metadata: {
        total_sections: cacheResults.length,
        cached_sections: cachedUnits.size,
        generated_sections: sectionsToGenerate.length,
        cache_hit_rate: cacheResponse.overall_cache_hit_rate
      }
    });
    
    const structureId = storeResponse.structure_id;
    steps.push('store-structure');
    
    console.log('  - Structure stored with ID:', structureId);

    // STEP 10: Cache newly generated units
    if (generatedUnits.size > 0) {
      console.log('[orchestrate-generate-structure] Step 10: Caching newly generated units');
      
      // Prepare sections for caching
      const sectionsToCache = prepareSectionsForCache(
        sectionsWithEmbeddings.filter(s => sectionsToGenerate.includes(s.section_id)),
        generatedUnits
      );
      
      await callFunction(req, 'cache-structure', {
        sections_to_cache: sectionsToCache,
        analysis,
        analysis_id: analysisId
      });
      
      steps.push('cache-structure');
      console.log('  - Cached', sectionsToCache.length, 'new sections');
    } else {
      console.log('[orchestrate-generate-structure] Step 10: Skipping cache - no new units generated');
      steps.push('skip-cache-no-new-units');
    }

    const totalTime = Date.now() - startTime;

    console.log('[orchestrate-generate-structure] Workflow complete!');
    console.log('  - Total time:', totalTime, 'ms');
    console.log('  - Steps completed:', steps.length);
    console.log('  - Token savings estimate:', cachedUnits.size * 1000, 'tokens');

    const output: OrchestrateGenerateStructureOutput = {
      structure: fullStructure,
      structure_id: structureId,
      from_cache: sectionsToGenerate.length === 0,
      metadata: {
        total_time_ms: totalTime,
        steps_completed: steps,
        token_savings: cachedUnits.size > 0 ? `~${cachedUnits.size * 1000} tokens saved` : undefined,
        cache_hit_rate: cacheResponse.overall_cache_hit_rate,
        cached_sections: cachedUnits.size,
        generated_sections: sectionsToGenerate.length
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
    console.error('[orchestrate-generate-structure] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'ORCHESTRATION_ERROR',
      details: { stack: error.stack },
    });
  }
};

/**
 * Helper to call another Edge Function
 */
async function callFunction(req: Request, functionName: string, payload: any): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const authHeader = req.headers.get('Authorization');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader || '',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Function ${functionName} failed: ${errorText}`);
  }

  return await response.json();
}

/**
 * Combines cached and generated units into a full learning structure
 */
function combineUnitsIntoStructure(
  analysis: any,
  cachedUnits: Map<string, any[]>,
  generatedUnits: Map<string, any[]>,
  cacheResults: SectionCacheResult[]
): LearningStructure {
  // Create structure summary
  const summary = {
    title: `${analysis.specific_topic} - ${analysis.document_type}`,
    description: `Learning structure for ${analysis.specific_topic}`,
    total_estimated_time_minutes: 0,
    difficulty_progression: analysis.course_level || 'intermediate'
  };

  // Create prerequisites section (if any)
  const prerequisitesSection = {
    description: 'Prerequisites for this material',
    learning_units: []
  };

  // Create content sections by combining cached and generated units
  const contentSections = [];
  
  for (const cacheResult of cacheResults) {
    const sectionId = cacheResult.section_id;
    
    // Get units for this section (either cached or generated)
    const units = cachedUnits.get(sectionId) || generatedUnits.get(sectionId) || [];
    
    if (units.length > 0) {
      // Find the original section from analysis
      const originalSection = analysis.sections?.find((s: any) => s.section_id === sectionId);
      
      contentSections.push({
        section_id: sectionId,
        section_type: cacheResult.section_type,
        title: originalSection?.section_id || sectionId,
        description: originalSection?.topic_summary || originalSection?.problem_statement?.substring(0, 100) || '',
        concepts: originalSection?.concepts_tested || [],
        learning_units: units,
        problem_details: cacheResult.section_type === 'problem' ? {
          original_problem_id: sectionId,
          key_equations: originalSection?.equations_needed || [],
          common_mistakes: originalSection?.common_mistakes || []
        } : undefined
      });
      
      // Add to total time estimate
      for (const unit of units) {
        summary.total_estimated_time_minutes += unit.estimated_time_minutes || 0;
      }
    }
  }

  return {
    summary,
    prerequisites_section: prerequisitesSection,
    content_sections: contentSections
  };
}

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
serve(withSelfHealing('orchestrate-generate-structure', handler));


