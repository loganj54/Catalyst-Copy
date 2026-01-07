// ============================================================================
// SECTION EMBEDDINGS UTILITY MODULE
// ============================================================================
// Handles embedding generation for section-level caching.
// Determines the appropriate text to embed based on section type:
// - For problems: Use the complete problem_statement
// - For topics: Use topic_summary + concepts_tested
// ============================================================================

import { generateEmbedding } from './embeddings.ts';
import { upsertVectors, queryVectors } from './pinecone-client.ts';
import type { 
  AnalysisResult, 
  AnalysisSection, 
  SectionWithEmbedding 
} from './types.ts';

/**
 * Extracts all sections from the document analysis
 */
export function extractSectionsFromAnalysis(
  analysis: AnalysisResult
): AnalysisSection[] {
  if (!analysis.sections || !Array.isArray(analysis.sections)) {
    console.warn('[section-embeddings] No sections found in analysis');
    return [];
  }

  return analysis.sections.filter(section => {
    // Ensure section has required fields
    if (!section.section_id || !section.section_type) {
      console.warn('[section-embeddings] Section missing required fields:', section);
      return false;
    }
    
    // Ensure section has concepts_tested (required for both types)
    if (!section.concepts_tested || !Array.isArray(section.concepts_tested)) {
      console.warn('[section-embeddings] Section missing concepts_tested:', section.section_id);
      return false;
    }

    return true;
  });
}

/**
 * Gets the appropriate text to embed based on section type
 * 
 * For problems: Use the complete problem statement with all details
 * For topics: Use topic_summary + concepts_tested for richer semantic matching
 */
export function getEmbeddingText(section: AnalysisSection): {
  text: string;
  source: string;
} {
  if (section.section_type === 'problem') {
    // For problems, use the complete problem statement
    if (!section.problem_statement) {
      throw new Error(
        `Section ${section.section_id} is type "problem" but has no problem_statement`
      );
    }
    
    return {
      text: section.problem_statement,
      source: 'problem_statement'
    };
  } else if (section.section_type === 'topic') {
    // For topics, combine topic_summary and concepts_tested
    if (!section.topic_summary) {
      console.warn(
        `[section-embeddings] Section ${section.section_id} is type "topic" but has no topic_summary. Using concepts_tested only.`
      );
    }
    
    const conceptsText = section.concepts_tested.join('. ');
    const summaryText = section.topic_summary || '';
    
    // Combine both for richer semantic matching
    const combinedText = summaryText 
      ? `${summaryText} ${conceptsText}`
      : conceptsText;
    
    return {
      text: combinedText,
      source: 'topic_summary+concepts_tested'
    };
  } else {
    throw new Error(
      `Unknown section_type: ${section.section_type} for section ${section.section_id}`
    );
  }
}

/**
 * Generates an embedding for a single section
 */
export async function generateSectionEmbedding(
  section: AnalysisSection
): Promise<SectionWithEmbedding> {
  const { text, source } = getEmbeddingText(section);
  
  console.log(`[section-embeddings] Generating embedding for ${section.section_id} (${section.section_type})`);
  console.log(`  - Source: ${source}`);
  console.log(`  - Text length: ${text.length} chars`);
  
  // Generate 3072-dim embedding for Pinecone section caching
  const embeddingResponse = await generateEmbedding(text);
  
  // Extract just the embedding array (not the full response object)
  const embedding = embeddingResponse.embedding;
  
  return {
    section_id: section.section_id,
    section_type: section.section_type,
    embedding,
    embedding_source: source,
    section_data: section
  };
}

/**
 * Generates embeddings for all sections in the analysis
 * Processes sections in parallel for speed
 */
export async function generateAllSectionEmbeddings(
  analysis: AnalysisResult
): Promise<SectionWithEmbedding[]> {
  const sections = extractSectionsFromAnalysis(analysis);
  
  if (sections.length === 0) {
    console.warn('[section-embeddings] No valid sections to process');
    return [];
  }
  
  console.log(`[section-embeddings] Generating embeddings for ${sections.length} sections`);
  
  // Generate embeddings in parallel for speed
  const embeddingsPromises = sections.map(section => 
    generateSectionEmbedding(section)
  );
  
  const sectionsWithEmbeddings = await Promise.all(embeddingsPromises);
  
  console.log(`[section-embeddings] Generated ${sectionsWithEmbeddings.length} embeddings`);
  
  return sectionsWithEmbeddings;
}

/**
 * Prepares sections for caching by combining section data with embeddings
 * Used after generating new learning units to prepare them for cache storage
 * 
 * IMPORTANT: This creates ONE cache entry PER SECTION (not per unit)
 * Each section gets its own row in the database with all its details
 * 
 * CRITICAL: Store the COMPLETE learning unit data including:
 * - tutor_guidance (core overview/explanation)
 * - target_resource_profile (description of ideal resource)
 * - target_resource_embedding (pre-computed embedding)
 * - equations (key equations with LaTeX)
 * - search_queries (for resource finding)
 * - All other unit fields
 */
export function prepareSectionsForCache(
  sectionsWithEmbeddings: SectionWithEmbedding[],
  generatedUnits: Map<string, any> // Map of section_id -> LearningUnit[]
): any[] {
  const sectionsToCache = [];
  
  for (const sectionWithEmbedding of sectionsWithEmbeddings) {
    const units = generatedUnits.get(sectionWithEmbedding.section_id);
    
    if (!units || units.length === 0) {
      console.warn(
        `[section-embeddings] No generated units found for section ${sectionWithEmbedding.section_id}`
      );
      continue;
    }
    
    // VERIFY all required fields are present before caching
    console.log(`[section-embeddings] Preparing ${units.length} unit(s) for section ${sectionWithEmbedding.section_id}:`);
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      console.log(`[section-embeddings]   Unit ${i + 1} (${unit.unit_id || 'no-id'}):`);
      console.log(`[section-embeddings]     - topic: ${unit.topic ? '✓' : '✗ MISSING'}`);
      console.log(`[section-embeddings]     - tutor_guidance: ${unit.tutor_guidance ? '✓' : '✗ MISSING'} (${unit.tutor_guidance?.length || 0} chars)`);
      console.log(`[section-embeddings]     - target_resource_profile: ${unit.target_resource_profile ? '✓' : '✗ MISSING'} (${unit.target_resource_profile?.length || 0} chars)`);
      console.log(`[section-embeddings]     - target_resource_embedding: ${unit.target_resource_embedding ? '✓' : '✗ MISSING'} (${unit.target_resource_embedding?.length || 0} dims)`);
      console.log(`[section-embeddings]     - equations: ${unit.equations ? '✓' : '✗'} (${unit.equations?.length || 0} equations)`);
      console.log(`[section-embeddings]     - search_queries: ${unit.search_queries ? '✓' : '✗'} (${unit.search_queries?.length || 0} queries)`);
      
      // Warn if critical fields are missing
      if (!unit.tutor_guidance) {
        console.warn(`[section-embeddings] ⚠️ WARNING: Unit "${unit.topic}" is missing tutor_guidance!`);
      }
      if (!unit.target_resource_profile) {
        console.warn(`[section-embeddings] ⚠️ WARNING: Unit "${unit.topic}" is missing target_resource_profile!`);
      }
    }
    
    // Cache ONE entry per section
    // If multiple units were generated for a section, we store them all in cached_unit
    // (typically there should be 1-3 units per section)
    // IMPORTANT: Store the COMPLETE unit objects with ALL fields
    const cachedUnit = units.length === 1 ? units[0] : {
      units: units,
      primary_unit: units[0] // First unit is the primary one
    };
    
    sectionsToCache.push({
      section_id: sectionWithEmbedding.section_id,
      section_type: sectionWithEmbedding.section_type,
      section_embedding: sectionWithEmbedding.embedding,
      embedding_source: sectionWithEmbedding.embedding_source,
      cached_unit: cachedUnit, // Contains COMPLETE learning unit data
      // Include original section data for database columns
      original_section: sectionWithEmbedding.section_data
    });
    
    console.log(`[section-embeddings] ✅ Prepared section ${sectionWithEmbedding.section_id} for caching with ${units.length} unit(s) (COMPLETE data)`);
  }
  
  console.log(`[section-embeddings] Total sections prepared for caching: ${sectionsToCache.length}`);
  
  return sectionsToCache;
}

/**
 * Validates that a section has all required fields for embedding generation
 */
export function validateSection(section: any): section is AnalysisSection {
  if (!section.section_id || typeof section.section_id !== 'string') {
    return false;
  }
  
  if (!section.section_type || !['problem', 'topic'].includes(section.section_type)) {
    return false;
  }
  
  if (!section.concepts_tested || !Array.isArray(section.concepts_tested)) {
    return false;
  }
  
  // Type-specific validation
  if (section.section_type === 'problem') {
    if (!section.problem_statement || typeof section.problem_statement !== 'string') {
      return false;
    }
  } else if (section.section_type === 'topic') {
    // topic_summary is optional but recommended
    if (section.topic_summary && typeof section.topic_summary !== 'string') {
      return false;
    }
  }
  
  return true;
}

/**
 * Filters and validates sections from analysis
 * Returns only valid sections with detailed logging for invalid ones
 */
export function getValidSections(analysis: AnalysisResult): AnalysisSection[] {
  const sections = extractSectionsFromAnalysis(analysis);
  const validSections: AnalysisSection[] = [];
  
  for (const section of sections) {
    if (validateSection(section)) {
      validSections.push(section);
    } else {
      console.warn('[section-embeddings] Invalid section skipped:', {
        section_id: section.section_id,
        section_type: section.section_type,
        has_problem_statement: !!section.problem_statement,
        has_topic_summary: !!section.topic_summary,
        has_concepts_tested: !!section.concepts_tested
      });
    }
  }
  
  console.log(`[section-embeddings] Validated ${validSections.length}/${sections.length} sections`);
  
  return validSections;
}

/**
 * Store section embeddings in Pinecone for caching
 * @param sectionsWithEmbeddings - Sections with their embeddings
 * @param generatedUnits - Map of section_id to generated learning units
 * @param blueprintId - Blueprint ID for tracking
 * @param supabaseCacheIds - Map of section_id to Supabase cache row ID (for linking)
 */
export async function storeSectionsInPinecone(
  sectionsWithEmbeddings: SectionWithEmbedding[],
  generatedUnits: Map<string, any>,
  blueprintId: string,
  supabaseCacheIds?: Map<string, string>
): Promise<{ stored: number; failed: number }> {
  let stored = 0;
  let failed = 0;
  const vectors: any[] = [];

  for (const sectionWithEmbedding of sectionsWithEmbeddings) {
    const units = generatedUnits.get(sectionWithEmbedding.section_id);
    
    if (!units || units.length === 0) {
      console.warn(`[section-embeddings] No units for section ${sectionWithEmbedding.section_id}, skipping Pinecone storage`);
      failed++;
      continue;
    }

    // Prepare cached unit data (same format as Supabase)
    const cachedUnit = units.length === 1 ? units[0] : {
      units: units,
      primary_unit: units[0]
    };

    // Get the Supabase cache row ID for this section (if provided)
    const supabaseCacheId = supabaseCacheIds?.get(sectionWithEmbedding.section_id);
    
    if (!supabaseCacheId) {
      console.warn(`[section-embeddings] No Supabase cache ID for section ${sectionWithEmbedding.section_id}, skipping Pinecone storage`);
      failed++;
      continue;
    }

    // Create Pinecone vector with cache_id linking to Supabase row
    // CRITICAL: cache_id is the PRIMARY KEY (id column) from cached_blueprint_structures
    // This allows us to fetch the exact cached data: SELECT * FROM cached_blueprint_structures WHERE id = cache_id
    const timestamp = Date.now();
    const pineconeId = `section-${supabaseCacheId}-${timestamp}`;
    vectors.push({
      id: pineconeId,
      values: sectionWithEmbedding.embedding,
      metadata: {
        cache_id: supabaseCacheId, // CRITICAL: Links to Supabase row id
        section_id: sectionWithEmbedding.section_id,
        section_type: sectionWithEmbedding.section_type,
        embedding_source: sectionWithEmbedding.embedding_source,
        timestamp: timestamp.toString(),
        // Store only searchable metadata, not the full cached_unit
        problem_statement: sectionWithEmbedding.section_data.problem_statement?.substring(0, 500),
        topic_summary: sectionWithEmbedding.section_data.topic_summary?.substring(0, 500),
        concepts_tested: sectionWithEmbedding.section_data.concepts_tested?.join(', ').substring(0, 500),
        type: 'section'
      }
    });
  }

  // Batch upsert to Pinecone
  if (vectors.length > 0) {
    try {
      console.log(`[section-embeddings] Upserting ${vectors.length} sections to Pinecone...`);
      await upsertVectors(vectors, 'sections');
      stored = vectors.length;
      console.log(`[section-embeddings] Successfully stored ${stored} sections in Pinecone`);
    } catch (error) {
      console.error('[section-embeddings] Failed to store sections in Pinecone:', error);
      failed = vectors.length;
    }
  }

  return { stored, failed };
}

/**
 * Query Pinecone for similar cached sections
 * Note: Pinecone only stores metadata for matching, not the full cached_unit
 * After finding matches, we need to fetch the full cached_unit from Supabase
 * 
 * The Pinecone vector similarity (≥95%) already validates that the content is
 * semantically similar, so we fetch from Supabase by section_id only.
 * 
 * @param sectionEmbedding - The embedding of the section to match
 * @param sectionType - Type of section (problem/topic)
 * @param similarityThreshold - Minimum similarity score (0-1)
 * @param supabase - Supabase client to fetch full cached_unit
 * @param subjectArea - DEPRECATED: No longer used (kept for backwards compatibility)
 * @param specificTopic - DEPRECATED: No longer used (kept for backwards compatibility)
 * @returns Array of matching cached sections with full data
 */
export async function querySimilarSectionsFromPinecone(
  sectionEmbedding: number[],
  sectionType: string,
  similarityThreshold: number = 0.95,
  supabase?: any,
  subjectArea?: string,
  specificTopic?: string
): Promise<any[]> {
  try {
    console.log(`[section-embeddings] Querying Pinecone for similar ${sectionType} sections...`);
    
    const results = await queryVectors(
      sectionEmbedding,
      5, // Get top 5 matches
      { type: 'section', section_type: sectionType }, // Filter by section type
      'sections',
      true // Include metadata
    );

    if (!results.matches || results.matches.length === 0) {
      console.log('[section-embeddings] No similar sections found in Pinecone');
      return [];
    }

    // Filter by similarity threshold
    const highQualityMatches = results.matches.filter(m => m.score >= similarityThreshold);
    
    if (highQualityMatches.length === 0) {
      console.log(`[section-embeddings] No matches above ${similarityThreshold * 100}% similarity`);
      return [];
    }

    console.log(`[section-embeddings] Found ${highQualityMatches.length} similar sections in Pinecone (>${similarityThreshold * 100}% similarity)`);

    // If we have Supabase client, fetch full cached_unit data
    if (supabase && highQualityMatches.length > 0) {
      // Extract cache_id from Pinecone metadata
      // cache_id is the PRIMARY KEY (id column) from cached_blueprint_structures table
      const cacheIds = highQualityMatches
        .map(m => m.metadata?.cache_id)
        .filter(id => id); // Only include matches that have cache_id
      
      console.log(`[section-embeddings] Found ${cacheIds.length} cache IDs from ${highQualityMatches.length} Pinecone matches`);
      
      if (cacheIds.length > 0) {
        console.log(`[section-embeddings] Fetching cached data from Supabase by cache IDs...`);
        console.log(`[section-embeddings] Cache IDs:`, cacheIds);
        
        // Query Supabase by PRIMARY KEY (id column)
        // This is a direct lookup - no filtering needed!
        // Each cache_id maps to exactly ONE row in cached_blueprint_structures
        const { data: cachedSections, error } = await supabase
          .from('cached_blueprint_structures')
          .select('id, section_id, cached_unit, source_blueprint_id, subject_area, specific_topic')
          .in('id', cacheIds);
        
        if (error) {
          console.error(`[section-embeddings] ❌ Supabase query error:`, error);
          console.error(`[section-embeddings] Error details:`, JSON.stringify(error));
        }
        
        console.log(`[section-embeddings] Supabase query complete. Returned ${cachedSections?.length || 0} rows`);
        
        if (cachedSections && cachedSections.length > 0) {
          console.log(`[section-embeddings] First row sample:`, {
            section_id: cachedSections[0].section_id,
            subject_area: cachedSections[0].subject_area,
            specific_topic: cachedSections[0].specific_topic,
            has_cached_unit: !!cachedSections[0].cached_unit,
            cached_unit_type: typeof cachedSections[0].cached_unit
          });
        }
        
        if (!error && cachedSections && cachedSections.length > 0) {
          console.log(`[section-embeddings] Found ${cachedSections.length} cached sections in Supabase`);
          console.log(`[section-embeddings] Cached sections:`, cachedSections.map(s => `${s.section_id} (ID: ${s.id})`));
          
          // Map Pinecone matches to Supabase data by cache_id
          const validMatches = [];
          
          for (const match of highQualityMatches) {
            const cacheId = match.metadata?.cache_id;
            const matchSectionId = match.metadata?.section_id;
            
            if (!cacheId) {
              console.warn(`[section-embeddings] ⚠️ Pinecone match missing cache_id for section "${matchSectionId}"`);
              continue;
            }
            
            console.log(`[section-embeddings] Looking for cache_id "${cacheId}" (section: "${matchSectionId}")`);
            
            // Match by cache_id (PRIMARY KEY - guaranteed unique)
            const supabaseData = cachedSections.find(s => s.id === cacheId);
            
            if (!supabaseData) {
              console.warn(`[section-embeddings] ❌ No Supabase data found for cache_id "${cacheId}"`);
              console.warn(`[section-embeddings]    Available cache IDs:`, cachedSections.map(s => s.id));
              continue;
            }
            
            console.log(`[section-embeddings] ✅ Retrieved cached section "${matchSectionId}": "${supabaseData.subject_area}" - "${supabaseData.specific_topic}"`);
            
            // VERIFY cached_unit contains data
            const cachedUnit = supabaseData.cached_unit;
            if (!cachedUnit) {
              console.warn(`[section-embeddings] ❌ cached_unit is NULL for section "${matchSectionId}"`);
              continue;
            }
            
            console.log(`[section-embeddings] ✅ Retrieved cached section ${matchSectionId}:`);
            
            // Check if it's a multi-unit or single-unit cache entry
            if (cachedUnit?.units && Array.isArray(cachedUnit.units)) {
              console.log(`[section-embeddings]   - Multi-unit cache: ${cachedUnit.units.length} units`);
              for (let i = 0; i < cachedUnit.units.length; i++) {
                const unit = cachedUnit.units[i];
                console.log(`[section-embeddings]   Unit ${i + 1}: tutor_guidance=${unit.tutor_guidance ? '✓' : '✗'}, target_resource_profile=${unit.target_resource_profile ? '✓' : '✗'}, equations=${unit.equations?.length || 0}`);
              }
            } else if (cachedUnit?.topic) {
              console.log(`[section-embeddings]   - Single-unit cache: "${cachedUnit.topic}"`);
              console.log(`[section-embeddings]   - tutor_guidance: ${cachedUnit.tutor_guidance ? '✓' : '✗ MISSING'} (${cachedUnit.tutor_guidance?.length || 0} chars)`);
              console.log(`[section-embeddings]   - target_resource_profile: ${cachedUnit.target_resource_profile ? '✓' : '✗ MISSING'} (${cachedUnit.target_resource_profile?.length || 0} chars)`);
              console.log(`[section-embeddings]   - equations: ${cachedUnit.equations?.length || 0}`);
              console.log(`[section-embeddings]   - search_queries: ${cachedUnit.search_queries?.length || 0}`);
            } else {
              console.warn(`[section-embeddings] ⚠️ Unexpected cached_unit format:`, Object.keys(cachedUnit || {}));
            }
            
            validMatches.push({
              section_id: matchSectionId,
              section_type: match.metadata?.section_type,
              cached_unit: cachedUnit, // Return COMPLETE cached data
              similarity: match.score,
              source: 'pinecone',
              pinecone_id: match.id,
              cache_id: cacheId // The Supabase row ID
            });
          }
          
          console.log(`[section-embeddings] Returning ${validMatches.length} valid cached sections`);
          return validMatches;
        } else {
          console.warn(`[section-embeddings] ⚠️ No matching sections found in Supabase for cache_ids:`, cacheIds);
        }
      }
    }

    // Fallback: return matches without cached_unit (caller will need to handle)
    return highQualityMatches.map(match => ({
      section_id: match.metadata?.section_id,
      section_type: match.metadata?.section_type,
      cached_unit: null, // Will need to be fetched separately
      similarity: match.score,
      source: 'pinecone',
      pinecone_id: match.id
    }));

  } catch (error) {
    console.error('[section-embeddings] Error querying Pinecone for sections:', error);
    return [];
  }
}


