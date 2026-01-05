// ============================================================================
// STORE STRUCTURE ATOMIC FUNCTION
// ============================================================================
// Stores learning structure in blueprint_structures table
// Extracted from generate-structure/index.ts lines 1129-1157
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { StoreStructureInput, StoreStructureOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - stores structure
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: StoreStructureInput = await req.json();
    
    if (!input.structure) {
      return errorResponse({
        error: 'structure is required',
        code: 'INVALID_INPUT',
        details: { field: 'structure' },
      });
    }

    if (!input.blueprint_id || input.blueprint_id.trim().length === 0) {
      return errorResponse({
        error: 'blueprint_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'blueprint_id' },
      });
    }

    if (!input.analysis_id || input.analysis_id.trim().length === 0) {
      return errorResponse({
        error: 'analysis_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis_id' },
      });
    }

    if (!input.user_id || input.user_id.trim().length === 0) {
      return errorResponse({
        error: 'user_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'user_id' },
      });
    }

    console.log('[store-structure] Storing structure...');
    console.log('  - Blueprint ID:', input.blueprint_id);
    console.log('  - Analysis ID:', input.analysis_id);

    const { structure } = input;

    // Calculate metrics
    const prerequisiteUnits = structure.prerequisites_section?.learning_units?.length || 0;
    const contentSections = structure.content_sections?.length || 0;
    
    let totalLearningUnits = prerequisiteUnits;
    let totalSearchQueries = 0;
    
    for (const unit of structure.prerequisites_section?.learning_units || []) {
      totalSearchQueries += unit.search_queries?.length || 0;
    }
    
    for (const section of structure.content_sections || []) {
      totalLearningUnits += section.learning_units?.length || 0;
      for (const unit of section.learning_units || []) {
        totalSearchQueries += unit.search_queries?.length || 0;
      }
    }

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Build insert data
    const insertData: any = {
      blueprint_id: input.blueprint_id,
      analysis_id: input.analysis_id,
      document_id: input.document_id || null,
      user_id: input.user_id,
      structure_data: structure,
      total_prerequisites: prerequisiteUnits,
      total_sections: contentSections,
      total_learning_units: totalLearningUnits,
      total_search_queries: totalSearchQueries,
      estimated_time_minutes: structure.summary.total_estimated_time_minutes || 0,
      from_cache: input.from_cache || false,
      cache_source_id: input.cache_source_id || null,
    };

    // Insert with retry
    let newStructure;
    let insertError;
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      const result = await supabase
        .from('blueprint_structures')
        .upsert(insertData, {
          onConflict: 'blueprint_id',
        })
        .select('id')
        .single();

      newStructure = result.data;
      insertError = result.error;

      if (!insertError) {
        break;
      }

      if (retryCount < maxRetries) {
        console.log(`[store-structure] Retry ${retryCount + 1}/${maxRetries}`);
        await sleep(1000);
        retryCount++;
      } else {
        break;
      }
    }

    if (insertError) {
      console.error('[store-structure] Database error:', insertError);
      return errorResponse({
        error: `Database error: ${insertError.message}`,
        code: 'DATABASE_ERROR',
        details: insertError,
      });
    }

    const structureId = newStructure?.id;

    console.log('[store-structure] Structure stored successfully');
    console.log('  - Structure ID:', structureId);
    console.log('  - Units:', totalLearningUnits);
    console.log('  - Queries:', totalSearchQueries);

    const output: StoreStructureOutput = {
      structure_id: structureId,
      metadata: {
        stored_at: new Date().toISOString(),
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
    console.error('[store-structure] Error:', error);
    
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
serve(withSelfHealing('store-structure', handler));

