// ============================================================================
// SECTION EMBEDDINGS UTILITY MODULE
// ============================================================================
// Handles embedding generation for section-level caching.
// Determines the appropriate text to embed based on section type:
// - For problems: Use the complete problem_statement
// - For topics: Use topic_summary + concepts_tested
// ============================================================================

import { generateEmbedding } from './embeddings.ts';
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
  
  // Generate the embedding using the shared embeddings utility
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
    
    // Cache ONE entry per section
    // If multiple units were generated for a section, we store them all in cached_unit
    // (typically there should be 1-3 units per section)
    const cachedUnit = units.length === 1 ? units[0] : {
      units: units,
      primary_unit: units[0] // First unit is the primary one
    };
    
    sectionsToCache.push({
      section_id: sectionWithEmbedding.section_id,
      section_type: sectionWithEmbedding.section_type,
      section_embedding: sectionWithEmbedding.embedding,
      embedding_source: sectionWithEmbedding.embedding_source,
      cached_unit: cachedUnit,
      // Include original section data for database columns
      original_section: sectionWithEmbedding.section_data
    });
    
    console.log(`[section-embeddings] Prepared section ${sectionWithEmbedding.section_id} for caching with ${units.length} unit(s)`);
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


