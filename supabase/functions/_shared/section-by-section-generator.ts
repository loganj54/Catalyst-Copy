// ============================================================================
// SECTION-BY-SECTION STRUCTURE GENERATION WITH CACHING
// ============================================================================
// This module generates learning structures section-by-section, checking
// the cache for each section individually. This provides maximum cache hit
// rates since similar problems across different documents can reuse structures.
// ============================================================================

import { callClaudeJSON } from './supabase-client.ts';
import { PROMPTS } from './prompts.ts';
import {
  checkSectionCache,
  adaptCachedSectionStructure,
  cacheSectionStructure,
  incrementSectionCacheUsage,
} from './section-cache.ts';

// ============================================================================
// GENERATE STRUCTURE SECTION-BY-SECTION
// ============================================================================

/**
 * Generate learning structure by processing each section individually,
 * checking cache for each section before generating with AI.
 * 
 * @param supabase - Supabase client
 * @param analysisData - Document analysis
 * @param analysisId - Analysis ID for tracking
 * @returns Complete structure with cache statistics
 */
export async function generateStructureSectionBySection(
  supabase: any,
  analysisData: any,
  analysisId: string | null
): Promise<{
  structure: any;
  cacheStats: {
    totalSections: number;
    cachedSections: number;
    generatedSections: number;
    tokensSaved: number;
    hitRate: number;
  };
}> {
  console.log('[section-by-section] Starting section-by-section generation...');
  
  const subjectArea = analysisData.subject_area || 'General';
  const sections = analysisData.sections || [];
  
  let cachedCount = 0;
  let generatedCount = 0;
  const contentSections = [];
  
  // =========================================================================
  // STEP 1: GENERATE PREREQUISITES (usually AI-generated, rarely cached)
  // =========================================================================
  
  console.log('[section-by-section] Generating prerequisites...');
  const prerequisitesSection = await generatePrerequisitesSection(
    analysisData.prerequisites || []
  );
  
  // =========================================================================
  // STEP 2: PROCESS EACH CONTENT SECTION (check cache first!)
  // =========================================================================
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log(`\n[section-by-section] ========================================`);
    console.log(`[section-by-section] Processing section ${i + 1}/${sections.length}: ${section.section_id}`);
    console.log(`[section-by-section] ========================================`);
    
    // Check cache for this specific section
    const cacheCheck = await checkSectionCache(supabase, section, subjectArea, 0.88);
    
    let learningUnits;
    let fromCache = false;
    let cacheId = null;
    let cacheSimilarity = null;
    
    if (cacheCheck.hit && cacheCheck.cachedStructure) {
      // ✅ CACHE HIT! Adapt and use cached structure
      console.log(`[section-by-section] ✅ Using cached structure for ${section.section_id}`);
      console.log(`[section-by-section]   - Similarity: ${(cacheCheck.similarity! * 100).toFixed(1)}%`);
      console.log(`[section-by-section]   - Token savings: ~3,000 tokens`);
      
      const adaptedStructure = adaptCachedSectionStructure(
        cacheCheck.cachedStructure,
        section
      );
      
      learningUnits = adaptedStructure.learning_units || [];
      fromCache = true;
      cacheId = cacheCheck.cacheId;
      cacheSimilarity = cacheCheck.similarity;
      cachedCount++;
      
      // Increment usage stats
      await incrementSectionCacheUsage(supabase, cacheCheck.cacheId!);
      
    } else {
      // ❌ CACHE MISS - Generate with AI
      console.log(`[section-by-section] ❌ Cache miss - generating with AI for ${section.section_id}`);
      
      learningUnits = await generateSectionLearningUnits(section, subjectArea);
      fromCache = false;
      generatedCount++;
      
      // Cache this new structure for future use
      console.log(`[section-by-section] Caching structure for future reuse...`);
      await cacheSectionStructure(
        supabase,
        section,
        learningUnits,
        subjectArea,
        analysisId
      );
    }
    
    // Build content section with cache metadata
    const contentSection = {
      section_id: section.section_id,
      section_type: section.section_type || 'topic',
      title: createSectionTitle(section, i + 1),
      description: section.topic_summary || section.problem_statement?.substring(0, 150) || '',
      concepts: section.concepts_tested || section.key_concepts || [],
      difficulty: section.difficulty,
      estimated_minutes: section.estimated_minutes,
      learning_units: learningUnits,
      // Cache metadata
      from_cache: fromCache,
      cache_id: cacheId,
      cache_similarity: cacheSimilarity,
    };
    
    contentSections.push(contentSection);
    
    console.log(`[section-by-section] ✅ Section ${section.section_id} complete (${fromCache ? 'CACHED' : 'GENERATED'})`);
  }
  
  // =========================================================================
  // STEP 3: BUILD COMPLETE STRUCTURE
  // =========================================================================
  
  const structure = {
    summary: {
      title: `Learning Path: ${analysisData.specific_topic || analysisData.subject_area}`,
      description: `Master ${analysisData.specific_topic || analysisData.subject_area} through guided learning`,
      document_type: analysisData.document_type,
      total_sections: contentSections.length,
      estimated_total_minutes: contentSections.reduce((sum, s) => sum + (s.estimated_minutes || 0), 0),
    },
    prerequisites_section: prerequisitesSection,
    content_sections: contentSections,
  };
  
  // Calculate cache statistics
  const totalSections = sections.length;
  const hitRate = totalSections > 0 ? cachedCount / totalSections : 0;
  const tokensSaved = cachedCount * 3000; // ~3,000 tokens per section cache hit
  
  const cacheStats = {
    totalSections,
    cachedSections: cachedCount,
    generatedSections: generatedCount,
    tokensSaved,
    hitRate,
  };
  
  console.log(`\n[section-by-section] ========================================`);
  console.log(`[section-by-section] GENERATION COMPLETE`);
  console.log(`[section-by-section] ========================================`);
  console.log(`[section-by-section] Total sections: ${totalSections}`);
  console.log(`[section-by-section] From cache: ${cachedCount} (${(hitRate * 100).toFixed(1)}%)`);
  console.log(`[section-by-section] Generated: ${generatedCount}`);
  console.log(`[section-by-section] Tokens saved: ~${tokensSaved} (~$${(tokensSaved * 0.000025).toFixed(3)})`);
  
  return {
    structure,
    cacheStats,
  };
}

// ============================================================================
// GENERATE LEARNING UNITS FOR A SINGLE SECTION (AI)
// ============================================================================

async function generateSectionLearningUnits(
  section: any,
  subjectArea: string
): Promise<any[]> {
  console.log(`[section-ai] Generating learning units for ${section.section_id} with AI...`);
  
  // Build focused prompt for THIS SPECIFIC SECTION
  const sectionPrompt = {
    subject_area: subjectArea,
    section: section,
    instruction: `Generate learning units for THIS SPECIFIC section only. Include:
1. If section_type is "problem": Create 2-4 concept learning units + 1 walkthrough unit
2. If section_type is "topic": Create 2-4 concept learning units

Each learning unit needs:
- unit_id (unique ID)
- unit_type ("prerequisite" | "topic" | "walkthrough")
- topic (brief topic name)
- description (1-2 sentences)
- tutor_guidance (2-3 sentences, required)
- search_queries (exactly 3, must include "youtube")
- learning_objective (what student will learn)
- estimated_minutes

For problem sections, also create a final walkthrough unit with:
- problem_solving_queries (3 queries for finding similar solved problems)

Keep it concise. Focus on quality over quantity.`,
  };
  
  // Call Claude to generate learning units for this section
  const response = await callClaudeJSON(
    `You are an expert educational curriculum designer. Generate learning units for a single section.`,
    JSON.stringify(sectionPrompt, null, 2),
    { temperature: 0.4, maxTokens: 4096 }
  );
  
  console.log(`[section-ai] Generated ${response.learning_units?.length || 0} learning units`);
  
  return response.learning_units || [];
}

// ============================================================================
// GENERATE PREREQUISITES SECTION
// ============================================================================

async function generatePrerequisitesSection(
  prerequisites: any[]
): Promise<any> {
  if (!prerequisites || prerequisites.length === 0) {
    return {
      title: 'Prerequisites',
      description: 'Foundation concepts for this material',
      learning_units: [],
    };
  }
  
  // For prerequisites, we'll keep the existing generation logic
  // (or implement prerequisite-level caching in the future)
  console.log(`[prereq] Generating ${prerequisites.length} prerequisite units...`);
  
  const learningUnits = prerequisites.slice(0, 5).map((prereq, idx) => ({
    unit_id: `prereq_${idx + 1}`,
    unit_type: 'prerequisite',
    topic: prereq.concept,
    description: prereq.why_needed || `Foundation concept: ${prereq.concept}`,
    tutor_guidance: `This concept is essential background. ${prereq.why_needed || 'Review this before moving forward.'}`,
    learning_objective: `Understand ${prereq.concept} at a ${prereq.difficulty || 'basic'} level`,
    search_queries: [
      `${prereq.concept} introduction youtube tutorial`,
      `${prereq.concept} explained youtube`,
      `${prereq.concept} basics youtube`,
    ],
    estimated_minutes: 15,
    concepts: [prereq.concept],
  }));
  
  return {
    title: 'Prerequisites',
    description: 'Foundation concepts you should understand first',
    learning_units: learningUnits,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createSectionTitle(section: any, index: number): string {
  const sectionType = section.section_type || 'topic';
  
  if (sectionType === 'problem') {
    const concepts = section.concepts_tested || [];
    const mainConcept = concepts[0] || 'Analysis';
    return `Problem ${index}: ${mainConcept}`;
  } else {
    const concepts = section.key_concepts || [];
    const mainConcept = concepts[0] || section.topic_summary || 'Study';
    return `Topic ${index}: ${mainConcept}`;
  }
}

