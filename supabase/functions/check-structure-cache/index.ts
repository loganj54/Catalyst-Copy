// ============================================================================
// CHECK STRUCTURE CACHE ATOMIC FUNCTION (SECTION-LEVEL)
// ============================================================================
// Searches for cached learning units at the section level using vector similarity.
// For each section in the analysis, checks if a similar section has been cached.
// Returns cache hits/misses for each section.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { generateAllSectionEmbeddings } from '../_shared/section-embeddings.ts';
import type {
  CheckStructureCacheInput,
  CheckStructureCacheOutput,
  SectionCacheResult,
  SectionWithEmbedding,
  FunctionError
} from '../_shared/types.ts';

/**
 * Main handler - checks cache for each section
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: CheckStructureCacheInput = await req.json();
    
    if (!input.analysis) {
      return errorResponse({
        error: 'analysis is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis' },
      });
    }

    console.log('[check-structure-cache] Starting section-level cache check');
    console.log('  - Document type:', input.analysis.document_type);
    console.log('  - Subject:', input.analysis.subject_area);
    console.log('  - Sections:', input.analysis.sections?.length || 0);

    // Generate embeddings for all sections
    const sectionsWithEmbeddings = await generateAllSectionEmbeddings(input.analysis);
    
    if (sectionsWithEmbeddings.length === 0) {
      console.warn('[check-structure-cache] No valid sections found in analysis');
      return new Response(
        JSON.stringify({
          cache_results: [],
          overall_cache_hit_rate: 0,
          total_sections: 0,
          cached_sections: 0,
          generated_sections: 0
        } as CheckStructureCacheOutput),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[check-structure-cache] Generated embeddings for ${sectionsWithEmbeddings.length} sections`);

    // Search cache for each section
    const cacheResults: SectionCacheResult[] = [];
    const supabase = createSupabaseClient(req);
    const threshold = input.threshold || 0.95;

    for (const sectionWithEmbedding of sectionsWithEmbeddings) {
      const cacheResult = await searchCacheForSection(
        supabase,
        sectionWithEmbedding,
        input.analysis.subject_area,
        input.analysis.document_type,
        threshold
      );
      
      cacheResults.push(cacheResult);
    }

    // Calculate statistics
    const cachedSections = cacheResults.filter(r => r.cache_hit).length;
    const generatedSections = cacheResults.length - cachedSections;
    const cacheHitRate = cacheResults.length > 0 
      ? cachedSections / cacheResults.length 
      : 0;

    const totalTime = Date.now() - startTime;

    console.log('[check-structure-cache] Cache check complete');
    console.log('  - Total sections:', cacheResults.length);
    console.log('  - Cache hits:', cachedSections);
    console.log('  - Cache misses:', generatedSections);
    console.log('  - Hit rate:', `${(cacheHitRate * 100).toFixed(1)}%`);
    console.log('  - Time:', totalTime, 'ms');

    const output: CheckStructureCacheOutput = {
      cache_results: cacheResults,
      overall_cache_hit_rate: cacheHitRate,
      total_sections: cacheResults.length,
      cached_sections: cachedSections,
      generated_sections: generatedSections,
    };

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[check-structure-cache] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'CACHE_CHECK_ERROR',
      details: { stack: error.stack },
    });
  }
};

/**
 * Searches cache for a single section using vector similarity
 */
async function searchCacheForSection(
  supabase: any,
  sectionWithEmbedding: SectionWithEmbedding,
  subjectArea: string,
  documentType: string,
  threshold: number
): Promise<SectionCacheResult> {
  try {
    console.log(`[check-structure-cache] Searching cache for section: ${sectionWithEmbedding.section_id}`);
    
    // Call the database function to search for similar sections
    const { data, error } = await supabase.rpc('search_similar_sections', {
      query_embedding: sectionWithEmbedding.embedding,
      p_section_type: sectionWithEmbedding.section_type,
      p_subject_area: subjectArea,
      p_document_type: documentType,
      similarity_threshold: threshold,
      max_results: 1
    });

    if (error) {
      console.error(`[check-structure-cache] Database error for section ${sectionWithEmbedding.section_id}:`, error);
      // Return cache miss on error
      return {
        section_id: sectionWithEmbedding.section_id,
        section_type: sectionWithEmbedding.section_type,
        cache_hit: false,
      };
    }

    // Check if we got a result
    if (!data || data.length === 0) {
      console.log(`[check-structure-cache] Cache MISS for section ${sectionWithEmbedding.section_id}`);
      return {
        section_id: sectionWithEmbedding.section_id,
        section_type: sectionWithEmbedding.section_type,
        cache_hit: false,
      };
    }

    // Cache hit!
    const cachedEntry = data[0];
    console.log(`[check-structure-cache] Cache HIT for section ${sectionWithEmbedding.section_id}`);
    console.log(`  - Similarity: ${(cachedEntry.similarity * 100).toFixed(2)}%`);
    console.log(`  - Times used: ${cachedEntry.times_used}`);
    console.log(`  - Quality score: ${cachedEntry.quality_score}`);

    // Increment usage counter
    await supabase.rpc('increment_section_cache_usage', {
      cache_id: cachedEntry.id
    });

    return {
      section_id: sectionWithEmbedding.section_id,
      section_type: sectionWithEmbedding.section_type,
      cache_hit: true,
      cached_unit: cachedEntry.cached_unit,
      similarity: cachedEntry.similarity,
      cache_id: cachedEntry.id,
      times_used: cachedEntry.times_used + 1, // Reflect the increment
      quality_score: cachedEntry.quality_score,
    };
  } catch (error) {
    console.error(`[check-structure-cache] Error searching cache for section ${sectionWithEmbedding.section_id}:`, error);
    // Return cache miss on error
    return {
      section_id: sectionWithEmbedding.section_id,
      section_type: sectionWithEmbedding.section_type,
      cache_hit: false,
    };
  }
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
serve(withSelfHealing('check-structure-cache', handler));


