// ============================================================================
// CACHE STRUCTURE ATOMIC FUNCTION (SECTION-LEVEL)
// ============================================================================
// Stores newly generated learning units in the cache for future reuse.
// Each section is cached individually with its embedding for granular matching.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type {
  CacheStructureInput,
  CacheStructureOutput,
  SectionToCache,
  FunctionError
} from '../_shared/types.ts';

/**
 * Main handler - caches newly generated sections
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: CacheStructureInput = await req.json();
    
    if (!input.sections_to_cache || !Array.isArray(input.sections_to_cache)) {
      return errorResponse({
        error: 'sections_to_cache array is required',
        code: 'INVALID_INPUT',
        details: { field: 'sections_to_cache' },
      });
    }

    if (!input.analysis) {
      return errorResponse({
        error: 'analysis is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis' },
      });
    }

    console.log('[cache-structure] Starting section-level caching');
    console.log('  - Sections to cache:', input.sections_to_cache.length);
    console.log('  - Subject:', input.analysis.subject_area);
    console.log('  - Document type:', input.analysis.document_type);

    if (input.sections_to_cache.length === 0) {
      console.log('[cache-structure] No sections to cache');
      return new Response(
        JSON.stringify({
          cached_sections: 0,
          cache_ids: [],
          metadata: {
            cached_at: new Date().toISOString()
          }
        } as CacheStructureOutput),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Cache each section
    const supabase = createSupabaseClient(req);
    const cacheIds: string[] = [];

    for (const sectionToCache of input.sections_to_cache) {
      try {
        const cacheId = await cacheSingleSection(
          supabase,
          sectionToCache,
          input.analysis,
          input.analysis_id
        );
        
        if (cacheId) {
          cacheIds.push(cacheId);
          console.log(`[cache-structure] ✅ Section ${sectionToCache.section_id} cached with ID: ${cacheId}`);
        }
      } catch (error) {
        console.error(`[cache-structure] ❌ Error caching section ${sectionToCache.section_id}:`, error);
        // Continue with other sections even if one fails
      }
    }
    
    console.log(`[cache-structure] Caching summary:`);
    console.log(`  - Attempted: ${input.sections_to_cache.length}`);
    console.log(`  - Successful: ${cacheIds.length}`);
    console.log(`  - Failed: ${input.sections_to_cache.length - cacheIds.length}`);

    const totalTime = Date.now() - startTime;

    console.log('[cache-structure] Caching complete');
    console.log('  - Successfully cached:', cacheIds.length);
    console.log('  - Failed:', input.sections_to_cache.length - cacheIds.length);
    console.log('  - Time:', totalTime, 'ms');

    const output: CacheStructureOutput = {
      cached_sections: cacheIds.length,
      cache_ids: cacheIds,
      metadata: {
        cached_at: new Date().toISOString()
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
    console.error('[cache-structure] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'CACHE_ERROR',
      details: { stack: error.stack },
    });
  }
};

/**
 * Caches a single section in the database with full details
 */
async function cacheSingleSection(
  supabase: any,
  sectionToCache: SectionToCache,
  analysis: any,
  analysisId: string
): Promise<string | null> {
  console.log(`[cache-structure] Caching section: ${sectionToCache.section_id}`);
  
  // Get the section data from the sectionToCache (passed from prepareSectionsForCache)
  // or fall back to finding it in the analysis
  const originalSection = (sectionToCache as any).original_section || 
    analysis.sections?.find((s: any) => s.section_id === sectionToCache.section_id);
  
  if (!originalSection) {
    console.warn(`[cache-structure] Could not find original section data for ${sectionToCache.section_id}`);
    console.warn(`  - This may cause missing problem_statement_text or topic_summary_text`);
  }
  
  // Prepare the cache entry with ALL required fields
  const cacheEntry: any = {
    // Section identification
    section_id: sectionToCache.section_id,
    section_type: sectionToCache.section_type,
    section_title: sectionToCache.cached_unit?.topic || sectionToCache.section_id,
    
    // Primary embedding for similarity search
    primary_embedding: sectionToCache.section_embedding,
    embedding_source: sectionToCache.embedding_source,
    
    // The cached learning unit (the generated structure for this section)
    cached_unit: sectionToCache.cached_unit,
    
    // Concepts tested (common to both problems and topics)
    concepts_tested: originalSection?.concepts_tested || [],
    
    // Metadata from analysis (for filtering)
    subject_area: analysis.subject_area,
    specific_topic: analysis.specific_topic,
    document_type: analysis.document_type,
    course_level: analysis.course_level,
    
    // Quality metrics (initialized)
    times_used: 0,
    quality_score: 1.0,
    
    // Source tracking
    source_analysis_id: analysisId,
    
    // Timestamps
    created_at: new Date().toISOString(),
    last_used_at: new Date().toISOString()
  };
  
  // Add problem-specific fields if this is a problem
  if (sectionToCache.section_type === 'problem' && originalSection) {
    cacheEntry.problem_statement_text = originalSection.problem_statement || null;
    cacheEntry.problem_statement_embedding = sectionToCache.section_embedding; // Same as primary
    cacheEntry.topic_summary_text = null;
    cacheEntry.topic_summary_embedding = null;
  }
  
  // Add topic-specific fields if this is a topic
  if (sectionToCache.section_type === 'topic' && originalSection) {
    cacheEntry.problem_statement_text = null;
    cacheEntry.problem_statement_embedding = null;
    cacheEntry.topic_summary_text = originalSection.topic_summary || null;
    cacheEntry.topic_summary_embedding = sectionToCache.section_embedding; // Same as primary
  }

  console.log(`[cache-structure] Cache entry prepared for ${sectionToCache.section_id}:`);
  console.log(`  - Section type: ${cacheEntry.section_type}`);
  console.log(`  - Section title: ${cacheEntry.section_title}`);
  console.log(`  - Has primary embedding: ${!!cacheEntry.primary_embedding}`);
  console.log(`  - Concepts tested: ${cacheEntry.concepts_tested?.length || 0}`);
  if (cacheEntry.section_type === 'problem') {
    console.log(`  - Problem statement length: ${cacheEntry.problem_statement_text?.length || 0} chars`);
  } else {
    console.log(`  - Topic summary length: ${cacheEntry.topic_summary_text?.length || 0} chars`);
  }

  // Insert into cached_blueprint_structures (ONE ROW PER SECTION)
  const { data, error } = await supabase
    .from('cached_blueprint_structures')
    .insert([cacheEntry])
    .select('id')
    .single();

  if (error) {
    console.error(`[cache-structure] Database error for section ${sectionToCache.section_id}:`, error);
    console.error(`  Error details:`, error);
    throw new Error(`Failed to cache section: ${error.message}`);
  }

  console.log(`[cache-structure] ✅ Successfully cached section ${sectionToCache.section_id} with ID ${data.id}`);
  
  return data.id;
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
serve(withSelfHealing('cache-structure', handler));


