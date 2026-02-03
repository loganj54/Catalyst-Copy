// ============================================================================
// GENERATE LECTURE BLUEPRINT EDGE FUNCTION
// ============================================================================
// Generates structured lecture blueprints with:
// - Prerequisites section (lecture-specific)
// - Max 7 topic sections with fluid content
// - Conceptual quizzes (70% conceptual, 30% numerical)
// - Reference tables/charts only (no textbook citations)
//
// Content is sourced ONLY from the uploaded document - no external knowledge
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

interface GenerateLectureRequest {
  blueprint_id: string;
}

interface SearchQuery {
  query: string;
  query_type: 'introduction' | 'concept' | 'tutorial' | 'example';
  target_content: string;
  priority: number;
}

interface PrerequisiteUnit {
  unit_id: string;
  unit_type: 'prerequisite';
  topic: string;
  concept_summary: string;
  description: string;
  tutor_guidance: string;
  estimated_time_minutes: number;
  search_queries: SearchQuery[];
}

interface QuizQuestion {
  question_id: string;
  question_type: 'conceptual' | 'numerical';
  question: string;
  options?: string[]; // For multiple choice
  correct_answer: string;
  explanation: string;
}

interface LectureSection {
  section_id: string;
  section_type: 'lecture_topic';
  sidebar_label: string; // Short 3-4 word label for navigation
  title: string; // Full section title
  why_this_matters: string; // Simple language, single key reason
  content_text: string; // Fluid prose: definitions + equations + concepts
  quick_quiz: QuizQuestion[];
  reference_tables: string[]; // Charts/diagrams/tables needed (moody diagram, steam tables, etc.)
}

interface LectureStructure {
  summary: {
    title: string;
    description: string;
    total_estimated_time_minutes: number;
    topic_count: number;
  };
  prerequisites_section: {
    description: string;
    learning_units: PrerequisiteUnit[];
  };
  lecture_sections: LectureSection[];
}

// ============================================================================
// LECTURE BLUEPRINT PROMPT
// ============================================================================

const LECTURE_BLUEPRINT_PROMPT = `You are an expert educational curriculum designer creating a lecture study guide for engineering students.

**YOUR TASK:**
Transform the document analysis into a structured lecture blueprint that helps students deeply understand the material.

**CRITICAL RULES:**
1. ONLY use information from the provided document - do NOT add external knowledge
2. Extract definitions, equations, and concepts EXACTLY as they appear in the document
3. Use the document's variable names and notation - do not standardize or change them
4. Maximum 7 topic sections (fewer is better if the content allows)
5. All math must be in LaTeX: inline $...$ or block $$...$$

**PREREQUISITES SECTION - MANDATORY:**
You MUST generate 3-6 prerequisite topics in the prerequisites_section field.
- These are foundational concepts students need BEFORE studying this lecture
- Think: what math, physics, or prior knowledge does this lecture assume?
- Each prerequisite MUST have:
  - unit_id: unique identifier like "prereq-1", "prereq-2", etc.
  - unit_type: "prerequisite"
  - topic: the prerequisite topic name
  - concept_summary: 10-15 word summary
  - description: 1-2 sentence explanation of why this is needed
  - tutor_guidance: advice for studying this prerequisite
  - estimated_time_minutes: time to review (15-45 min typically)
  - search_queries: 3 YouTube search queries to find tutorials

Example prerequisites for a thermodynamics lecture:
- "Conservation of Energy" - needed to understand energy balance equations
- "Ideal Gas Law" - foundation for gas behavior analysis
- "Basic Calculus (Derivatives)" - needed for rate equations

**LECTURE SECTIONS (Max 7):**
For each major topic in the document, create a section with:

1. **sidebar_label**: A SHORT punchy label for the navigation sidebar
   - CRITICAL: Must be 21 characters or less (including spaces)
   - Examples: "Heat Transfer" (13), "Reynolds Number" (15), "Bernoulli Eq" (12)
   - Keep it tight - abbreviate if needed to stay under 21 chars

2. **title**: The full descriptive title of the section

3. **why_this_matters**: Write this for a 7th grader to understand
   - Use simple, non-technical language
   - Focus on the ONE most important reason this matters
   - No jargon, no complex terms
   - 1-2 sentences max

4. **content_text**: THIS IS THE MAIN CONTENT - MAKE IT COMPREHENSIVE (800-1500 words per section)
   
   Write a well-organized, readable text column that deeply explains the topic. This should read like a friendly professor giving you the real understanding, not a textbook.
   
   **STRUCTURE WITH HEADERS (USE 4-6 HEADERS PER SECTION):**
   Use markdown headers (## Header Name) to organize the content into logical subsections. Each section should have 4-6 headers that break up the content naturally. Example headers:
   - ## The Big Picture
   - ## Key Definitions
   - ## The Core Equation
   - ## How It All Connects
   - ## Watch Out For These Mistakes
   - ## Units and Sanity Checks
   
   **PARAGRAPH STRUCTURE:**
   For longer explanations, start each subsection with a 1-2 sentence introduction that summarizes the key point. Then follow with the detailed explanation in subsequent paragraphs. This makes the content easier to scan and digest.
   
   **CONTENT ELEMENTS TO INCLUDE:**
   
   a) **Big Picture / Intuition** - Start with a mental model. What's the core idea? Use an analogy if helpful.
   
   b) **Key Definitions** - Define important terms AS THEY APPEAR IN THE DOCUMENT. Explain what each term means in plain language.
   
   c) **Core Equations** - Present the key equations from the document. Include MORE equations throughout - don't be sparse! For EACH equation:
      - Introduce it with context in a paragraph
      - Present the equation as a BLOCK EQUATION on its own line: $$equation$$
      - Define EVERY variable immediately after
      - Explain WHEN this equation is valid / what assumptions it requires
      - Explain WHY this equation makes sense intuitively
   
   d) **How Concepts Connect** - Explain how the definitions and equations relate to each other. What's the logical flow?
   
   e) **Common Mistakes & Pitfalls** - Weave in warnings about what students typically get wrong. Use phrases like "A common mistake is..." or "Watch out for..." or "Don't confuse X with Y..."
   
   f) **Units & Sanity Checks** - Mention typical units and magnitudes. What should answers "look like"?
   
   **EQUATION FORMATTING - CRITICAL:**
   - Use INLINE math ($...$) for variables and short expressions within sentences: "where $T$ is temperature"
   - Use BLOCK math ($$...$$) for important equations - these MUST be on their own line, centered:
     
     The relationship is given by:
     
     $$Q = mc\\Delta T$$
     
     where $Q$ is heat transfer...
   
   - Include 3-6 block equations per section where appropriate
   - Block equations should flow naturally: introduce with text, show equation, then explain
   
   **Writing Style:**
   - Casual, clear, confident - like a smart friend explaining
   - No fluff, no "as an AI" nonsense
   - Short paragraphs, easy to scan
   - Use **bold** for key terms when first introduced
   - ONLY use equations and definitions from the document - no external knowledge

5. **quick_quiz**: 5-8 questions per section
   - 70% conceptual multiple choice (test understanding, not calculation)
   - 30% numerical (simple calculations with the equations)
   - Include correct_answer and brief explanation

6. **reference_tables**: ONLY list if the topic requires external charts/tables
   - Examples: "Moody Diagram", "Steam Tables", "Psychrometric Chart"
   - Only include if actually needed for problems
   - Leave empty array if no tables needed

**LATEX FORMATTING - VERY IMPORTANT:**
- INLINE math (within text): Use single dollar signs $...$
  Examples: $F = ma$, $\\Delta T$, $25 \\text{ m/s}$
  
- BLOCK equations (centered, on own line): Use double dollar signs $$...$$
  MUST be on their own line with blank lines before and after:
  
  The fundamental equation is:
  
  $$Q = mc\\Delta T$$
  
  where $Q$ represents...

- Use $\\cdot$ for multiplication (NOT \\cdotp)
- Double-escape backslashes in JSON: \\\\frac, \\\\Delta
- NEVER mix block and inline - block equations get their own paragraph

**OUTPUT FORMAT:**
Return valid JSON with the LectureStructure schema. Ensure all brackets are properly closed.`;

function generateLectureUserPrompt(analysisData: any): string {
  return `Generate a lecture blueprint from this document analysis.

**DOCUMENT TYPE:** ${analysisData.document_type || 'lecture'}
**SUBJECT AREA:** ${analysisData.subject_area || 'Engineering'}
**SPECIFIC TOPIC:** ${analysisData.specific_topic || 'Unknown'}

**DOCUMENT SECTIONS:**
${JSON.stringify(analysisData.sections || [], null, 2)}

**KEY EQUATIONS FROM DOCUMENT:**
${JSON.stringify(analysisData.key_equations || [], null, 2)}

**PREREQUISITES FROM ANALYSIS (use as hints, but generate your own):**
${JSON.stringify(analysisData.prerequisites || [], null, 2)}

**STUDY RECOMMENDATIONS:**
${JSON.stringify(analysisData.study_recommendations || {}, null, 2)}

**CRITICAL REQUIREMENTS:**
1. You MUST include a prerequisites_section with 3-6 learning_units - this is REQUIRED
2. ONLY use content from this document - no external knowledge for lecture content
3. Keep sidebar_label to 21 characters or LESS (very important for UI layout)
4. Write why_this_matters at a 7th grade reading level
5. Maximum 7 lecture sections
6. 70% conceptual quiz questions, 30% numerical
7. Only include reference_tables if actually needed

**OUTPUT STRUCTURE (follow exactly):**
{
  "summary": { "title": "...", "description": "...", "total_estimated_time_minutes": N, "topic_count": N },
  "prerequisites_section": {
    "description": "Topics you should understand before this lecture",
    "learning_units": [
      { "unit_id": "prereq-1", "unit_type": "prerequisite", "topic": "...", "concept_summary": "...", "description": "...", "tutor_guidance": "...", "estimated_time_minutes": N, "search_queries": [...] },
      ...3-6 more prerequisites...
    ]
  },
  "lecture_sections": [...]
}

Output valid JSON only.`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sanitizeLatex(text: string): string {
  if (!text) return text;
  return text.replace(/\\cdotp/g, '\\cdot');
}

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

function countMetrics(structure: LectureStructure) {
  const prerequisiteUnits = structure.prerequisites_section?.learning_units?.length || 0;
  const lectureSections = structure.lecture_sections?.length || 0;
  
  let totalQuizQuestions = 0;
  let totalSearchQueries = 0;

  for (const unit of structure.prerequisites_section?.learning_units || []) {
    totalSearchQueries += unit.search_queries?.length || 0;
  }

  for (const section of structure.lecture_sections || []) {
    totalQuizQuestions += section.quick_quiz?.length || 0;
  }

  return {
    total_prerequisites: prerequisiteUnits,
    total_sections: lectureSections,
    total_quiz_questions: totalQuizQuestions,
    total_search_queries: totalSearchQueries,
  };
}

// ============================================================================
// MAIN HANDLER
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

    const body: GenerateLectureRequest = await req.json();
    blueprint_id = body.blueprint_id;

    if (!blueprint_id) {
      throw new Error('Missing required field: blueprint_id');
    }

    console.log(`[lecture-blueprint] ========================================`);
    console.log(`[lecture-blueprint] Starting lecture blueprint generation`);
    console.log(`[lecture-blueprint] Blueprint ID: ${blueprint_id}`);
    console.log(`[lecture-blueprint] ========================================`);

    // Verify user owns this blueprint
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

    const userId = blueprint.user_id;
    const documentId = blueprint.document_id || null;
    console.log(`[lecture-blueprint] Found blueprint: ${blueprint.title || blueprint_id}`);

    // Find the document analysis
    let analysis = null;
    let analysisId: string | null = null;

    if (documentId) {
      console.log(`[lecture-blueprint] Searching by document_id: ${documentId}`);
      const { data: docMatch } = await supabase
        .from('document_analyses')
        .select('*')
        .eq('document_id', documentId)
        .maybeSingle();

      if (docMatch) {
        console.log('[lecture-blueprint] Found analysis by document_id');
        analysis = docMatch;
      }
    }

    if (!analysis) {
      console.log(`[lecture-blueprint] Searching by blueprint_id: ${blueprint_id}`);
      const { data: bpMatch } = await supabase
        .from('document_analyses')
        .select('*')
        .eq('blueprint_id', blueprint_id)
        .maybeSingle();

      if (bpMatch) {
        console.log('[lecture-blueprint] Found analysis by blueprint_id');
        analysis = bpMatch;
      }
    }

    if (!analysis) {
      throw new Error('Document analysis not found. Please run analyze-document first.');
    }

    analysisId = analysis.id;
    const analysisData = analysis.raw_analysis;

    console.log(`[lecture-blueprint] Document type: ${analysisData.document_type}`);
    console.log(`[lecture-blueprint] Sections in analysis: ${analysisData.sections?.length || 0}`);

    // Delete any existing structure for this blueprint
    await supabase
      .from('blueprint_structures')
      .delete()
      .eq('blueprint_id', blueprint_id);

    // Update blueprint status
    await supabase
      .from('blueprints')
      .update({
        generation_status: 'generating_lecture_structure',
        generation_error: null,
      })
      .eq('id', blueprint_id);

    // =========================================================================
    // GENERATE LECTURE STRUCTURE
    // =========================================================================
    console.log(`[lecture-blueprint] Generating lecture structure...`);

    const lectureStructure = await callClaudeJSON<LectureStructure>(
      LECTURE_BLUEPRINT_PROMPT,
      generateLectureUserPrompt(analysisData),
      { temperature: 0.3, maxTokens: 32000 }
    );

    const generationTime = Date.now() - startTime;
    console.log(`[lecture-blueprint] Generation complete in ${generationTime}ms`);
    console.log(`[lecture-blueprint] - Title: ${lectureStructure.summary?.title}`);
    console.log(`[lecture-blueprint] - Prerequisites: ${lectureStructure.prerequisites_section?.learning_units?.length || 0}`);
    console.log(`[lecture-blueprint] - Lecture sections: ${lectureStructure.lecture_sections?.length || 0}`);

    // Sanitize LaTeX
    const structure = sanitizeStructure(lectureStructure) as LectureStructure;

    // Calculate metrics
    const metrics = countMetrics(structure);
    console.log(`[lecture-blueprint] - Total quiz questions: ${metrics.total_quiz_questions}`);
    console.log(`[lecture-blueprint] - Total search queries: ${metrics.total_search_queries}`);

    // Store the lecture structure in the database
    // We use the same blueprint_structures table but with structure_type indicator
    const insertData = {
      blueprint_id: blueprint_id,
      analysis_id: analysisId,
      document_id: documentId || null,
      user_id: userId,
      structure: {
        ...structure,
        structure_type: 'lecture', // Mark as lecture type
      },
      all_search_queries: [],
      total_prerequisites: metrics.total_prerequisites,
      total_sections: metrics.total_sections,
      total_learning_units: metrics.total_prerequisites + metrics.total_sections,
      total_search_queries: metrics.total_search_queries,
      model_used: 'claude-haiku-4-5-lecture',
    };

    console.log('[lecture-blueprint] Storing structure in database...');

    const { data: newStructure, error: insertError } = await supabase
      .from('blueprint_structures')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[lecture-blueprint] Database insert error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('[lecture-blueprint] Structure saved with ID:', newStructure?.id);

    // Update blueprint status
    await supabase
      .from('blueprints')
      .update({ generation_status: 'lecture_structure_generated' })
      .eq('id', blueprint_id);

    // =========================================================================
    // STEP: Ensure Document Embeddings Exist for Chat
    // =========================================================================
    // Check if document chunks exist - if not, trigger embedding generation
    // This ensures "Chat with Document" works for lecture blueprints
    if (documentId) {
      const { count: chunkCount } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (!chunkCount || chunkCount === 0) {
        console.log('[lecture-blueprint] No document chunks found - triggering embedding generation...');
        
        // Get the extracted text from the analysis
        const extractedText = analysis.extracted_text || analysisData.extracted_text || null;
        
        // Trigger embedding generation in background (don't await)
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-document-embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            document_id: documentId,
            extracted_text: extractedText,
            user_id: userId,
            class_id: blueprint.class_id
          })
        }).then(() => {
          console.log('[lecture-blueprint] Embedding generation triggered successfully');
        }).catch(err => {
          console.error('[lecture-blueprint] Background embedding trigger failed:', err);
        });
      } else {
        console.log(`[lecture-blueprint] Document already has ${chunkCount} chunks - chat ready`);
      }
    }

    console.log('[lecture-blueprint] ========================================');
    console.log('[lecture-blueprint] SUCCESS - Lecture blueprint generated!');
    console.log('[lecture-blueprint] ========================================');

    return new Response(
      JSON.stringify({
        success: true,
        step: 'generate_lecture_blueprint',
        status: 'lecture_structure_generated',
        structure_id: newStructure?.id,
        structure: structure,
        metrics: {
          ...metrics,
          generation_time_ms: generationTime,
        },
        message: `Lecture blueprint generated with ${metrics.total_sections} topic sections and ${metrics.total_quiz_questions} quiz questions.`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[lecture-blueprint] Error after', totalTime, 'ms:', error);

    if (blueprint_id) {
      try {
        await supabase
          .from('blueprints')
          .update({
            generation_status: 'failed',
            generation_error: error?.message || 'Lecture blueprint generation failed',
          })
          .eq('id', blueprint_id);
      } catch (updateError) {
        console.error('[lecture-blueprint] Failed to update error status:', updateError);
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

