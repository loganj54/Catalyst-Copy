// ============================================================================
// DEPRECATED: SECTION-LEVEL STRUCTURE CACHE HELPERS (OLD VERSION)
// ============================================================================
// THIS FILE IS DEPRECATED - DO NOT USE
// This was an intermediate version. Use the new Edge Functions instead:
// - check-structure-cache
// - cache-structure
// - section-embeddings.ts
// ============================================================================

// Throw error if anyone tries to import this
throw new Error(
  'section-cache.ts is DEPRECATED. Use the new section-level caching Edge Functions instead. ' +
  'See SECTION_LEVEL_CACHING.md for documentation.'
);

import { generateEmbedding, formatVectorForPostgres } from './embeddings.ts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SectionCacheCheckResult {
  hit: boolean;
  cachedStructure: any | null;
  cacheId: string | null;
  similarity: number | null;
  timesUsed: number | null;
  qualityScore: number | null;
}

export interface SectionMetadata {
  subjectArea: string;
  sectionType: 'problem' | 'topic';
  concepts: string[];
  problemCategory: string;
  difficultyLevel: string;
  hasEquations: boolean;
}

// ============================================================================
// CHECK CACHE FOR SIMILAR SECTION STRUCTURE
// ============================================================================

/**
 * Check if a similar learning structure exists for this specific section/problem
 * 
 * @param supabase - Supabase client
 * @param section - Individual section from document analysis
 * @param subjectArea - Subject area (e.g., 'Physics', 'Math')
 * @param similarityThreshold - Minimum similarity (0.88 = 88%)
 * @returns Cache check result with structure if found
 */
export async function checkSectionCache(
  supabase: any,
  section: any,
  subjectArea: string,
  similarityThreshold: number = 0.88
): Promise<SectionCacheCheckResult> {
  try {
    console.log(`[section-cache] Checking cache for section: ${section.section_id}`);
    
    // Extract key information for matching
    const concepts = section.concepts_tested || section.key_concepts || [];
    const sectionType = section.section_type || 'topic';
    
    // Create text representations for embeddings
    const conceptsText = concepts.join(', ');
    const problemTypeText = createProblemTypeText(section);
    const contextText = createContextText(section);
    
    console.log(`[section-cache] Matching on:`);
    console.log(`  - Concepts: ${conceptsText.substring(0, 80)}...`);
    console.log(`  - Problem type: ${problemTypeText}`);
    console.log(`  - Section type: ${sectionType}`);
    
    // Generate embeddings in parallel
    const [conceptsEmb, problemTypeEmb, contextEmb] = await Promise.all([
      generateEmbedding(conceptsText),
      generateEmbedding(problemTypeText),
      generateEmbedding(contextText),
    ]);
    
    // Search for similar cached structures
    const { data: cachedStructures, error } = await supabase.rpc(
      'search_similar_section_structures',
      {
        query_concepts_embedding: formatVectorForPostgres(conceptsEmb.embedding),
        query_problem_type_embedding: formatVectorForPostgres(problemTypeEmb.embedding),
        query_context_embedding: formatVectorForPostgres(contextEmb.embedding),
        p_subject_area: subjectArea,
        p_section_type: sectionType,
        similarity_threshold: similarityThreshold,
        max_results: 1,
      }
    );
    
    if (error) {
      console.error(`[section-cache] Error searching cache:`, error);
      return { hit: false, cachedStructure: null, cacheId: null, similarity: null, timesUsed: null, qualityScore: null };
    }
    
    if (cachedStructures && cachedStructures.length > 0) {
      const cached = cachedStructures[0];
      console.log(`[section-cache] ✅ CACHE HIT for ${section.section_id}!`);
      console.log(`  - Similarity: ${(cached.similarity * 100).toFixed(1)}%`);
      console.log(`  - Times used: ${cached.times_used}`);
      console.log(`  - Quality: ${cached.quality_score.toFixed(2)}`);
      console.log(`  - Token savings: ~3,000 tokens`);
      
      return {
        hit: true,
        cachedStructure: cached.learning_structure,
        cacheId: cached.id,
        similarity: cached.similarity,
        timesUsed: cached.times_used,
        qualityScore: cached.quality_score,
      };
    }
    
    console.log(`[section-cache] ❌ Cache miss for ${section.section_id}`);
    return { hit: false, cachedStructure: null, cacheId: null, similarity: null, timesUsed: null, qualityScore: null };
    
  } catch (error) {
    console.error(`[section-cache] Exception during cache check:`, error);
    return { hit: false, cachedStructure: null, cacheId: null, similarity: null, timesUsed: null, qualityScore: null };
  }
}

// ============================================================================
// ADAPT CACHED SECTION STRUCTURE TO NEW SECTION
// ============================================================================

/**
 * Adapt a cached learning structure to fit a new section
 * 
 * @param cachedStructure - The cached learning_units array
 * @param newSection - The new section to adapt to
 * @returns Adapted learning structure ready for use
 */
export function adaptCachedSectionStructure(
  cachedStructure: any,
  newSection: any
): any {
  console.log(`[section-cache] Adapting cached structure to ${newSection.section_id}`);
  
  // Deep clone to avoid mutations
  const adapted = JSON.parse(JSON.stringify(cachedStructure));
  
  // Update learning units to reference new section's specifics
  if (adapted.learning_units && Array.isArray(adapted.learning_units)) {
    adapted.learning_units = adapted.learning_units.map((unit: any) => {
      // Update unit IDs to be unique for this section
      const newUnitId = `${newSection.section_id}_${unit.unit_type}_${Math.random().toString(36).substring(7)}`;
      
      // Update concepts if new section has specific concepts
      const newConcepts = newSection.concepts_tested || newSection.key_concepts || unit.concepts;
      
      return {
        ...unit,
        unit_id: newUnitId,
        concepts: newConcepts,
        // Keep search_queries and tutor_guidance - they're usually concept-based, not problem-specific
      };
    });
  }
  
  console.log(`[section-cache] ✅ Adapted ${adapted.learning_units?.length || 0} learning units`);
  return adapted;
}

// ============================================================================
// CACHE NEW SECTION STRUCTURE
// ============================================================================

/**
 * Cache a newly generated learning structure for this section
 * 
 * @param supabase - Supabase client
 * @param section - The section from analysis
 * @param learningUnits - The generated learning_units array for this section
 * @param subjectArea - Subject area
 * @param analysisId - ID of the document analysis
 */
export async function cacheSectionStructure(
  supabase: any,
  section: any,
  learningUnits: any[],
  subjectArea: string,
  analysisId: string | null
): Promise<void> {
  try {
    console.log(`[section-cache] Caching structure for ${section.section_id}...`);
    
    // Extract metadata
    const metadata = extractSectionMetadata(section, subjectArea);
    
    // Create text representations for embeddings
    const conceptsText = metadata.concepts.join(', ');
    const problemTypeText = createProblemTypeText(section);
    const contextText = createContextText(section);
    
    // Generate embeddings in parallel
    const [conceptsEmb, problemTypeEmb, contextEmb] = await Promise.all([
      generateEmbedding(conceptsText),
      generateEmbedding(problemTypeText),
      generateEmbedding(contextText),
    ]);
    
    // Insert into cache
    const { data, error } = await supabase
      .from('cached_section_structures')
      .insert({
        concepts_embedding: formatVectorForPostgres(conceptsEmb.embedding),
        problem_type_embedding: formatVectorForPostgres(problemTypeEmb.embedding),
        context_embedding: formatVectorForPostgres(contextEmb.embedding),
        subject_area: metadata.subjectArea,
        section_type: metadata.sectionType,
        concepts: metadata.concepts,
        problem_category: metadata.problemCategory,
        difficulty_level: metadata.difficultyLevel,
        has_equations: metadata.hasEquations,
        learning_structure: { learning_units: learningUnits },
        quality_score: 0.5, // Default, will improve with usage
        source_section_id: section.section_id,
        source_analysis_id: analysisId,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`[section-cache] Error caching structure:`, error);
      return;
    }
    
    console.log(`[section-cache] ✅ Cached structure for ${section.section_id} (ID: ${data.id})`);
    console.log(`[section-cache]   - Concepts: ${metadata.concepts.slice(0, 3).join(', ')}${metadata.concepts.length > 3 ? '...' : ''}`);
    console.log(`[section-cache]   - Type: ${metadata.sectionType}`);
    
  } catch (error) {
    console.error(`[section-cache] Exception caching structure:`, error);
  }
}

// ============================================================================
// INCREMENT SECTION CACHE USAGE
// ============================================================================

/**
 * Increment usage counter for a cached section structure
 * 
 * @param supabase - Supabase client
 * @param cacheId - ID of the cached structure
 */
export async function incrementSectionCacheUsage(
  supabase: any,
  cacheId: string
): Promise<void> {
  try {
    await supabase.rpc('increment_section_cache_usage', { cache_id: cacheId });
    console.log(`[section-cache] Incremented usage for cache ${cacheId}`);
  } catch (error) {
    console.error(`[section-cache] Error incrementing cache usage:`, error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create problem type text for embedding
 */
function createProblemTypeText(section: any): string {
  const parts = [];
  
  // Section type
  parts.push(section.section_type || 'topic');
  
  // Problem category (for problems)
  if (section.solving_approach && section.solving_approach.length > 0) {
    parts.push('calculation problem');
  }
  
  // Has derivation?
  if (section.problem_statement?.toLowerCase().includes('derive') || 
      section.problem_statement?.toLowerCase().includes('proof')) {
    parts.push('derivation');
  }
  
  // Has equations?
  if (section.equations_needed && section.equations_needed.length > 0) {
    parts.push('uses equations');
  }
  
  return parts.join(', ');
}

/**
 * Create context text for embedding
 */
function createContextText(section: any): string {
  const parts = [];
  
  // Difficulty
  if (section.difficulty) {
    parts.push(`difficulty ${section.difficulty}/10`);
  }
  
  // Estimated time
  if (section.estimated_minutes) {
    parts.push(`${section.estimated_minutes} minutes`);
  }
  
  // Has figure?
  if (section.figure_description) {
    parts.push('includes diagram');
  }
  
  // Assumptions
  if (section.assumptions && section.assumptions.length > 0) {
    parts.push(`${section.assumptions.length} assumptions`);
  }
  
  return parts.join(', ');
}

/**
 * Extract section metadata for caching
 */
function extractSectionMetadata(section: any, subjectArea: string): SectionMetadata {
  const concepts = section.concepts_tested || section.key_concepts || [];
  
  // Determine problem category
  let problemCategory = 'general';
  if (section.solving_approach && section.solving_approach.length > 0) {
    problemCategory = 'calculation';
  }
  if (section.problem_statement?.toLowerCase().includes('derive')) {
    problemCategory = 'derivation';
  }
  if (section.problem_statement?.toLowerCase().includes('explain') || 
      section.problem_statement?.toLowerCase().includes('describe')) {
    problemCategory = 'conceptual';
  }
  
  // Determine difficulty level
  let difficultyLevel = 'intermediate';
  if (section.difficulty) {
    if (section.difficulty <= 3) difficultyLevel = 'introductory';
    else if (section.difficulty >= 7) difficultyLevel = 'advanced';
  }
  
  return {
    subjectArea,
    sectionType: section.section_type || 'topic',
    concepts,
    problemCategory,
    difficultyLevel,
    hasEquations: (section.equations_needed?.length || 0) > 0,
  };
}

