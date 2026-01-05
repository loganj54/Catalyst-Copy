// ============================================================================
// STORE STRUCTURE ATOMIC FUNCTION (UPDATED FOR SECTION-LEVEL CACHING)
// ============================================================================
// Stores learning structure in blueprint_structures table.
// Now handles structures that are combinations of cached + generated units.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type {
  StoreStructureInput,
  StoreStructureOutput,
  LearningStructure,
  FunctionError
} from '../_shared/types.ts';

/**
 * Main handler - stores structure in database
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: StoreStructureInput = await req.json();
    
    if (!input.structure) {
      return errorResponse({
        error: 'structure is required',
        code: 'INVALID_INPUT',
        details: { field: 'structure' },
      });
    }

    if (!input.blueprint_id) {
      return errorResponse({
        error: 'blueprint_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'blueprint_id' },
      });
    }

    console.log('[store-structure] Storing learning structure');
    console.log('  - Blueprint ID:', input.blueprint_id);
    console.log('  - From cache:', input.from_cache || 'unknown');

    // Calculate metrics from structure
    const metrics = calculateStructureMetrics(input.structure);
    
    console.log('  - Metrics calculated:');
    console.log('    • Total units:', metrics.total_learning_units);
    console.log('    • Content sections:', metrics.total_content_sections);
    console.log('    • Estimated time:', metrics.estimated_completion_time_minutes, 'min');

    // Prepare structure entry
    const structureEntry = {
      blueprint_id: input.blueprint_id,
      structure: input.structure,
      total_learning_units: metrics.total_learning_units,
      total_content_sections: metrics.total_content_sections,
      estimated_completion_time_minutes: metrics.estimated_completion_time_minutes,
      difficulty_level: input.structure.summary?.difficulty_progression || 'intermediate',
      
      // Cache metadata (NEW for section-level caching)
      from_cache: input.from_cache || false,
      cache_source_id: input.cache_source_id || null,
      cache_similarity: input.cache_similarity || null,
      
      // Section-level cache metadata (NEW)
      cache_metadata: input.cache_metadata || null,
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store in database
    const supabase = createSupabaseClient(req);
    
    const { data, error } = await supabase
      .from('blueprint_structures')
      .insert([structureEntry])
      .select('id')
      .single();

    if (error) {
      console.error('[store-structure] Database error:', error);
      throw new Error(`Failed to store structure: ${error.message}`);
    }

    const structureId = data.id;
    const totalTime = Date.now() - startTime;

    console.log('[store-structure] Structure stored successfully');
    console.log('  - Structure ID:', structureId);
    console.log('  - Time:', totalTime, 'ms');

    // Log cache metrics if available
    if (input.cache_metadata) {
      console.log('  - Cache metrics:');
      console.log('    • Total sections:', input.cache_metadata.total_sections);
      console.log('    • Cached sections:', input.cache_metadata.cached_sections);
      console.log('    • Generated sections:', input.cache_metadata.generated_sections);
      console.log('    • Hit rate:', `${(input.cache_metadata.cache_hit_rate * 100).toFixed(1)}%`);
      
      // Log to section_cache_metrics table
      try {
        await supabase.rpc('log_section_cache_metrics', {
          p_blueprint_id: input.blueprint_id,
          p_structure_id: structureId,
          p_total_sections: input.cache_metadata.total_sections,
          p_cached_sections: input.cache_metadata.cached_sections,
          p_generated_sections: input.cache_metadata.generated_sections,
          p_estimated_tokens_saved: input.cache_metadata.cached_sections * 1000,
          p_estimated_time_saved_ms: input.cache_metadata.cached_sections * 10000
        });
      } catch (metricsError) {
        console.warn('[store-structure] Failed to log cache metrics:', metricsError);
        // Don't fail the whole operation if metrics logging fails
      }
    }

    const output: StoreStructureOutput = {
      structure_id: structureId,
      metadata: {
        stored_at: new Date().toISOString()
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
    console.error('[store-structure] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'STORE_ERROR',
      details: { stack: error.stack },
    });
  }
};

/**
 * Calculates metrics from the learning structure
 */
function calculateStructureMetrics(structure: LearningStructure): {
  total_learning_units: number;
  total_content_sections: number;
  estimated_completion_time_minutes: number;
} {
  let totalUnits = 0;
  let totalTime = 0;

  // Count prerequisite units
  if (structure.prerequisites_section?.learning_units) {
    totalUnits += structure.prerequisites_section.learning_units.length;
    for (const unit of structure.prerequisites_section.learning_units) {
      totalTime += unit.estimated_time_minutes || 0;
    }
  }

  // Count content section units
  const contentSections = structure.content_sections || [];
  for (const section of contentSections) {
    if (section.learning_units) {
      totalUnits += section.learning_units.length;
      for (const unit of section.learning_units) {
        totalTime += unit.estimated_time_minutes || 0;
      }
    }
  }

  return {
    total_learning_units: totalUnits,
    total_content_sections: contentSections.length,
    estimated_completion_time_minutes: totalTime
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
serve(withSelfHealing('store-structure', handler));


