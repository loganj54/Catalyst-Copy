// ============================================================================
// GENERATE BLUEPRINT SOLUTION - PARALLEL VERSION
// ============================================================================
// Optimized version using two-phase parallel processing:
// Phase 1: Generate structure skeleton (fast, no walkthroughs)
// Phase 2: Generate all content in parallel:
//          - Problem solution walkthroughs
//          - Comprehensive prerequisite lesson (textbook-style, casual language)
//
// This dramatically reduces total time from 6-8 minutes to ~60-90 seconds
// for documents with 5-10 problems.
//
// Output format is IDENTICAL to generate-blueprint-solution-with-notes-layout
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  createSupabaseClientWithAuth,
  callClaudeJSON,
} from '../_shared/supabase-client.ts';

// ============================================================================
// TYPE DEFINITIONS (Same as original)
// ============================================================================

interface GenerateStructureRequest {
  blueprint_id?: string;
  analysis?: any;
  input_type?: 'document_analysis' | 'custom';
}

interface SearchQuery {
  query: string;
  query_type: 'introduction' | 'concept' | 'tutorial' | 'example' | 'practice';
  target_content: string;
  priority: number;
}

interface LearningUnit {
  unit_id: string;
  unit_type: 'prerequisite' | 'topic' | 'walkthrough';
  topic: string;
  concept_summary?: string;
  description?: string;
  learning_objective?: string;
  tutor_guidance: string;
  solutionWalkthrough?: string;
  category?: string;
  difficulty?: string;
  priority?: string;
  estimated_time_minutes: number;
  search_queries: SearchQuery[];
  semantic_search_phrase?: string;
  target_resource_profile?: string;
}

interface PrerequisitesSection {
  description: string;
  learning_units: LearningUnit[];
  comprehensive_lesson?: PrerequisiteLessonResponse;
}

// ============================================================================
// PREREQUISITE LESSON TYPE DEFINITIONS
// ============================================================================

interface PrerequisiteEquation {
  latex: string;
  label: string;
  description: string;
}

interface PrerequisiteConcept {
  concept_id: string;
  concept_name: string;
  summary: string;  // 2-3 sentences
  lesson_content: string;  // 100-200 words with equations
  equations?: PrerequisiteEquation[];
}

interface PrerequisiteLessonResponse {
  lesson_title: string;
  lesson_intro: string;  // 2-3 sentences introducing the prerequisites
  concepts: PrerequisiteConcept[];
}

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
// PHASE 1: SKELETON PROMPT (No walkthroughs - fast generation)
// ============================================================================

const STRUCTURE_SKELETON_PROMPT = `You are an expert educational curriculum designer and learning strategist. Your job is to transform document analyses into comprehensive learning structures with intelligent search queries.

**CRITICAL: SKELETON GENERATION ONLY**
In this phase, you generate the COMPLETE structure but WITHOUT solution walkthroughs.
For every problem section's walkthrough unit, set: "solutionWalkthrough": "PENDING_PARALLEL_GENERATION"
The walkthroughs will be generated separately in parallel for speed.

**LATEX FORMATTING - CRITICAL:**
ALL mathematical expressions, equations, variables, and numbers with units MUST be wrapped in LaTeX:
- Inline math: $F = ma$, $\\Delta x$, $25 \\text{ m/s}$
- Block equations: $$E = mc^2$$
- All variables: $x$, $T$, $\\theta$, $\\mu$
- All numbers with units: $2.5 \\text{ kg}$, $300 \\text{ K}$
- For multiplication dots, ALWAYS use $\\cdot$ (backslash-cdot)
- NEVER use \\cdotp (with p) - it causes rendering errors
- For units with dots like W/(m²·K), use: $\\text{W}/(\\text{m}^2 \\cdot \\text{K})$

**STANDARD STRUCTURE GENERATION RULES:**
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

**FOR PROBLEM SECTIONS:**
- Create a learning unit with unit_type: "walkthrough" for each problem
- Set solutionWalkthrough: "PENDING_PARALLEL_GENERATION" (placeholder)
- Include all other fields normally (tutor_guidance, search_queries, etc.)

OUTPUT: Valid JSON with summary, prerequisites_section, content_sections array.`;

function generateSkeletonUserPrompt(input: any, inputType: string): string {
  return `Generate learning structure skeleton (WITHOUT solution walkthroughs - they will be added in parallel).

DOCUMENT TYPE: ${input?.content_classification?.primary_type || input?.document_type || 'unknown'}
GOAL: ${input?.content_classification?.inferred_student_goal || 'Master this material'}

**CRITICAL INSTRUCTION:**
For EVERY problem section, create a walkthrough learning unit with:
- unit_type: "walkthrough"
- solutionWalkthrough: "PENDING_PARALLEL_GENERATION" (exact placeholder)
- All other fields filled normally (tutor_guidance, search_queries, etc.)

INSTRUCTIONS:
1. Match section_type from input ("problem" vs "topic")
2. Create prerequisites_section with units (unit_type: "prerequisite")
3. Create content_sections for ALL sections in the input
4. For PROBLEM sections: Include walkthrough unit with placeholder
5. For TOPIC sections: Standard structure
6. Generate EXACTLY 3 search queries per unit
7. MANDATORY LATEX FORMATTING: Wrap ALL math in $...$
8. ALL queries MUST include "youtube"
9. Generate "target_resource_profile" for EVERY unit
10. Generate "concept_summary" (10-15 words) for EVERY unit
11. Complete all JSON brackets properly

INPUT DATA:
${JSON.stringify(input, null, 2)}

Output valid JSON only. Structure must include all fields, with solutionWalkthrough set to "PENDING_PARALLEL_GENERATION" for problem sections.`;
}

// ============================================================================
// PHASE 2: SINGLE WALKTHROUGH PROMPT (One per problem, runs in parallel)
// ============================================================================

const SINGLE_WALKTHROUGH_PROMPT = `You are an expert tutor generating a detailed solution walkthrough for a single problem.

**GENERATE A 500-1000 WORD SOLUTION WALKTHROUGH** that is:
- Very explanatory, deep, concise, and specific
- A complete walk through every part of that problem
- Written in flowing prose with clear headers

**LATEX FORMATTING - CRITICAL:**
ALL mathematical expressions, equations, variables, and numbers with units MUST be wrapped in LaTeX:
- Inline math: $F = ma$, $\\Delta x$, $25 \\text{ m/s}$
- Block equations: $$E = mc^2$$
- All variables: $x$, $T$, $\\theta$, $\\mu$
- All numbers with units: $2.5 \\text{ kg}$, $300 \\text{ K}$
- For multiplication dots, ALWAYS use $\\cdot$ (backslash-cdot)
- NEVER use \\cdotp (with p) - it causes rendering errors
- For units with dots like W/(m²·K), use: $\\text{W}/(\\text{m}^2 \\cdot \\text{K})$

**SOLUTION WALKTHROUGH STRUCTURE:**
1. ## Understanding the Problem - Explain what's being asked
2. ## Given Information - List all given values with units (in LaTeX)
3. ## Relevant Concepts and Equations - Explain the physics/concepts (all equations in LaTeX)
4. ## Step-by-Step Solution - Walk through each calculation step (all math in LaTeX)
5. ## Final Answer - State the result clearly (in LaTeX)
6. ## Common Mistakes to Avoid - Optional but helpful

**WRITING STYLE:**
- Be VERY explanatory and deep in your analysis
- Be VERY concise and specific - no fluff
- Explain the WHY behind each step, not just the HOW
- Connect concepts to build understanding
- Use **bold** for key concepts
- Write like a professor's detailed solution guide

OUTPUT: JSON with single field: {"solutionWalkthrough": "..."}`;

function generateWalkthroughUserPrompt(
  section: ContentSection,
  originalSection: any
): string {
  const problemStatement = originalSection?.problem_statement ||
                           originalSection?.description ||
                           section.description;

  const keyEquations = section.problem_details?.key_equations?.join(', ') ||
                       originalSection?.key_equations?.join(', ') ||
                       'N/A';

  const concepts = section.concepts?.join(', ') || 'N/A';

  return `Generate a detailed solution walkthrough (500-1000 words) for this problem.

**PROBLEM TITLE:** ${section.title}

**PROBLEM STATEMENT:**
${problemStatement}

**KEY CONCEPTS:** ${concepts}

**KEY EQUATIONS:** ${keyEquations}

Generate a complete walkthrough with all sections (Understanding, Given Information, Concepts/Equations, Step-by-Step Solution, Final Answer, Common Mistakes).

All math MUST be in LaTeX.

Output as JSON: {"solutionWalkthrough": "..."}`;
}

// ============================================================================
// PREREQUISITE LESSON PROMPT (Comprehensive, textbook-style lesson)
// ============================================================================

const PREREQUISITE_LESSON_SYSTEM_PROMPT = `You are an expert tutor creating a comprehensive lesson on prerequisite concepts. Your goal is to give students the foundational knowledge they need before tackling a homework problem or topic.

**WRITING STYLE:**
- Write like you're explaining to a smart friend, not a textbook
- Casual but educational - college freshman or advanced high school level
- Use "you" to address the student directly
- Be conversational: "So basically...", "Here's the deal...", "Think of it like..."
- Avoid overly formal academic language
- Still be accurate and thorough - just approachable

**STRUCTURE FOR EACH CONCEPT:**
1. **concept_name**: Clear, descriptive name for the concept
2. **summary**: 2-3 sentences that give the quick "what is this and why does it matter" overview
3. **lesson_content**: 150-250 words using RICH MARKDOWN FORMATTING (see below)

**LESSON_CONTENT FORMATTING - CRITICAL:**
The lesson_content field MUST use markdown to create visual structure. DO NOT write dense paragraphs!

Use these formatting techniques:
- **Subheadings** with ### for key terms or properties (e.g., "### Density ($\\\\rho$)")
- **Bold** for important terms and symbols on first mention
- **Bullet points** for listing properties, characteristics, or steps
- **Inline code or emphasis** for symbols: *symbol: $\\\\rho$* or showing units
- **Short paragraphs** - max 2-3 sentences each, then break

Example structure for a concept like "Thermal Properties":
\`\`\`
### Density ($\\\\rho$)
*Symbol: $\\\\rho$ (rho) | Units: kg/m³*

Density tells you how much mass is packed into a given volume. Think of it as "how heavy something feels for its size."

**Key points:**
- Higher density = more mass in the same space
- Water has a density of about $1000 \\\\text{ kg/m}^3$
- Density changes with temperature (things expand when heated)

### Specific Heat Capacity ($c$)
*Symbol: $c$ | Units: J/(kg·K)*

This measures how much energy it takes to heat something up...
\`\`\`

**EQUATION FORMATTING:**
- Extract key equations into the "equations" array
- Each equation needs: latex, label, description
- In lesson_content, reference equations naturally
- ALL math must use $...$ for inline or $$...$$ for display
- Double-escape backslashes in JSON: \\\\frac, \\\\sigma, \\\\rho, etc.

**OUTPUT REQUIREMENTS:**
- Generate 3-6 prerequisite concepts
- Each concept should be self-contained but flow naturally
- lesson_intro should set up why these concepts matter
- Make it scannable - a student should be able to skim and find what they need

**JSON FORMAT:**
{
  "lesson_title": "Prerequisites for [Topic]",
  "lesson_intro": "Before diving into [topic], you'll want to be comfortable with a few key ideas...",
  "concepts": [
    {
      "concept_id": "prereq_1",
      "concept_name": "Concept Name Here",
      "summary": "2-3 sentence overview...",
      "lesson_content": "### Subheading\\n*Symbol info*\\n\\nShort explanation...\\n\\n**Key points:**\\n- Point one\\n- Point two",
      "equations": [
        {
          "latex": "F = ma",
          "label": "Newton's Second Law",
          "description": "Force equals mass times acceleration"
        }
      ]
    }
  ]
}`;

function generatePrerequisiteLessonUserPrompt(
  prerequisites: LearningUnit[],
  analysisData: any,
  problemContext: string
): string {
  const documentContext = {
    subject_area: analysisData?.subject_area || 'Unknown',
    specific_topic: analysisData?.specific_topic || 'Unknown',
    document_type: analysisData?.document_type || 'problem_set'
  };

  return `Generate a comprehensive prerequisite lesson for the following context.

**DOCUMENT CONTEXT:**
- Subject: ${documentContext.subject_area}
- Topic: ${documentContext.specific_topic}
- Document Type: ${documentContext.document_type}

**MAIN PROBLEM/TOPIC THE STUDENT IS WORKING ON:**
${problemContext}

**EXISTING PREREQUISITE CONCEPTS TO EXPAND ON:**
${prerequisites.map((p, i) => `
${i + 1}. ${p.topic}
   - Summary: ${p.concept_summary || 'N/A'}
   - Guidance: ${p.tutor_guidance || 'N/A'}
   - Equations: ${JSON.stringify(p.equations?.map((e: any) => e.name || e.latex) || [])}
`).join('\n')}

**YOUR TASK:**
Create a comprehensive lesson covering 3-6 of the most important prerequisite concepts. For each concept:
1. Write a clear concept_name
2. Write a 2-3 sentence summary  
3. Write 150-250 words of WELL-FORMATTED teaching content using markdown
4. Extract key equations with labels and descriptions

**CRITICAL FORMATTING FOR lesson_content:**
- Use ### subheadings for each key term/property (e.g., "### Density ($\\\\rho$)")
- Use *italics* for symbol definitions (e.g., "*Symbol: $\\\\rho$ | Units: kg/m³*")
- Use **bold** for important terms
- Use bullet points for lists of properties or key points
- Keep paragraphs SHORT (2-3 sentences max)
- DO NOT write dense walls of text!

Remember:
- Write casually but accurately (college freshman level)
- Actually TEACH the concepts, don't just describe them
- Make it scannable with clear visual hierarchy
- Double-escape all LaTeX backslashes (\\\\frac, \\\\rho, \\\\sigma, etc.)

Output valid JSON only.`;
}

// ============================================================================
// PARALLEL WALKTHROUGH GENERATOR
// ============================================================================

interface WalkthroughResult {
  section_id: string;
  solutionWalkthrough: string;
  error?: string;
}

async function generateSingleWalkthrough(
  section: ContentSection,
  originalSection: any
): Promise<WalkthroughResult> {
  try {
    console.log(`[walkthrough] Starting generation for section: ${section.section_id}`);

    const result = await callClaudeJSON<{ solutionWalkthrough: string }>(
      SINGLE_WALKTHROUGH_PROMPT,
      generateWalkthroughUserPrompt(section, originalSection),
      { temperature: 0.3, maxTokens: 8000 }
    );

    console.log(`[walkthrough] Completed for section: ${section.section_id} (${result.solutionWalkthrough?.length || 0} chars)`);

    return {
      section_id: section.section_id,
      solutionWalkthrough: result.solutionWalkthrough || 'Error: No walkthrough generated',
    };
  } catch (error) {
    console.error(`[walkthrough] Error for section ${section.section_id}:`, error);
    return {
      section_id: section.section_id,
      solutionWalkthrough: `Error generating walkthrough: ${error?.message || 'Unknown error'}. Please try regenerating this section.`,
      error: error?.message,
    };
  }
}

// ============================================================================
// PREREQUISITE LESSON GENERATOR (Runs in parallel with walkthroughs)
// ============================================================================

async function generatePrerequisiteLesson(
  prerequisites: LearningUnit[],
  analysisData: any,
  problemContext: string
): Promise<PrerequisiteLessonResponse | null> {
  // Skip if no prerequisites
  if (!prerequisites || prerequisites.length === 0) {
    console.log('[prerequisite-lesson] No prerequisites found, skipping lesson generation');
    return null;
  }

  try {
    console.log(`[prerequisite-lesson] Starting generation for ${prerequisites.length} prerequisites...`);

    const result = await callClaudeJSON<PrerequisiteLessonResponse>(
      PREREQUISITE_LESSON_SYSTEM_PROMPT,
      generatePrerequisiteLessonUserPrompt(prerequisites, analysisData, problemContext),
      { temperature: 0.5, maxTokens: 8000 }
    );

    console.log(`[prerequisite-lesson] Completed! Generated ${result.concepts?.length || 0} concept lessons`);

    return result;
  } catch (error) {
    console.error('[prerequisite-lesson] Error generating prerequisite lesson:', error);
    // Return null on error - don't fail the whole generation
    return null;
  }
}

// ============================================================================
// MERGE WALKTHROUGHS INTO STRUCTURE
// ============================================================================

function mergeWalkthroughsIntoStructure(
  structure: LearningStructure,
  walkthroughResults: WalkthroughResult[]
): void {
  // Create a map for O(1) lookup
  const walkthroughMap = new Map<string, string>();
  for (const result of walkthroughResults) {
    walkthroughMap.set(result.section_id, result.solutionWalkthrough);
  }

  // Update each content section's walkthrough unit
  for (const section of structure.content_sections) {
    if (section.section_type === 'problem') {
      const walkthrough = walkthroughMap.get(section.section_id);
      if (walkthrough) {
        // Find the walkthrough unit and update it
        for (const unit of section.learning_units) {
          if (unit.unit_type === 'walkthrough' ||
              unit.solutionWalkthrough === 'PENDING_PARALLEL_GENERATION') {
            unit.solutionWalkthrough = walkthrough;
          }
        }
      }
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize LaTeX in generated content - fixes common LLM mistakes
 */
function sanitizeLatex(text: string): string {
  if (!text) return text;
  
  let sanitized = text;
  let changesMade = false;
  
  // Replace \cdotp with \cdot (common LLM mistake that doesn't render)
  const cdotpRegex = /\\cdotp/g;
  if (cdotpRegex.test(sanitized)) {
    sanitized = sanitized.replace(cdotpRegex, '\\cdot');
    changesMade = true;
  }
  
  // Also catch any \cdotp that might be followed by other characters (like K)
  const cdotpFollowedRegex = /\\cdotp([A-Za-z])/g;
  if (cdotpFollowedRegex.test(sanitized)) {
    sanitized = sanitized.replace(cdotpFollowedRegex, '\\cdot $1');
    changesMade = true;
  }
  
  if (changesMade) {
    console.log('[sanitize] Fixed LaTeX errors: replaced \\cdotp with \\cdot');
  }
  
  return sanitized;
}

/**
 * Recursively sanitize all string fields in a structure
 */
function sanitizeStructure(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeLatex(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeStructure(item));
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeStructure(obj[key]);
    }
    return result;
  }
  return obj;
}

function countStructureMetrics(structure: LearningStructure) {
  const prerequisiteUnits = structure.prerequisites_section?.learning_units?.length || 0;
  const contentSections = structure.content_sections?.length || 0;

  let totalLearningUnits = prerequisiteUnits;
  let totalSearchQueries = 0;
  let totalSolutionWalkthroughs = 0;

  for (const unit of structure.prerequisites_section?.learning_units || []) {
    totalSearchQueries += unit.search_queries?.length || 0;
  }

  for (const section of structure.content_sections || []) {
    totalLearningUnits += section.learning_units?.length || 0;
    for (const unit of section.learning_units || []) {
      totalSearchQueries += unit.search_queries?.length || 0;
      if (unit.solutionWalkthrough &&
          unit.solutionWalkthrough !== 'PENDING_PARALLEL_GENERATION') {
        totalSolutionWalkthroughs++;
      }
    }
  }

  // Track prerequisite lesson
  const hasPrerequisiteLesson = !!structure.prerequisites_section?.comprehensive_lesson;
  const prerequisiteLessonConcepts = structure.prerequisites_section?.comprehensive_lesson?.concepts?.length || 0;

  return {
    total_prerequisites: prerequisiteUnits,
    total_sections: contentSections,
    total_learning_units: totalLearningUnits,
    total_search_queries: totalSearchQueries,
    total_solution_walkthroughs: totalSolutionWalkthroughs,
    has_prerequisite_lesson: hasPrerequisiteLesson,
    prerequisite_lesson_concepts: prerequisiteLessonConcepts,
  };
}

// ============================================================================
// MAIN HANDLER - TWO-PHASE PARALLEL PROCESSING
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  let blueprint_id: string | null = null;
  const supabase = createSupabaseClient();
  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const body: GenerateStructureRequest = await req.json();
    blueprint_id = body.blueprint_id || null;

    console.log(`[parallel-generate] ========================================`);
    console.log(`[parallel-generate] Starting PARALLEL structure generation`);
    console.log(`[parallel-generate] Blueprint ID: ${blueprint_id || '(none)'}`);
    console.log(`[parallel-generate] ========================================`);

    // Get the input data (same logic as original)
    let analysisData: any;
    let userId: string;
    let analysisId: string | null = null;
    let documentId: string | null = null;

    if (blueprint_id) {
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
      console.log(`[parallel-generate] Found blueprint: ${blueprint.title || blueprint_id}`);

      // Find the document analysis
      let analysis = null;

      if (documentId) {
        console.log(`[parallel-generate] Searching by document_id: ${documentId}`);
        const { data: docMatch } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('document_id', documentId)
          .maybeSingle();

        if (docMatch) {
          console.log('[parallel-generate] Found analysis by document_id');
          analysis = docMatch;
        }
      }

      if (!analysis) {
        console.log(`[parallel-generate] Searching by blueprint_id: ${blueprint_id}`);
        const { data: bpMatch } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('blueprint_id', blueprint_id)
          .maybeSingle();

        if (bpMatch) {
          console.log('[parallel-generate] Found analysis by blueprint_id');
          analysis = bpMatch;
        }
      }

      if (!analysis) {
        throw new Error('Document analysis not found. Please run analyze-document first.');
      }

      analysisId = analysis.id;
      analysisData = analysis.raw_analysis;

      const problemCount = analysisData.sections?.filter((s: any) => s.section_type === 'problem').length || 0;
      console.log(`[parallel-generate] Document type: ${analysisData.document_type}`);
      console.log(`[parallel-generate] Problem count: ${problemCount}`);

      // Delete any existing structure
      await supabase
        .from('blueprint_structures')
        .delete()
        .eq('blueprint_id', blueprint_id);

      // Update blueprint status
      await supabase
        .from('blueprints')
        .update({
          generation_status: 'generating_structure_parallel',
          generation_error: null,
        })
        .eq('id', blueprint_id);

    } else if (body.analysis) {
      analysisData = body.analysis;

      const authClient = createSupabaseClientWithAuth(authHeader);
      const { data: { user }, error: userError } = await authClient.auth.getUser();

      if (userError || !user) {
        throw new Error('Could not verify user');
      }

      userId = user.id;
      console.log(`[parallel-generate] Using direct input mode`);
    } else {
      throw new Error('Must provide either blueprint_id or analysis data');
    }

    const inputType = body.input_type || 'document_analysis';

    // =========================================================================
    // PHASE 1: GENERATE STRUCTURE SKELETON (Fast - no walkthroughs)
    // =========================================================================
    console.log(`[parallel-generate] ----------------------------------------`);
    console.log(`[parallel-generate] PHASE 1: Generating structure skeleton...`);
    const phase1Start = Date.now();

    const skeletonStructure = await callClaudeJSON<LearningStructure>(
      STRUCTURE_SKELETON_PROMPT,
      generateSkeletonUserPrompt(analysisData, inputType),
      { temperature: 0.3, maxTokens: 32000 }
    );

    const phase1Time = Date.now() - phase1Start;
    console.log(`[parallel-generate] Phase 1 complete in ${phase1Time}ms`);
    console.log(`[parallel-generate] - Title: ${skeletonStructure.summary?.title}`);
    console.log(`[parallel-generate] - Prerequisites: ${skeletonStructure.prerequisites_section?.learning_units?.length || 0}`);
    console.log(`[parallel-generate] - Content sections: ${skeletonStructure.content_sections?.length || 0}`);

    // =========================================================================
    // PHASE 2: GENERATE WALKTHROUGHS + PREREQUISITE LESSON IN PARALLEL
    // =========================================================================
    const problemSections = (skeletonStructure.content_sections || []).filter(
      s => s.section_type === 'problem'
    );

    // Build problem context for prerequisite lesson
    const problemContext = skeletonStructure.content_sections
      ?.map((s: ContentSection) => `${s.title}: ${s.description}`)
      .join('\n') || 'General topic study';

    console.log(`[parallel-generate] ----------------------------------------`);
    console.log(`[parallel-generate] PHASE 2: Generating ${problemSections.length} walkthroughs + prerequisite lesson in PARALLEL...`);
    const phase2Start = Date.now();

    // Create parallel promises for all walkthroughs
    const walkthroughPromises = problemSections.map(section => {
      // Find the original section from analysis data
      const originalSection = analysisData.sections?.find(
        (s: any) => s.section_id === section.section_id ||
                    s.problem_id === section.section_id ||
                    s.title === section.title
      );

      return generateSingleWalkthrough(section, originalSection);
    });

    // Create prerequisite lesson promise (runs in parallel with walkthroughs)
    const prerequisiteLessonPromise = generatePrerequisiteLesson(
      skeletonStructure.prerequisites_section?.learning_units || [],
      analysisData,
      problemContext
    );

    // Execute ALL in parallel (walkthroughs + prerequisite lesson)
    const [walkthroughResults, prerequisiteLessonResult] = await Promise.all([
      Promise.all(walkthroughPromises),
      prerequisiteLessonPromise
    ]);

    // Log walkthrough results
    const successCount = walkthroughResults.filter(r => !r.error).length;
    const errorCount = walkthroughResults.filter(r => r.error).length;
    console.log(`[parallel-generate] Walkthroughs complete: ${successCount} success, ${errorCount} errors`);

    // Merge walkthrough results into structure
    if (walkthroughResults.length > 0) {
      mergeWalkthroughsIntoStructure(skeletonStructure, walkthroughResults);
    }

    // Merge prerequisite lesson into structure
    if (prerequisiteLessonResult) {
      skeletonStructure.prerequisites_section.comprehensive_lesson = prerequisiteLessonResult;
      console.log(`[parallel-generate] Prerequisite lesson added with ${prerequisiteLessonResult.concepts?.length || 0} concepts`);
    }

    const phase2Time = Date.now() - phase2Start;
    console.log(`[parallel-generate] Phase 2 complete in ${phase2Time}ms`);

    // =========================================================================
    // FINAL STRUCTURE READY - SANITIZE LATEX
    // =========================================================================
    const structure = sanitizeStructure(skeletonStructure) as LearningStructure;
    const totalTime = Date.now() - startTime;

    console.log(`[parallel-generate] ----------------------------------------`);
    console.log(`[parallel-generate] GENERATION COMPLETE`);
    console.log(`[parallel-generate] Phase 1 (skeleton): ${phase1Time}ms`);
    console.log(`[parallel-generate] Phase 2 (walkthroughs): ${phase2Time}ms`);
    console.log(`[parallel-generate] Total time: ${totalTime}ms`);

    // Calculate metrics
    const metrics = countStructureMetrics(structure);
    console.log(`[parallel-generate] - Total learning units: ${metrics.total_learning_units}`);
    console.log(`[parallel-generate] - Total search queries: ${metrics.total_search_queries}`);
    console.log(`[parallel-generate] - Solution walkthroughs: ${metrics.total_solution_walkthroughs}`);
    console.log(`[parallel-generate] - Prerequisite lesson: ${metrics.has_prerequisite_lesson ? `Yes (${metrics.prerequisite_lesson_concepts} concepts)` : 'No'}`);

    // Store the learning structure in the database
    const insertData = {
      blueprint_id: blueprint_id,
      analysis_id: analysisId,
      document_id: documentId || null,
      user_id: userId,
      structure: structure,
      all_search_queries: [],
      total_prerequisites: metrics.total_prerequisites,
      total_sections: metrics.total_sections,
      total_learning_units: metrics.total_learning_units,
      total_search_queries: metrics.total_search_queries,
      model_used: 'claude-haiku-4-5-parallel',
    };

    console.log('[parallel-generate] Storing structure in database...');

    const { data: newStructure, error: insertError } = await supabase
      .from('blueprint_structures')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[parallel-generate] Database insert error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('[parallel-generate] Structure saved with ID:', newStructure?.id);

    // Update blueprint status
    if (blueprint_id) {
      await supabase
        .from('blueprints')
        .update({ generation_status: 'structure_generated' })
        .eq('id', blueprint_id);
    }

    console.log('[parallel-generate] ========================================');
    console.log('[parallel-generate] SUCCESS - Parallel generation complete!');
    console.log('[parallel-generate] ========================================');

    return new Response(
      JSON.stringify({
        success: true,
        step: 'generate_structure_parallel',
        status: 'structure_generated',
        structure_id: newStructure?.id,
        structure: structure,
        metrics: {
          ...metrics,
          phase1_time_ms: phase1Time,
          phase2_time_ms: phase2Time,
          total_time_ms: totalTime,
        },
        message: `Learning structure generated with ${metrics.total_solution_walkthroughs} solution walkthroughs${metrics.has_prerequisite_lesson ? ` and ${metrics.prerequisite_lesson_concepts} prerequisite lessons` : ''} in ${Math.round(totalTime / 1000)}s (parallel mode).`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[parallel-generate] Error after', totalTime, 'ms:', error);

    if (blueprint_id) {
      try {
        await supabase
          .from('blueprints')
          .update({
            generation_status: 'failed',
            generation_error: error?.message || 'Parallel structure generation failed',
          })
          .eq('id', blueprint_id);
      } catch (updateError) {
        console.error('[parallel-generate] Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error occurred',
        time_ms: totalTime,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
