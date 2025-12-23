// ============================================================================
// BLUEPRINT STRUCTURE CACHE HELPERS
// ============================================================================
// Helper functions for caching and retrieving blueprint structures
// ============================================================================

import { generateEmbedding, formatVectorForPostgres } from './embeddings.ts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CacheCheckResult {
  hit: boolean;
  cachedStructure: any | null;
  cacheId: string | null;
  similarity: number | null;
  timesUsed: number | null;
  qualityScore: number | null;
}

export interface CacheMetadata {
  subjectArea: string;
  specificTopic: string;
  topics: string[];
  courseLevel: string;
  documentType: string;
  numSections: number;
  numProblems: number;
  hasEquations: boolean;
}

// ============================================================================
// CHECK CACHE FOR SIMILAR STRUCTURE
// ============================================================================

/**
 * Check if a similar blueprint structure exists in the cache
 * 
 * @param supabase - Supabase client
 * @param analysis - Document analysis result
 * @param similarityThreshold - Minimum similarity (0.90 = 90%)
 * @returns Cache check result with structure if found
 */
export async function checkStructureCache(
  supabase: any,
  analysis: any,
  similarityThreshold: number = 0.92
): Promise<CacheCheckResult> {
  try {
    console.log('[cache] Checking for similar blueprint structures...');
    
    // Extract topics from analysis
    const topics = extractTopicsFromAnalysis(analysis);
    
    // Generate embeddings for matching
    const subjectText = analysis.subject_area || 'General';
    const topicsText = topics.join(', ');
    const characteristicsText = createCharacteristicsText(analysis);
    
    console.log('[cache] Generating embeddings for cache search...');
    console.log(`  - Subject: ${subjectText}`);
    console.log(`  - Topics: ${topicsText.substring(0, 100)}...`);
    console.log(`  - Characteristics: ${characteristicsText}`);
    
    // Generate embeddings in parallel
    const [subjectEmb, topicsEmb, charEmb] = await Promise.all([
      generateEmbedding(subjectText),
      generateEmbedding(topicsText),
      generateEmbedding(characteristicsText),
    ]);
    
    // Search for similar cached structures
    const { data: cachedStructures, error } = await supabase.rpc(
      'search_similar_blueprint_structures',
      {
        query_subject_embedding: formatVectorForPostgres(subjectEmb.embedding),
        query_topics_embedding: formatVectorForPostgres(topicsEmb.embedding),
        query_characteristics_embedding: formatVectorForPostgres(charEmb.embedding),
        p_subject_area: analysis.subject_area,
        p_document_type: analysis.document_type || analysis.content_classification?.primary_type,
        similarity_threshold: similarityThreshold,
        max_results: 1,
      }
    );
    
    if (error) {
      console.error('[cache] Error searching cache:', error);
      return { hit: false, cachedStructure: null, cacheId: null, similarity: null, timesUsed: null, qualityScore: null };
    }
    
    if (cachedStructures && cachedStructures.length > 0) {
      const cached = cachedStructures[0];
      console.log(`[cache] ✅ CACHE HIT! Similarity: ${(cached.similarity * 100).toFixed(1)}%`);
      console.log(`[cache]   - Times used: ${cached.times_used}`);
      console.log(`[cache]   - Quality score: ${cached.quality_score.toFixed(2)}`);
      console.log(`[cache]   - Topics: ${JSON.stringify(cached.topics)}`);
      
      return {
        hit: true,
        cachedStructure: cached.structure,
        cacheId: cached.id,
        similarity: cached.similarity,
        timesUsed: cached.times_used,
        qualityScore: cached.quality_score,
      };
    }
    
    console.log('[cache] ❌ Cache miss - no similar structures found');
    return { hit: false, cachedStructure: null, cacheId: null, similarity: null, timesUsed: null, qualityScore: null };
    
  } catch (error) {
    console.error('[cache] Exception during cache check:', error);
    return { hit: false, cachedStructure: null, cacheId: null, similarity: null, timesUsed: null, qualityScore: null };
  }
}

// ============================================================================
// ADAPT CACHED STRUCTURE TO NEW DOCUMENT
// ============================================================================

/**
 * Adapt a cached structure to fit a new document
 * 
 * @param cachedStructure - The cached structure to adapt
 * @param newAnalysis - The analysis of the new document
 * @returns Adapted structure ready for use
 */
export function adaptCachedStructure(
  cachedStructure: any,
  newAnalysis: any
): any {
  console.log('[cache] Adapting cached structure to new document...');
  
  // Deep clone to avoid mutations
  const adapted = JSON.parse(JSON.stringify(cachedStructure));
  
  // Update summary to match new document
  adapted.summary.title = `Learning Path: ${newAnalysis.specific_topic || newAnalysis.subject_area}`;
  adapted.summary.description = `Master ${newAnalysis.specific_topic || newAnalysis.subject_area}`;
  
  // Adapt prerequisites if new document has different prerequisites
  if (newAnalysis.prerequisites && newAnalysis.prerequisites.length > 0) {
    console.log('[cache] Adapting prerequisites...');
    // Keep cached prerequisite structure but update topics
    if (adapted.prerequisites_section?.learning_units) {
      adapted.prerequisites_section.learning_units = adapted.prerequisites_section.learning_units.slice(
        0,
        Math.min(adapted.prerequisites_section.learning_units.length, newAnalysis.prerequisites.length)
      );
    }
  }
  
  // Adapt content sections to match new document
  if (newAnalysis.sections && adapted.content_sections) {
    console.log(`[cache] Adapting ${newAnalysis.sections.length} content sections...`);
    
    adapted.content_sections = adapted.content_sections
      .slice(0, Math.min(adapted.content_sections.length, newAnalysis.sections.length))
      .map((cachedSection: any, idx: number) => {
        const newSection = newAnalysis.sections[idx];
        if (!newSection) return cachedSection;
        
        // Preserve cached structure but update titles and IDs
        return {
          ...cachedSection,
          section_id: newSection.section_id,
          section_type: newSection.section_type,
          title: newSection.section_type === 'problem'
            ? `Problem ${idx + 1}: ${newSection.concepts_tested?.[0] || cachedSection.concepts?.[0] || 'Analysis'}`
            : `Topic ${idx + 1}: ${newSection.key_concepts?.[0] || newSection.topic_summary || cachedSection.concepts?.[0] || 'Study'}`,
          description: newSection.topic_summary || newSection.problem_statement?.substring(0, 150) || cachedSection.description,
          concepts: newSection.concepts_tested || newSection.key_concepts || cachedSection.concepts,
        };
      });
  }
  
  console.log('[cache] ✅ Structure adapted successfully');
  return adapted;
}

// ============================================================================
// STORE NEW STRUCTURE IN CACHE
// ============================================================================

/**
 * Store a newly generated structure in the cache for future reuse
 * 
 * @param supabase - Supabase client
 * @param structure - The generated structure
 * @param analysis - The document analysis
 * @param analysisId - ID of the document analysis record
 */
export async function cacheNewStructure(
  supabase: any,
  structure: any,
  analysis: any,
  analysisId: string | null
): Promise<void> {
  try {
    console.log('[cache] Storing new structure in cache...');
    
    // Extract metadata
    const metadata = extractCacheMetadata(analysis);
    const topics = extractTopicsFromAnalysis(analysis);
    
    // Generate embeddings
    const subjectText = metadata.subjectArea;
    const topicsText = topics.join(', ');
    const characteristicsText = createCharacteristicsText(analysis);
    
    console.log('[cache] Generating embeddings for new cache entry...');
    const [subjectEmb, topicsEmb, charEmb] = await Promise.all([
      generateEmbedding(subjectText),
      generateEmbedding(topicsText),
      generateEmbedding(characteristicsText),
    ]);
    
    // Insert into cache
    const { data, error } = await supabase
      .from('cached_blueprint_structures')
      .insert({
        subject_embedding: formatVectorForPostgres(subjectEmb.embedding),
        topics_embedding: formatVectorForPostgres(topicsEmb.embedding),
        characteristics_embedding: formatVectorForPostgres(charEmb.embedding),
        subject_area: metadata.subjectArea,
        specific_topic: metadata.specificTopic,
        topics: topics,
        course_level: metadata.courseLevel,
        document_type: metadata.documentType,
        num_sections: metadata.numSections,
        num_problems: metadata.numProblems,
        has_equations: metadata.hasEquations,
        structure: structure,
        quality_score: 0.5, // Default, will improve with usage
        source_analysis_id: analysisId,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('[cache] Error storing structure in cache:', error);
      return;
    }
    
    console.log(`[cache] ✅ Structure cached successfully (ID: ${data.id})`);
    console.log(`[cache]   - Subject: ${metadata.subjectArea}`);
    console.log(`[cache]   - Topics: ${topics.slice(0, 3).join(', ')}${topics.length > 3 ? '...' : ''}`);
    
  } catch (error) {
    console.error('[cache] Exception storing structure in cache:', error);
  }
}

// ============================================================================
// INCREMENT CACHE USAGE STATS
// ============================================================================

/**
 * Increment usage counter for a cached structure
 * 
 * @param supabase - Supabase client
 * @param cacheId - ID of the cached structure
 */
export async function incrementCacheUsage(
  supabase: any,
  cacheId: string
): Promise<void> {
  try {
    await supabase.rpc('increment_cache_usage', { cache_id: cacheId });
    console.log(`[cache] Incremented usage counter for cache ${cacheId}`);
  } catch (error) {
    console.error('[cache] Error incrementing cache usage:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract topics from document analysis
 */
function extractTopicsFromAnalysis(analysis: any): string[] {
  const topics = new Set<string>();
  
  // From sections
  if (analysis.sections) {
    for (const section of analysis.sections) {
      // Add concepts tested (for problems)
      if (section.concepts_tested) {
        section.concepts_tested.forEach((c: string) => topics.add(c));
      }
      // Add key concepts (for topics)
      if (section.key_concepts) {
        section.key_concepts.forEach((c: string) => topics.add(c));
      }
    }
  }
  
  // From key equations
  if (analysis.key_equations) {
    analysis.key_equations.forEach((eq: any) => {
      if (eq.name) topics.add(eq.name);
    });
  }
  
  return Array.from(topics).slice(0, 20); // Limit to 20 topics
}

/**
 * Create characteristics text for embedding
 */
function createCharacteristicsText(analysis: any): string {
  const parts = [];
  
  parts.push(analysis.document_type || analysis.content_classification?.primary_type || 'document');
  parts.push(analysis.course_level || 'intermediate');
  parts.push(`${analysis.sections?.length || 0} sections`);
  
  const numProblems = analysis.sections?.filter((s: any) => s.section_type === 'problem').length || 0;
  if (numProblems > 0) {
    parts.push(`${numProblems} problems`);
  }
  
  if (analysis.key_equations && analysis.key_equations.length > 0) {
    parts.push(`${analysis.key_equations.length} equations`);
  }
  
  return parts.join(', ');
}

/**
 * Extract cache metadata from analysis
 */
function extractCacheMetadata(analysis: any): CacheMetadata {
  return {
    subjectArea: analysis.subject_area || 'General',
    specificTopic: analysis.specific_topic || analysis.subject_area || 'Study',
    topics: extractTopicsFromAnalysis(analysis),
    courseLevel: analysis.course_level || 'intermediate',
    documentType: analysis.document_type || analysis.content_classification?.primary_type || 'document',
    numSections: analysis.sections?.length || 0,
    numProblems: analysis.sections?.filter((s: any) => s.section_type === 'problem').length || 0,
    hasEquations: (analysis.key_equations?.length || 0) > 0,
  };
}

