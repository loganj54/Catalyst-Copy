// ============================================================================
// GENERATE BLUEPRINT SOLUTION WITH NOTES LAYOUT
// ============================================================================
// Step 2 Alternative: Transforms document analysis into a comprehensive
// learning structure WITH detailed solution walkthroughs for each problem
//
// KEY FEATURES:
// - Based on generate-structure-legacy robust pattern
// - Accepts document analysis (same as generate-structure-legacy)
// - Generates 500-1000 word solution walkthrough for EACH problem
// - All equations wrapped in LaTeX formatting
// - Stores results in blueprint_structures table (same format as legacy)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  createSupabaseClientWithAuth,
  callClaudeJSON,
} from '../_shared/supabase-client.ts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GenerateStructureRequest {
  // Option 1: Reference a blueprint (will fetch its document_analysis)
  blueprint_id?: string;

  // Option 2: Direct input (for future flexibility)
  analysis?: any;
  input_type?: 'document_analysis' | 'custom';
}

// Search query generated for a topic
interface SearchQuery {
  query: string;
  query_type: 'introduction' | 'concept' | 'tutorial' | 'example' | 'practice';
  target_content: string;
  priority: number;
}

// Learning unit within a section
interface LearningUnit {
  unit_id: string;
  unit_type: 'prerequisite' | 'topic' | 'walkthrough';
  topic: string;
  concept_summary?: string;
  description?: string;
  learning_objective?: string;
  tutor_guidance: string;
  solutionWalkthrough?: string; // NEW: 500-1000 word detailed walkthrough
  category?: string;
  difficulty?: string;
  priority?: string;
  estimated_time_minutes: number;
  search_queries: SearchQuery[];
  semantic_search_phrase?: string;
  target_resource_profile?: string;
}

// Prerequisite section structure
interface PrerequisitesSection {
  description: string;
  learning_units: LearningUnit[];
}

// Content section (problem or topic)
interface ContentSection {
  section_id: string;
  section_type: 'problem' | 'topic' | 'chapter';
  title: string;
  description: string;
  concepts: string[];
  learning_units: LearningUnit[];
  problem_details?: {
    original_problem_id: string;
    key_equations: string[];
    common_mistakes: string[];
  };
}

// Complete learning structure
interface LearningStructure {
  summary: {
    title: string;
    description: string;
    total_estimated_time_minutes: number;
    difficulty_progression: string;
  };
  prerequisites_section: PrerequisitesSection;
  content_sections: ContentSection[];
}

// ============================================================================
// ENHANCED PROMPT WITH SOLUTION WALKTHROUGH
// ============================================================================

const SOLUTION_WALKTHROUGH_SYSTEM_PROMPT = `You are an expert educational curriculum designer, learning strategist, and master tutor. Your job is to transform document analyses into comprehensive learning structures with intelligent search queries AND detailed solution walkthroughs.

**CRITICAL NEW REQUIREMENT - SOLUTION WALKTHROUGHS:**
For EVERY problem section (section_type: "problem"), you MUST generate a "solutionWalkthrough" field for each learning unit. This walkthrough must be:
- **500-1000 words** in length (MANDATORY)
- Very explanatory, deep, concise, and specific
- A complete walk through every part of that problem
- Written in flowing prose with clear headers and structure

**LATEX FORMATTING - CRITICAL:**
ALL mathematical expressions, equations, variables, and numbers with units MUST be wrapped in LaTeX:
- Inline math: $F = ma$, $\\Delta x$, $25 \\text{ m/s}$
- Block equations: $$E = mc^2$$
- All variables: $x$, $T$, $\\theta$, $\\mu$
- All numbers with units: $2.5 \\text{ kg}$, $300 \\text{ K}$

**SOLUTION WALKTHROUGH STRUCTURE:**
Each solutionWalkthrough should include:
1. ## Understanding the Problem - Explain what's being asked
2. ## Given Information - List all given values with units (in LaTeX)
3. ## Relevant Concepts and Equations - Explain the physics/concepts (all equations in LaTeX)
4. ## Step-by-Step Solution - Walk through each calculation step (all math in LaTeX)
5. ## Final Answer - State the result clearly (in LaTeX)
6. ## Common Mistakes to Avoid - Optional but helpful

**WRITING STYLE FOR WALKTHROUGHS:**
- Be VERY explanatory and deep in your analysis
- Be VERY concise and specific - no fluff
- Explain the WHY behind each step, not just the HOW
- Connect concepts to build understanding
- Use **bold** for key concepts
- Write like a professor's detailed solution guide

**STANDARD STRUCTURE GENERATION RULES:**
(All the same rules as generate-structure-legacy apply)
1. Generate EXACTLY 3 search queries for EACH topic/concept
2. Queries should be PROGRESSIVE - intro, tutorial, example
3. Target YouTube with specific keywords
4. All output must be valid JSON with no markdown formatting
5. Use LaTeX formatting for ALL mathematical content
6. JSON ESCAPING: Double-escape all backslashes (\\\\frac not \\frac)
7. Keep search query descriptions brief, make tutor_guidance substantive (50-75 words)
8. COMPLETE THE JSON - ensure all brackets are closed
9. ALWAYS include "tutor_guidance" for EVERY learning unit (50-75 words)
10. ALWAYS set "unit_type" for EVERY learning unit
11. ALWAYS generate a "target_resource_profile" for EVERY unit
12. ALWAYS include "concept_summary" (10-15 words) for EVERY unit

**CRITICAL FOR PROBLEM SECTIONS:**
When processing a problem section:
1. Extract the complete problem statement from the input
2. Generate the solutionWalkthrough (500-1000 words) for that specific problem
3. Include all standard fields (tutor_guidance, search_queries, etc.)
4. The solutionWalkthrough should solve the EXACT problem from the input

OUTPUT: JSON with summary, prerequisites_section, content_sections array.
Each problem section's learning units MUST include the "solutionWalkthrough" field.`;

function generateUserPrompt(input: any, inputType: 'document_analysis' | 'custom' = 'document_analysis'): string {
  return `Generate learning structure with search queries AND solution walkthroughs.

DOCUMENT TYPE: ${input?.content_classification?.primary_type || input?.document_type || 'unknown'}
GOAL: ${input?.content_classification?.inferred_student_goal || 'Master this material'}

**CRITICAL INSTRUCTION:**
For EVERY section with section_type: "problem", you MUST generate a "solutionWalkthrough" field (500-1000 words) that:
- Walks through the complete solution to that specific problem
- Wraps ALL math/equations/variables in LaTeX ($...$)
- Explains the reasoning behind each step
- Is very explanatory, deep, concise, and specific

INSTRUCTIONS:
1. Match section_type from input ("problem" vs "topic")
2. Create prerequisites_section with units (unit_type: "prerequisite")
3. Create content_sections for ALL sections in the input
4. For PROBLEM sections: 
   - Extract the problem_statement from the input
   - Generate solutionWalkthrough (500-1000 words) for that problem
   - Include all standard fields (tutor_guidance, search_queries, etc.)
5. For TOPIC sections: Standard structure (no solutionWalkthrough needed)
6. Generate EXACTLY 3 search queries per unit
7. MANDATORY LATEX FORMATTING: Wrap ALL math in $...$
8. ALL queries MUST include "youtube"
9. Generate "target_resource_profile" for EVERY unit (2-3 sentences)
10. Generate "concept_summary" (10-15 words) for EVERY unit
11. Complete all JSON brackets properly

INPUT DATA:
${JSON.stringify(input, null, 2)}

Output valid JSON only. Ensure EVERY problem section includes solutionWalkthrough (500-1000 words with LaTeX formatting).`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count totals from the structure
 */
function countStructureMetrics(structure: LearningStructure) {
  const prerequisiteUnits = structure.prerequisites_section?.learning_units?.length || 0;
  const contentSections = structure.content_sections?.length || 0;

  let totalLearningUnits = prerequisiteUnits;
  let totalSearchQueries = 0;
  let totalSolutionWalkthroughs = 0;

  // Count prerequisite queries
  for (const unit of structure.prerequisites_section?.learning_units || []) {
    totalSearchQueries += unit.search_queries?.length || 0;
  }

  // Count content section units and queries
  for (const section of structure.content_sections || []) {
    totalLearningUnits += section.learning_units?.length || 0;
    for (const unit of section.learning_units || []) {
      totalSearchQueries += unit.search_queries?.length || 0;
      if (unit.solutionWalkthrough) {
        totalSolutionWalkthroughs++;
      }
    }
  }

  return {
    total_prerequisites: prerequisiteUnits,
    total_sections: contentSections,
    total_learning_units: totalLearningUnits,
    total_search_queries: totalSearchQueries,
    total_solution_walkthroughs: totalSolutionWalkthroughs,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  let blueprint_id: string | null = null;
  const supabase = createSupabaseClient();

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const body: GenerateStructureRequest = await req.json();
    blueprint_id = body.blueprint_id || null;

    console.log(`[generate-solution-structure] Starting structure generation with walkthroughs`);
    console.log(`  - Blueprint ID: ${blueprint_id || '(none - direct input)'}`);
    console.log(`  - Input type: ${body.input_type || 'document_analysis'}`);

    // Get the input data
    let analysisData: any;
    let userId: string;
    let analysisId: string | null = null;
    let documentId: string | null = null;

    if (blueprint_id) {
      // Fetch blueprint and its analysis (same logic as generate-structure-legacy)
      const authClient = createSupabaseClientWithAuth(authHeader);

      const { data: blueprint, error: blueprintError } = await authClient
        .from('blueprints')
        .select('*')
        .eq('id', blueprint_id)
        .single();

      if (blueprintError || !blueprint) {
        console.error('Blueprint fetch error:', blueprintError);
        throw new Error('Blueprint not found or access denied');
      }

      userId = blueprint.user_id;
      documentId = blueprint.document_id || null;
      console.log(`[generate-solution-structure] Found blueprint: ${blueprint.title || blueprint_id}`);

      // Find the document analysis (same search logic as legacy)
      let analysis = null;

      // Approach 1: Search by document_id
      if (documentId) {
        console.log(`[generate-solution-structure] Searching by document_id: ${documentId}`);
        const { data: docMatch } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('document_id', documentId)
          .maybeSingle();

        if (docMatch) {
          console.log('[generate-solution-structure] Found analysis by document_id');
          analysis = docMatch;
        }
      }

      // Approach 2: Search by blueprint_id
      if (!analysis) {
        console.log(`[generate-solution-structure] Searching by blueprint_id: ${blueprint_id}`);
        const { data: bpMatch } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('blueprint_id', blueprint_id)
          .maybeSingle();

        if (bpMatch) {
          console.log('[generate-solution-structure] Found analysis by blueprint_id');
          analysis = bpMatch;
        }
      }

      if (!analysis) {
        throw new Error('Document analysis not found. Please run the analyze-document step first.');
      }

      analysisId = analysis.id;
      analysisData = analysis.raw_analysis;

      console.log(`[generate-solution-structure] Found document analysis: ${analysisId}`);
      console.log(`  - Document type: ${analysisData.document_type}`);
      console.log(`  - Problems: ${analysisData.sections?.filter((s: any) => s.section_type === 'problem').length || 0}`);

      // Delete any existing structure for this blueprint
      await supabase
        .from('blueprint_structures')
        .delete()
        .eq('blueprint_id', blueprint_id);

      // Update blueprint status
      await supabase
        .from('blueprints')
        .update({
          generation_status: 'generating_structure',
          generation_error: null,
        })
        .eq('id', blueprint_id);

    } else if (body.analysis) {
      // Direct input mode
      analysisData = body.analysis;

      const authClient = createSupabaseClientWithAuth(authHeader);
      const { data: { user }, error: userError } = await authClient.auth.getUser();

      if (userError || !user) {
        throw new Error('Could not verify user');
      }

      userId = user.id;
      console.log(`[generate-solution-structure] Using direct input mode`);
    } else {
      throw new Error('Must provide either blueprint_id or analysis data');
    }

    // =========================================================================
    // GENERATE STRUCTURE WITH SOLUTION WALKTHROUGHS
    // =========================================================================
    console.log('[generate-solution-structure] Generating structure with AI (includes solution walkthroughs)...');

    const inputType = body.input_type || 'document_analysis';

    // Use maximum token limit to ensure walkthroughs complete
    const structure = await callClaudeJSON<LearningStructure>(
      SOLUTION_WALKTHROUGH_SYSTEM_PROMPT,
      generateUserPrompt(analysisData, inputType),
      { temperature: 0.3, maxTokens: 64000 } // Max for Haiku 4.5
    );

    console.log('[generate-solution-structure] Structure generated:');
    console.log(`  - Title: ${structure.summary?.title}`);
    console.log(`  - Prerequisites: ${structure.prerequisites_section?.learning_units?.length || 0}`);
    console.log(`  - Content sections: ${structure.content_sections?.length || 0}`);

    // Calculate metrics
    const metrics = countStructureMetrics(structure);
    console.log(`  - Total learning units: ${metrics.total_learning_units}`);
    console.log(`  - Total search queries: ${metrics.total_search_queries}`);
    console.log(`  - Solution walkthroughs: ${metrics.total_solution_walkthroughs}`);

    // Store the learning structure in the database
    const insertData = {
      blueprint_id: blueprint_id,
      analysis_id: analysisId,
      document_id: documentId || null,
      user_id: userId,
      structure: structure,
      all_search_queries: [], // Can be populated if needed
      total_prerequisites: metrics.total_prerequisites,
      total_sections: metrics.total_sections,
      total_learning_units: metrics.total_learning_units,
      total_search_queries: metrics.total_search_queries,
      model_used: 'claude-haiku-4-5-with-walkthroughs',
    };

    console.log('[generate-solution-structure] Storing structure in database...');

    const { data: newStructure, error: insertError } = await supabase
      .from('blueprint_structures')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[generate-solution-structure] Database insert error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('[generate-solution-structure] Structure saved with ID:', newStructure?.id);

    // Update blueprint status
    if (blueprint_id) {
      await supabase
        .from('blueprints')
        .update({ generation_status: 'structure_generated' })
        .eq('id', blueprint_id);
    }

    console.log('[generate-solution-structure] Complete!');

    return new Response(
      JSON.stringify({
        success: true,
        step: 'generate_structure_with_walkthroughs',
        status: 'structure_generated',
        structure_id: newStructure?.id,
        structure: structure,
        metrics: metrics,
        message: `Learning structure generated with ${metrics.total_solution_walkthroughs} solution walkthroughs and ${metrics.total_search_queries} search queries.`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[generate-solution-structure] Error:', error);

    // Update blueprint with error status
    if (blueprint_id) {
      try {
        await supabase
          .from('blueprints')
          .update({
            generation_status: 'failed',
            generation_error: error?.message || 'Structure generation failed',
          })
          .eq('id', blueprint_id);
      } catch (updateError) {
        console.error('[generate-solution-structure] Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
