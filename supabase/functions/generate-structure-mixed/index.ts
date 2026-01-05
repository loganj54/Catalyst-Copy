// ============================================================================
// GENERATE STRUCTURE MIXED ATOMIC FUNCTION
// ============================================================================
// Generates learning units for ONLY the cache-missed sections, not the entire document.
// This enables mixed generation where some sections are cached and others are freshly generated.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { callClaudeWithJSON } from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';
import type {
  GenerateStructureMixedInput,
  GenerateStructureMixedOutput,
  AnalysisResult,
  FunctionError,
  GeneratedUnitMap,
  LearningUnit
} from '../_shared/types.ts';

/**
 * Main handler - generates structure for cache-missed sections only
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: GenerateStructureMixedInput = await req.json();
    
    if (!input.analysis) {
      return errorResponse({
        error: 'analysis is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis' },
      });
    }

    if (!input.sections_to_generate || input.sections_to_generate.length === 0) {
      console.log('[generate-structure-mixed] No sections to generate - all cached!');
      return new Response(
        JSON.stringify({
          generated_units: {},
          model: 'none',
          metadata: {
            tokens_used: 0,
            generation_time_ms: 0,
            sections_generated: 0
          }
        } as GenerateStructureMixedOutput),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[generate-structure-mixed] Starting partial structure generation');
    console.log('  - Total sections in analysis:', input.analysis.sections?.length || 0);
    console.log('  - Sections to generate:', input.sections_to_generate.length);
    console.log('  - Cached sections:', (input.analysis.sections?.length || 0) - input.sections_to_generate.length);

    // Filter analysis to only include sections that need generation
    const filteredAnalysis = filterAnalysisForGeneration(
      input.analysis,
      input.sections_to_generate
    );

    console.log('[generate-structure-mixed] Filtered analysis created');
    console.log('  - Filtered sections:', filteredAnalysis.sections?.length || 0);

    // Generate structure using Claude
    const generatedStructure = await generatePartialStructure(filteredAnalysis);

    // Extract learning units and map them by section_id
    const generatedUnits = extractUnitsFromStructure(
      generatedStructure,
      input.sections_to_generate
    );

    const generationTime = Date.now() - startTime;

    console.log('[generate-structure-mixed] Partial generation complete');
    console.log('  - Sections generated:', Object.keys(generatedUnits).length);
    console.log('  - Time:', generationTime, 'ms');

    const output: GenerateStructureMixedOutput = {
      generated_units: generatedUnits,
      model: 'claude-haiku-4-5',
      metadata: {
        tokens_used: 0, // Would need to track from API response
        generation_time_ms: generationTime,
        sections_generated: Object.keys(generatedUnits).length
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
    console.error('[generate-structure-mixed] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'GENERATION_ERROR',
      details: { stack: error.stack },
    });
  }
};

/**
 * Filters the analysis to only include sections that need generation
 */
function filterAnalysisForGeneration(
  analysis: AnalysisResult,
  sectionsToGenerate: string[]
): AnalysisResult {
  if (!analysis.sections || analysis.sections.length === 0) {
    return analysis;
  }

  const sectionsSet = new Set(sectionsToGenerate);
  
  const filteredSections = analysis.sections.filter(section => 
    sectionsSet.has(section.section_id)
  );

  return {
    ...analysis,
    sections: filteredSections
  };
}

/**
 * Generates structure for the filtered sections using Claude
 */
async function generatePartialStructure(analysis: AnalysisResult): Promise<any> {
  console.log('[generate-structure-mixed] Calling Claude for partial generation');
  
  // Build the prompt
  const systemPrompt = PROMPTS.generateStructure.system;
  const userPrompt = buildPartialGenerationPrompt(analysis);

  // Call Claude with JSON mode
  const structure = await callClaudeWithJSON(
    systemPrompt,
    userPrompt,
    {
      temperature: 0.3,
      maxTokens: 16384
    }
  );

  return structure;
}

/**
 * Builds a specialized prompt for partial generation
 */
function buildPartialGenerationPrompt(analysis: AnalysisResult): string {
  const sectionsCount = analysis.sections?.length || 0;
  
  return `Generate a learning structure for the following document analysis.

IMPORTANT: This is a PARTIAL generation. You are generating learning units for SPECIFIC SECTIONS ONLY.
These sections will be combined with cached sections from similar documents.

Document Analysis:
${JSON.stringify(analysis, null, 2)}

INSTRUCTIONS:
1. Generate learning units ONLY for the ${sectionsCount} section(s) provided in the analysis
2. Each section should produce 1-3 learning units depending on complexity
3. Follow the standard structure generation format
4. Ensure all required fields are included (tutor_guidance, target_resource_profile, search_queries, etc.)
5. Use appropriate section naming based on section_type:
   - For "problem" sections: Use "Problem X" naming
   - For "topic" sections: Use "Topic X" naming
6. Generate EXACTLY 3 search queries per learning unit (introduction, tutorial, example)
7. All queries must include "youtube" for video content

Output the complete learning structure in JSON format.`;
}

/**
 * Extracts learning units from the generated structure and maps them by section_id
 */
function extractUnitsFromStructure(
  structure: any,
  expectedSectionIds: string[]
): GeneratedUnitMap {
  const generatedUnits: GeneratedUnitMap = {};
  
  // Initialize map with empty arrays for expected sections
  for (const sectionId of expectedSectionIds) {
    generatedUnits[sectionId] = [];
  }

  // Extract units from prerequisites_section
  if (structure.prerequisites_section?.learning_units) {
    for (const unit of structure.prerequisites_section.learning_units) {
      // Try to match unit to a section based on unit_id or topic
      const matchedSectionId = findMatchingSectionId(unit, expectedSectionIds);
      if (matchedSectionId) {
        generatedUnits[matchedSectionId].push(unit);
      }
    }
  }

  // Extract units from content_sections
  if (structure.content_sections && Array.isArray(structure.content_sections)) {
    for (const contentSection of structure.content_sections) {
      const sectionId = contentSection.section_id;
      
      if (expectedSectionIds.includes(sectionId)) {
        if (contentSection.learning_units && Array.isArray(contentSection.learning_units)) {
          generatedUnits[sectionId].push(...contentSection.learning_units);
        }
      }
    }
  }

  // Log results
  for (const [sectionId, units] of Object.entries(generatedUnits)) {
    console.log(`[generate-structure-mixed] Section ${sectionId}: ${units.length} units generated`);
  }

  return generatedUnits;
}

/**
 * Attempts to find which section a learning unit belongs to
 * This is a heuristic match based on unit_id and topic
 */
function findMatchingSectionId(unit: LearningUnit, sectionIds: string[]): string | null {
  // Try exact match on unit_id prefix
  for (const sectionId of sectionIds) {
    if (unit.unit_id.startsWith(sectionId.toLowerCase().replace(/\s+/g, '-'))) {
      return sectionId;
    }
  }
  
  // Try matching on topic keywords
  const unitTopicLower = unit.topic.toLowerCase();
  for (const sectionId of sectionIds) {
    const sectionIdLower = sectionId.toLowerCase();
    if (unitTopicLower.includes(sectionIdLower) || sectionIdLower.includes(unitTopicLower)) {
      return sectionId;
    }
  }
  
  // Default to first section if no match (fallback)
  return sectionIds[0] || null;
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
serve(withSelfHealing('generate-structure-mixed', handler));


