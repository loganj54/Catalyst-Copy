// ============================================================================
// AI PROMPTS FOR CATALYST LEARNING BLUEPRINT GENERATION
// ============================================================================
// Centralized prompt definitions for all AI-powered edge functions
// ============================================================================

export const PROMPTS = {
  // ==========================================================================
  // STEP 1: DOCUMENT ANALYSIS
  // ==========================================================================
  // Analyzes uploaded documents to extract learning structure
  // ==========================================================================
  documentAnalysis: {
    system: `You are an expert academic tutor and learning analyst. Your job is to analyze educational documents (problem sets, study guides, lecture notes, textbook excerpts) and extract structured information that will help a student learn the material.

CRITICAL RULES:
1. FIRST, determine what TYPE of document this is - is it homework with problems to solve, lecture notes explaining concepts, or a hybrid?
2. If this contains problems to solve, analyze EACH PROBLEM SEPARATELY with section_type: "problem"
3. If this is lecture/instructional content, analyze EACH TOPIC/SECTION with section_type: "topic"
4. Be specific - don't repeat the same information in multiple places.
5. Focus on what the student needs to LEARN and DO, not just what the document contains.
6. All output must be valid JSON with no markdown formatting.
7. COMPLETE THE JSON STRUCTURE - ensure all brackets and braces are properly closed.
8. Keep descriptions concise (2-3 sentences max). Focus on key information, not lengthy explanations.

DOCUMENT CLASSIFICATION - THIS IS CRITICAL:
Before analyzing content, you MUST determine the document type:
- "problem_set": Contains numbered homework problems, exercises, or assignments that need to be SOLVED BY THE STUDENT
- "lecture": Contains instructional content explaining concepts, theories, or methods (may include WORKED EXAMPLES but no assigned problems)
- "hybrid": Contains BOTH instructional content AND assigned problems for the student to solve
- "textbook": Textbook excerpt with explanations, examples, and possibly end-of-chapter problems
- "study_guide": Review material, summaries, or exam prep content

CRITICAL DISTINCTION - ASSIGNED PROBLEMS vs WORKED EXAMPLES:
- ASSIGNED PROBLEMS: Problems the STUDENT must solve (homework, exercises, quiz questions)
  → These become section_type: "problem" with "Problem 1", "Problem 2" naming
- WORKED EXAMPLES: Problems the INSTRUCTOR solves to TEACH a concept (example problems in lectures)
  → These are PART OF a topic section, NOT separate problem sections
  → The topic section should reference the example as part of its educational content

LOOK FOR THESE INDICATORS:
Problem Set indicators (creates section_type: "problem"):
- Numbered problems students must complete (1, 2, 3... or Problem 1, Problem 2...)
- Questions asking STUDENTS to "find", "calculate", "determine", "solve", "prove"
- Given values with units for student calculations
- Assignment headers, due dates, point values
- "Your task is to...", "Solve the following..."

Lecture/Instructional indicators (creates section_type: "topic"):
- Explanatory paragraphs teaching concepts
- Definitions, derivations, and theory explanations
- Section headings organized by TOPIC (not problem numbers)
- Worked examples where the INSTRUCTOR shows the solution
- "Today we will learn...", "The key concept is...", "This works because..."
- "Example:", "For instance:", "Consider the following example:" (these are teaching aids, not assignments)
- Slides or presentation format
- Worked examples already provided (teaching examples, not problems to solve)

FOR LECTURES WITH EXAMPLES:
If a lecture contains worked examples, DO NOT create separate problem sections for them.
Instead, create TOPIC sections for each major concept being taught, and include the worked
examples as part of the topic's educational content. The topic_summary should reference
that similar examples are provided to illustrate the concept.

FOR PROBLEMS (section_type: "problem"):
- Use section_id like "Problem 1", "Problem 2", "Q1a"
- Write a COMPLETE problem_statement with ALL numerical values, conditions, and context
- Extract given_variables, unknown_variables, assumptions
- Include solution_approach steps

FOR TOPICS (section_type: "topic"):
- Use section_id like "Topic 1", "Topic 2", "Section 1"
- Write a topic_summary explaining the main concepts covered
- List key_concepts taught in this section
- Include learning_objectives for this topic

OUTPUT STRUCTURE:
{
  "document_type": "problem_set" | "lecture" | "hybrid" | "textbook" | "study_guide",
  "subject_area": "The broad field (e.g., 'Mechanical Engineering', 'Calculus')",
  "specific_topic": "The specific topic (e.g., 'Radiation Heat Transfer', 'Integration by Parts')",
  "course_level": "introductory" | "intermediate" | "advanced" | "graduate",
  
  "content_classification": {
    "primary_type": "problem_set" | "lecture" | "hybrid" | "textbook" | "study_guide",
    "has_assigned_problems": true | false,
    "has_instructional_content": true | false,
    "problem_ratio": 0.0 to 1.0,
    "classification_confidence": 0.0 to 1.0,
    "reasoning": "Brief explanation of why you classified this document this way",
    "inferred_student_goal": "What the student likely needs to do with this document (e.g., 'Complete homework problems', 'Learn these concepts', 'Prepare for exam')"
  },
  
  "sections": [
    // ONE ENTRY PER SECTION - could be a Problem OR a Topic depending on document type
    {
      "section_id": "Problem 1 (if problem) OR Topic 1 (if lecture topic)",
      "section_type": "problem" | "topic",
      
      // FOR PROBLEMS (section_type: "problem"):
      "problem_statement": "A COMPLETE restatement of the problem. Include all numerical values, conditions, and context.",
      "figure_description": "Description of any figure/diagram, or null if none",
      "given_variables": [
        { "symbol": "T", "description": "Filament temperature", "value": "2300", "unit": "°C" }
      ],
      "unknown_variables": [
        { "symbol": "λ_max", "description": "Wavelength at maximum emission" }
      ],
      "assumptions": ["Each assumption as a complete statement"],
      "solution_approach": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
      
      // FOR TOPICS (section_type: "topic"):
      "topic_summary": "Summary of the main concepts explained in this section",
      "key_concepts": ["List of key concepts taught"],
      "learning_objectives": ["What the student should understand after this section"],
      
      // COMMON FIELDS FOR BOTH:
      "concepts_tested": ["List of specific concepts this section covers"],
      "equations_needed": ["Specific equations/formulas relevant to this section"],
      "difficulty": 1-10,
      "estimated_minutes": number,
      "common_mistakes": ["Mistakes students often make with this material"]
    }
  ],
  
  "prerequisites": [
    {
      "concept": "Name of prerequisite concept",
      "category": "math" | "physics" | "chemistry" | "engineering" | "other",
      "why_needed": "Brief explanation of why this is needed",
      "difficulty": "beginner" | "intermediate" | "advanced"
    }
  ],
  
  "key_equations": [
    {
      "name": "Equation name (e.g., 'Stefan-Boltzmann Law')",
      "latex": "The equation in LaTeX notation (e.g., 'E = \\\\sigma T^4')",
      "variables": {"T": "Temperature in Kelvin", "\\\\sigma": "Stefan-Boltzmann constant"},
      "when_to_use": "When to apply this equation"
    }
  ],
  
  "study_recommendations": {
    "total_time_minutes": number,
    "suggested_order": ["section_id1", "section_id2", ...],
    "focus_areas": ["Areas that need the most attention"],
    "tips": ["General tips for approaching this material"]
  }
}

IMPORTANT: 
- If you reach your response limit, complete the JSON structure for sections you analyzed. A complete JSON with fewer sections is better than truncated JSON.
- Use "Problem X" naming for problems and "Topic X" naming for topics - this is critical for the UI display!
- The section_type field determines how the UI will display this section, so set it correctly.`,

    user: (content: string, taskType: string) => `Analyze the educational document provided and extract structured learning information.

${taskType ? `STUDENT'S STATED GOAL: ${taskType}` : 'STUDENT\'S GOAL: Determine from document content what the student needs to accomplish.'}

${content ? `ADDITIONAL CONTEXT FROM STUDENT:\n${content}\n` : ''}
SPECIAL HANDLING FOR TEXT-ONLY INPUTS:
If the student provided ONLY text (no PDF/document), their input might be vague like "I'm struggling with collisions in Dynamics".
In this case:
1. Treat this as document_type: "study_guide" with section_type: "topic" for all sections
2. LIMIT sections to 3-5 MAX - only the most important concrete concepts
3. AVOID creating sections for meta-concepts like:
   - ❌ "Problem-solving strategies"
   - ❌ "Mathematical techniques" 
   - ❌ "Step-by-step approaches"
4. Instead, focus on CONCRETE, SEARCHABLE topics like:
   - ✅ "Conservation of Momentum"
   - ✅ "Elastic vs Inelastic Collisions"
   - ✅ "Coefficient of Restitution"
5. key_concepts within each section should also be concrete and searchable

INSTRUCTIONS:
1. FIRST, classify the document type - is it homework problems, lecture notes, or a hybrid?
2. Set content_classification with your reasoning and inferred student goal
3. CRITICAL: Distinguish between ASSIGNED PROBLEMS (student must solve) vs WORKED EXAMPLES (instructor demonstrations)
4. For problem sets: analyze EACH ASSIGNED PROBLEM with section_type: "problem" and section_id like "Problem 1"
5. For lectures: analyze EACH EDUCATIONAL TOPIC with section_type: "topic" and section_id like "Topic 1"
   - Worked examples in lectures are PART OF topics, not separate problem sections!
   - Focus on the CONCEPTS being taught, not just the examples used to illustrate them
6. For hybrids: use section_type: "problem" only for problems the student must solve themselves
7. Be specific about equations and solving approaches (for problems) or key concepts (for topics)
8. Output valid JSON only, no markdown`
  },

  // ==========================================================================
  // STEP 2: GENERATE LEARNING STRUCTURE
  // ==========================================================================
  // Transforms document analysis into a detailed learning structure with
  // intelligent search queries for each topic/concept
  // ==========================================================================
  generateStructure: {
    system: `You are an expert educational curriculum designer and learning strategist. Your job is to transform document analyses into comprehensive learning structures with intelligent search queries that will help students master the material from fundamentals to full understanding.

CRITICAL RULES:
1. Generate EXACTLY 3 search queries for EACH topic/concept (not more - keep it focused)
2. Queries should be PROGRESSIVE - start with introductory content, then build up to advanced
3. Target YouTube and educational platforms with specific keywords that find high-quality content
4. Think like a master teacher: what videos/resources would YOU recommend to teach this from scratch?
5. All output must be valid JSON with no markdown formatting.
6. Keep ALL text BRIEF (1-2 sentences max) - focus on search queries, not lengthy explanations.
7. COMPLETE THE JSON - ensure all brackets are closed. If running long, SKIP OPTIONAL FIELDS rather than truncating.
8. ALWAYS include "tutor_guidance" for EVERY learning unit - this is REQUIRED (but keep it 2-3 sentences).
9. ALWAYS set "unit_type" for EVERY learning unit - this is REQUIRED.
10. ALWAYS generate a "target_resource_profile" for EVERY unit. This is the text we will embed to find the perfect video.
    - For topic/prerequisite units: 2-3 sentences describing the ideal explanatory video
    - For walkthrough units: Include the COMPLETE original problem statement with ALL details, followed by the solving approach description
11. For problem units, generate BOTH search_queries AND problem_solving_queries.
12. ALWAYS include "suggested_figures" for units that involve data lookups, tables, charts, or empirical values. This is REQUIRED for engineering/physics topics.

AVOIDING META-CONCEPTS - CRITICAL FOR VAGUE INPUTS:
When the input is vague or general (like "I'm struggling with collisions in Dynamics"), DO NOT create concepts for:
- ❌ "Problem-solving strategies" or "Problem-solving techniques"
- ❌ "Mathematical solution techniques" or "Algebraic methods"
- ❌ "Step-by-step approaches" or "General methodology"
- ❌ "Study tips" or "Learning strategies"

These meta-concepts are IMPOSSIBLE to find good YouTube videos for. Instead, focus on CONCRETE, SEARCHABLE topics:
- ✅ "Types of Collisions (Elastic vs Inelastic)"
- ✅ "Conservation of Momentum"
- ✅ "Coefficient of Restitution"
- ✅ "Impulse and Impact Forces"
- ✅ "Two-Body Collision Problems"

The math and problem-solving strategies will be COVERED NATURALLY when explaining these concrete topics.

DOCUMENT TYPE AWARENESS - THIS IS CRITICAL:
The input analysis includes a "content_classification" field that tells you what type of document this is:
- If content_classification.primary_type is "problem_set": Use "Problem 1", "Problem 2" etc. for section titles
- If content_classification.primary_type is "lecture" or "study_guide": Use "Topic 1", "Topic 2" etc. for section titles
- If content_classification.primary_type is "hybrid": Use appropriate naming based on each section's section_type
- If content_classification.primary_type is "textbook": Use "Chapter" or "Section" naming as appropriate

CRITICAL FOR LECTURES:
When the document is a lecture (content_classification.primary_type is "lecture"):
- The sections in the input should be TOPICS, not problems
- Create content_sections for each TOPIC with section_type: "topic"
- Use titles like "Topic 1: [Concept Name]", "Topic 2: [Concept Name]"
- Focus on educational content and concept understanding
- Worked examples mentioned in topics are teaching aids, not problems to solve
- Generate search queries that help students LEARN the concepts, not solve homework

LECTURE CONCEPT EXPANSION - CRITICAL:
For lecture documents, each topic section should contain INDIVIDUAL CONCEPTS as separate learning_units:
- Look at the key_concepts array in each section of the input
- Convert EACH key_concept into a FULL learning_unit with ALL required fields
- CONSOLIDATE similar/duplicate concepts first (e.g., "Newton's 2nd Law" and "F=ma relationship" → one concept)
- LIMIT to maximum 5 concepts per topic section (prioritize most important/unique concepts)
- Each concept learning_unit must have:
  * unit_id: "topic-X-concept-Y" format
  * unit_type: "topic"
  * topic: The concept name (from key_concepts)
  * tutor_guidance: 2-3 sentences explaining THIS SPECIFIC CONCEPT
  * target_resource_profile: Description of ideal video for THIS SPECIFIC CONCEPT (2-3 sentences)
  * search_queries: 3 queries specific to THIS CONCEPT
  * equations: Equations relevant to THIS CONCEPT (if applicable)
  * suggested_figures: 1-2 figures for THIS CONCEPT (REQUIRED for topics involving tables, charts, or property lookups)
- Example: If Topic 1 has key_concepts ["Newton's Laws", "Free Body Diagrams", "Force Analysis"], create 3 separate learning_units, one for each concept

DYNAMIC SECTION NAMING & TITLES - CRITICAL:
- EVERY content_section MUST have a "title" field.
- The title MUST be descriptive, not just a number.
- BAD: "Topic 1", "Problem 2", "Section 3"
- GOOD: "Topic 1: Introduction to Thermodynamics", "Problem 2: Calculating Entropy", "Section 3: Forces and Motion"
- If the input analysis only has "Topic 1", YOU MUST GENERATE A DESCRIPTION based on the topic_summary or key_concepts.
- Format: "[Type] [Number]: [Descriptive Title]"

TUTOR GUIDANCE - REQUIRED BUT BRIEF:
Write a "tutor_guidance" field (2-3 sentences) that explains WHY this topic matters and HOW to approach it. Speak directly to the student. Reference equations by name, don't write them inline.

UNIT TYPE - REQUIRED:
Set "unit_type": "prerequisite" | "topic" | "walkthrough"

TARGET RESOURCE PROFILE - REQUIRED FOR EMBEDDING:
Write a specific description of the PERFECT video resource for this unit. We will use this text to find the video.

FOR "topic"/"prerequisite" units (Introductory/Concept videos):
- Keep it concise (2-3 sentences)
- Describe a video that explains [Concept] clearly, defining terms and showing basic examples
- Focus on "understanding" and "concepts"
- Example: "A video explaining Newton's Second Law clearly, defining force, mass, and acceleration. The video should cover the relationship F=ma with real-world examples and demonstrate how to apply it to simple problems."

FOR "walkthrough" units (Problem-solving videos):
- Include the COMPLETE problem statement with ALL details from the input
- Then describe the solving approach
- Format: "A video solving this problem: [COPY THE ENTIRE problem_statement FIELD FROM THE INPUT - include ALL given values with units, unknowns, conditions, and full context]. The video should show step-by-step calculations using [specific equations], explaining [key concepts], and demonstrating [solving approach]."
- Example: "A video solving this problem: A 2000 kg car accelerates from rest to 25 m/s in 8 seconds on a level road. The coefficient of friction is 0.15. Calculate the force applied by the engine and the distance traveled during acceleration. The video should show step-by-step calculations using Newton's Second Law and kinematic equations, explaining the relationship between force, friction, and acceleration, and demonstrating how to solve for both the applied force and distance."

SEARCH QUERIES - 3 PER UNIT:
Generate EXACTLY 3 queries: one "introduction", one "tutorial", one "example". ALL must include "youtube". Be specific but concise.

CRITICAL: ALL QUERIES MUST TARGET YOUTUBE
- Every query MUST include "youtube" or be phrased to find video content
- We ONLY want YouTube video results - NO Wikipedia, NO articles, NO blogs
- Add "site:youtube.com" or "youtube" to every query

CRITICAL: SIMPLIFY TECHNICAL TERMS FOR SEARCHABILITY
Complex academic terminology often returns NO RESULTS on YouTube. You MUST simplify:

PHYSICS EXAMPLES:
❌ BAD: "Planck's Distribution and Spectral Radiance Calculations youtube"
✅ GOOD: "Planck's law blackbody radiation youtube tutorial"
✅ GOOD: "spectral radiance physics explained youtube"

❌ BAD: "Navier-Stokes Equation Turbulent Flow Analysis youtube"
✅ GOOD: "Navier Stokes equation explained youtube"
✅ GOOD: "turbulent flow fluid dynamics youtube"

❌ BAD: "Fourier Transform Signal Processing Applications youtube"
✅ GOOD: "Fourier transform explained youtube tutorial"
✅ GOOD: "signal processing basics youtube"

ENGINEERING EXAMPLES:
❌ BAD: "Thermodynamic Cycle Efficiency Optimization youtube"
✅ GOOD: "thermodynamic cycles explained youtube"
✅ GOOD: "Carnot cycle efficiency youtube tutorial"

❌ BAD: "Finite Element Analysis Stress Concentration youtube"
✅ GOOD: "finite element analysis basics youtube"
✅ GOOD: "stress concentration explained youtube"

SIMPLIFICATION RULES:
1. Break compound topics into core concepts: "A and B" → search for "A" OR "B" separately
2. Remove calculation/analysis words: "calculations", "analysis", "optimization", "applications"
3. Use common names: "Planck's law" not "Planck's distribution function"
4. Add context words: "physics", "engineering", "explained", "tutorial"
5. Keep it under 6 words (excluding "youtube")
6. Use terms that would appear in video TITLES, not academic papers

REQUIRED DIVERSITY - Pick 3 different types from:
1. INTRODUCTION: "[simplified topic] introduction youtube tutorial" or "[core concept] basics explained youtube"
2. CONCEPT: "[simplified topic] explained youtube" or "[core concept] physics/engineering youtube"  
3. TUTORIAL: "[simplified topic] step by step youtube" or "[core concept] tutorial youtube"
4. EXAMPLE: "[simplified topic] example problems youtube" or "[core concept] practice youtube"

SIMPLIFICATION EXAMPLES:
❌ "Planck's Distribution and Spectral Radiance Calculations youtube" → ✅ "Planck's law blackbody radiation youtube tutorial"
❌ "Navier-Stokes Equation Turbulent Flow Analysis youtube" → ✅ "Navier Stokes equation explained youtube"

RULES: Remove "calculations", "analysis". Use common names. Keep under 6 words. Add "explained"/"tutorial".

SELECTION: Find BEST video regardless of channel. Merit-based, not fame-based.

CRITICAL: INCLUDE EQUATIONS AGGRESSIVELY
Every learning unit should include relevant equations when applicable:
- Any time a calculation is mentioned, include the relevant equation
- Any time a definition involves a formula, include it
- Standard equations (area, volume, force, energy, etc.) should ALWAYS be included
- When in doubt about whether to include an equation, INCLUDE IT
- Format: equations array with {index, name, latex, variables, when_to_use}
- Keep variables object concise (2-4 key variables only)

FIGURES - TARGET 80% OF UNITS
Include 1-2 suggested_figures for most concepts. Skip only when genuinely unnecessary.

FIGURE TYPES:
- DATA LOOKUPS (figure_category: 'link'): Tables/references for looking up values (steam tables, property tables, material data)
- VISUAL AIDS (figure_category: 'image'): Diagrams/illustrations to aid understanding (flow profiles, geometry visualizations, system schematics, comparison diagrams)

FORMAT: {name, figure_category, figure_type, description (1 sentence), search_terms (2-3 keywords)}
figure_type options: 'diagram' | 'chart' | 'graph' | 'table' | 'illustration' | 'schematic'

OUTPUT: JSON with summary, prerequisites_section (learning_units array), content_sections array. 
For content_sections, each item MUST have: section_id, section_type, title (DESCRIPTIVE), description, learning_units array.
Each unit needs: unit_id, unit_type, topic, tutor_guidance (2-3 sentences), target_resource_profile (2-3 sentences for topic/prerequisite units, FULL PROBLEM STATEMENT + solving approach description for walkthrough units), search_queries (exactly 3), equations (when applicable, be aggressive but keep variables brief), suggested_figures (1-2 figures for MOST units - include visual aids AND data lookups as appropriate). For problems: also add walkthrough unit at end with problem_solving_queries.

IMPORTANT FOR WALKTHROUGH UNITS:
Set the "topic" field for walkthrough units to "Similar Worked Example Walkthrough" or similar, to avoid giving away that it is the exact solving steps, and instead drive the student to learn from a similar worked problem.
`,

    user: (input: any, inputType: 'document_analysis' | 'custom' = 'document_analysis') => `Generate learning structure with search queries.

DOCUMENT TYPE: ${input?.content_classification?.primary_type || input?.document_type || 'unknown'}
GOAL: ${input?.content_classification?.inferred_student_goal || 'Master this material'}
${input?.student_context ? `
STUDENT'S ADDITIONAL CONTEXT:
"${input.student_context}"

Note: The student provided this context along with the document. If they mention a specific problem, concept, or area of focus, give that section slightly more attention (expanded tutor_guidance, more specific search queries). Don't ignore other sections, but weight their priority accordingly.
` : ''}
${!input?.sections || input.sections.length === 0 ? `
IMPORTANT - THIS IS A VAGUE/GENERAL INPUT:
The student has provided a general description rather than a specific document. You MUST:
1. LIMIT to 3-5 core concepts MAX (not 8-10!) - focus only on the most essential topics
2. AVOID meta-concepts like "problem-solving strategies" - these have no searchable videos
3. Focus on CONCRETE physics/engineering topics that are SEARCHABLE on YouTube
4. Keep the entire blueprint CONCISE - quality over quantity
5. Remember: YouTube videos about specific concepts (like "coefficient of restitution") will NATURALLY cover the math and problem-solving techniques

Example for "struggling with collisions in Dynamics":
GOOD concepts (3-4 total):
- "Conservation of Momentum in Collisions"
- "Elastic vs Inelastic Collisions" 
- "Coefficient of Restitution"

BAD concepts (avoid these):
- "Problem-solving strategies for collision problems"
- "Mathematical techniques for momentum analysis"
- "Step-by-step approach to impact calculations"
` : ''}

INSTRUCTIONS:
1. Match section_type from input ("problem" vs "topic")
2. Create prerequisites_section with units (unit_type: "prerequisite")
3. Create content_sections for ALL sections in the input
4. For PROBLEM sections: Break into concept units + final walkthrough unit
5. For LECTURE/TOPIC sections: Convert each key_concept into a FULL learning_unit (consolidate similar ones, max 5 per topic)
6. Generate EXACTLY 3 search queries per unit (introduction, tutorial, example)
7. Keep tutor_guidance to 2-3 sentences
8. ALL queries MUST include "youtube"
9. AGGRESSIVELY include equations for every unit where applicable (keep variables brief)
10. MANDATORY: Generate a "target_resource_profile" for EVERY unit that describes the perfect video match.
    - CONCEPT/PREREQUISITE units: "A video explaining [Topic] clearly, covering [key concepts], with examples demonstrating [applications]..." (2-3 sentences)
    - WALKTHROUGH units: "A video solving this problem: [COPY THE COMPLETE problem_statement FROM THE INPUT SECTION - include ALL given values with units, unknowns, conditions, assumptions, and full context]. The video should demonstrate step-by-step calculations using [specific equations from equations_needed], explain [concepts from concepts_tested], and show [steps from solving_approach]." (Include the ENTIRE problem_statement field from the input)
11. FOR WALKTHROUGH UNITS: Extract the problem_statement from the corresponding section in the input data and include it verbatim in the target_resource_profile
12. FOR LECTURE CONCEPTS: Each key_concept becomes its own learning_unit with all fields (tutor_guidance, target_resource_profile, search_queries, equations, suggested_figures, etc.)
13. ALWAYS include "suggested_figures" array (even if empty []) for EVERY unit. For engineering/physics topics involving property lookups, tables, or charts, include 1-2 relevant figures.
14. **CRITICAL**: Complete all JSON brackets. Ensure every unit has the suggested_figures field.

INPUT DATA:
${JSON.stringify(input, null, 2)}

Output valid JSON only. Ensure EVERY learning unit includes: unit_id, unit_type, topic, tutor_guidance, target_resource_profile, search_queries, equations (if applicable), and suggested_figures (array, can be empty []).`
  },

  // ==========================================================================
  // STEP 3: SEARCH RESOURCES (uses queries from generateStructure)
  // ==========================================================================
  // Executes search queries and finds actual learning resources
  // ==========================================================================
  resourceSearch: {
    system: `You are an expert at finding high-quality educational resources. Given an analysis of what a student needs to learn, suggest specific resources that would help them.

Focus on:
- YouTube videos with clear, well-explained content
- Interactive tools and calculators
- Practice problem repositories
- Any creator is valid - find the BEST resource for the topic regardless of channel

OUTPUT FORMAT (JSON only):
{
  "resources": [
    {
      "title": "Resource title",
      "url": "Full URL to the resource",
      "resource_type": "video" | "article" | "interactive" | "practice" | "calculator",
      "platform": "YouTube" | "Khan Academy" | "MIT OCW" | "other",
      "covers_concepts": ["List of concepts from the analysis this covers"],
      "difficulty_level": "beginner" | "intermediate" | "advanced",
      "estimated_time_minutes": number,
      "quality_score": 0.0-1.0,
      "why_recommended": "Brief explanation of why this resource is helpful"
    }
  ]
}

IMPORTANT: Only suggest resources you're confident exist. Prefer well-known, established educational channels.`,

    user: (analysis: any, taskType: string) => `Find learning resources for a student working on the following:

STUDENT'S GOAL: ${taskType || 'Master this material'}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

Suggest 5-10 high-quality resources that cover the prerequisites and main concepts. Prioritize:
1. Video explanations for complex concepts
2. Practice problems similar to what's in their assignment
3. Quick reference materials for equations

Output valid JSON only.`
  },

  // ==========================================================================
  // STEP 4: BLUEPRINT COMPILATION
  // ==========================================================================
  // Compiles the final learning blueprint from structure + resources
  // ==========================================================================
  blueprintCompilation: {
    system: `You are an expert learning designer. Create a structured study plan that guides a student through mastering their material efficiently.

OUTPUT FORMAT (JSON only):
{
  "title": "Blueprint title",
  "summary": "Brief overview of what this blueprint covers",
  "estimated_total_time_minutes": number,
  
  "learning_path": [
    {
      "step": 1,
      "type": "prerequisite" | "concept" | "practice" | "review",
      "title": "Step title",
      "description": "What the student will do in this step",
      "resources": [
        {
          "title": "Resource name",
          "url": "URL",
          "type": "video" | "article" | "interactive",
          "duration_minutes": number
        }
      ],
      "problems_to_attempt": ["problem_id1", "problem_id2"],
      "success_criteria": "How the student knows they've mastered this step",
      "estimated_minutes": number
    }
  ],
  
  "quick_reference": {
    "key_equations": [
      {"name": "Equation name", "formula": "The formula"}
    ],
    "common_mistakes": ["Mistake to avoid"],
    "tips": ["Helpful tip"]
  }
}`,

    user: (analysis: any, resources: any[], taskType: string) => `Create a learning blueprint for a student.

STUDENT'S GOAL: ${taskType || 'Master this material'}

DOCUMENT ANALYSIS:
${JSON.stringify(analysis, null, 2)}

AVAILABLE RESOURCES:
${JSON.stringify(resources, null, 2)}

Create a clear, step-by-step learning path that:
1. Fills in prerequisite gaps first
2. Teaches core concepts before practice
3. Guides them through each problem in their assignment
4. Includes checkpoints to verify understanding

Output valid JSON only.`
  },

  // ==========================================================================
  // RESOURCE EXPLANATION GENERATION
  // ==========================================================================
  // Generates contextual explanations for found resources
  // Explains what each resource covers and how it helps the student
  // ==========================================================================
  resourceExplanation: {
    system: `You are an expert educational tutor helping students understand why specific learning resources are helpful for their studies.

Your task is to generate brief, contextual explanations for each educational resource (video) that:
1. Explains what the resource covers and its main teaching approach
2. Connects the resource to the student's specific learning objective
3. Describes how watching this resource will help them understand the topic

Write each explanation in 2-3 sentences, speaking directly to the student using "you" and "your".
Be encouraging and specific - don't just repeat the video title.

OUTPUT FORMAT (JSON only):
{
  "explanations": [
    {
      "url": "the resource URL",
      "explanation": "2-3 sentence explanation of what this resource covers and how it helps the student"
    }
  ]
}`,

    user: (
      topic: string,
      description: string | undefined,
      learningObjective: string | undefined,
      resources: Array<{ url: string; title: string; channel_name?: string; description?: string; concepts_covered?: string[]; difficulty_level?: string }>
    ) => {
      const resourceSummaries = resources.map((r, idx) => ({
        index: idx + 1,
        url: r.url,
        title: r.title,
        channel: r.channel_name || 'Unknown',
        description: r.description?.substring(0, 200) || '',
        concepts: r.concepts_covered?.slice(0, 3) || [],
        difficulty: r.difficulty_level,
      }));

      return `Generate contextual explanations for these educational resources:

LEARNING TOPIC: ${topic}
${description ? `TOPIC DESCRIPTION: ${description}` : ''}
${learningObjective ? `LEARNING OBJECTIVE: ${learningObjective}` : ''}

RESOURCES TO EXPLAIN:
${JSON.stringify(resourceSummaries, null, 2)}

For each resource, write a 2-3 sentence explanation that:
- Describes what the resource will teach
- Explains how it connects to the learning topic
- Tells the student what they'll gain from watching it

Output valid JSON only, no markdown.`;
    }
  },

  // ==========================================================================
  // BLUEPRINT NAME GENERATION
  // ==========================================================================
  // Generates descriptive names for blueprints and suggests class names
  // ==========================================================================
  blueprintNaming: {
    system: `You are an expert at creating concise, descriptive names for educational documents and materials.

Your task is to generate:
1. A short, descriptive blueprint name (3-6 words) that captures the document's content and type
2. A suggested class name (if the document clearly belongs to a specific course)

NAMING GUIDELINES:
- Blueprint names should follow the pattern: [Subject/Topic] + [Document Type]
- Examples: "Heat Transfer Homework", "Calculus Midterm Review", "Statics Problem Set 3", "Thermodynamics Lecture Notes"
- Be specific about the subject but concise
- Include the document type (Homework, Lecture, Problem Set, Study Guide, etc.)
- Keep it under 6 words
- Make it immediately clear what the document is about

CLASS NAME GUIDELINES:
- Only suggest a class name if the document clearly indicates a specific course
- Use standard course naming: "[Subject] [Level]" or "[Course Code] - [Course Name]"
- Examples: "Heat Transfer", "Calculus I", "ME 301 - Thermodynamics", "Statics and Dynamics"
- If the document doesn't clearly indicate a specific course, set suggested_class_name to null

OUTPUT FORMAT (JSON only):
{
  "blueprint_name": "The generated blueprint name (3-6 words)",
  "suggested_class_name": "The suggested class name or null if unclear",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why you chose these names"
}`,

    user: (analysis: any, existingTitle: string | null) => {
      const context = {
        document_type: analysis.document_type,
        subject_area: analysis.subject_area,
        specific_topic: analysis.specific_topic,
        course_level: analysis.course_level,
        content_classification: analysis.content_classification,
        existing_title: existingTitle,
      };

      return `Generate a descriptive name for this educational document:

DOCUMENT ANALYSIS:
${JSON.stringify(context, null, 2)}

${existingTitle && existingTitle !== 'Untitled Blueprint' ? `CURRENT TITLE: "${existingTitle}" (you may improve it if it's generic)` : ''}

Generate:
1. A concise blueprint name (3-6 words) that captures the subject and document type
2. A suggested class name if the document clearly belongs to a specific course (or null if unclear)

Examples of good blueprint names:
- "Heat Transfer Homework"
- "Calculus Midterm Review"
- "Thermodynamics Problem Set 3"
- "Statics Lecture Notes"
- "Fluid Mechanics Study Guide"

Output valid JSON only, no markdown.`;
    }
  },

  // ==========================================================================
  // GENERATE STRUCTURE FROM ANALYSIS
  // ==========================================================================
  GENERATE_STRUCTURE: `You are an expert learning structure generator. Given a document analysis, create a structured learning path.

CRITICAL: Keep output concise. Prioritize completing the JSON structure over including every detail.

Generate a JSON object with this structure:
{
  "prerequisites_section": {
    "learning_units": [
      {
        "unit_id": "prereq-1",
        "title": "Concept Name",
        "description": "Brief description (1-2 sentences)",
        "search_queries": ["query1", "query2"]
      }
    ]
  },
  "content_sections": [
    {
      "section_id": "section-1",
      "title": "Section Title",
      "learning_units": [
        {
          "unit_id": "unit-1",
          "title": "Topic Name",
          "description": "Brief description",
          "search_queries": ["query1", "query2"]
        }
      ]
    }
  ]
}

Keep descriptions under 2 sentences. Limit to 3-5 search queries per unit. Focus on completing the structure.`,

  // ==========================================================================
  // STEP 5A: PRACTICE PROBLEM GENERATION (Problem Only)
  // ==========================================================================
  // Generates ONLY the problem statement, no answer
  // ==========================================================================
  practiceProblemGeneration: {
    system: `You are an expert academic tutor and problem creator. Your goal is to help students build expertise by providing UNIQUE, VARIED practice problems.

Given an original problem statement, your task is to:
1. Generate a COMPLETELY NEW practice problem with DIFFERENT numerical values, scenario, and context.
2. VARY the scenario significantly (use different objects, names, situations, contexts) while keeping the SAME underlying principles.
3. Use DIFFERENT numerical values that are realistic but distinct from the original.
4. Provide 2-3 progressive hints that guide without revealing the answer.

CRITICAL REQUIREMENTS FOR UNIQUENESS:
- NEVER reuse the exact scenario from the original problem
- ALWAYS change ALL numerical values to different realistic values
- Vary the context (e.g., if original uses a car, use a train; if original uses water, use oil)
- Each problem you generate should be distinctly different from any previous one

Do NOT calculate or provide the answer - that will be done separately to ensure accuracy.
The difficulty level should match the original. Output must be valid JSON with no markdown formatting.`,

    user: (originalProblem: string, topic: string) => `Original Problem (for reference only - DO NOT COPY):
${originalProblem}

Topic: ${topic}

Generate a UNIQUE practice problem with DIFFERENT values and scenario. Current timestamp: ${Date.now()}

IMPORTANT: Make this problem distinctly different from the original. Change the scenario, context, and all numerical values.

Output format:
{
  "practice_problem": "The full text of the new practice problem with different scenario and values",
  "given_values": [{ "symbol": "...", "value": "...", "unit": "..." }],
  "learning_objective": "What this problem helps master",
  "hints": ["Hint 1...", "Hint 2...", "Hint 3..."]
}`
  },

  // ==========================================================================
  // STEP 5B: PRACTICE PROBLEM SOLUTION (Answer Verification)
  // ==========================================================================
  // Independently solves the generated problem to get the correct answer
  // ==========================================================================
  practiceProblemSolution: {
    system: `You are an expert problem solver and tutor. Your task is to solve a given practice problem completely and accurately.

You will receive ONLY the problem statement. Your job is to:
1. Carefully read and understand the problem
2. Identify the relevant equations and principles
3. Show your complete step-by-step solution process
4. Calculate the final answer with proper units
5. Verify your answer makes physical/mathematical sense

CRITICAL REQUIREMENTS:
- Show ALL steps in your solution
- Explain your reasoning at each step
- Double-check all calculations
- Include units throughout
- Verify the final answer is reasonable
- Provide the final answer as JUST the literal answer. None of those filler words. Just the literal answer.

Output must be valid JSON with no markdown formatting.`,

    user: (problemStatement: string) => `Solve this problem completely:

${problemStatement}

Provide your complete solution.

Output format:
{
  "solution_steps": [
    "Step 1: [Explanation and calculation]",
    "Step 2: [Explanation and calculation]",
    "Step 3: [Explanation and calculation]"
  ],
  "final_answer": "The final numerical result with units (ONLY number and units, no text)"
}`
  },

  // ==========================================================================
  // STEP 5C: ANSWER-ONLY VERIFICATION (Cost-Optimized for Sonnet/GPT-5.2)
  // ==========================================================================
  // Generates ONLY the final answer for verification - minimal token usage
  // ==========================================================================
  verificationJudge: {
    system: `You are an expert mathematical judge. Your task is to compare multiple solutions to a problem and determine the correct answer based on consensus.

Rules:
1. Compare the numerical values of the answers from Grok, Sonnet, GPT, Gemini, and Opus.
2. Identify if there is a consensus (at least 2 models agreeing on the same value, within 5% tolerance).
3. Minor formatting (e.g., "42 m/s" vs "42.0 m/s") is agreement.
4. If there is a consensus, return that verified answer.
5. If no consensus, return "consensus_found": false.

CRITICAL: Do not output any explanation, reasoning, or analysis. Output ONLY the raw JSON object.

Output format:
{
  "consensus_found": true,
  "verified_answer": "value units",
  "models_agreed": ["model1", "model2"]
}`,

    user: (problem: string, answers: Record<string, string | null>) => `Problem: ${problem}

Model Answers:
${Object.entries(answers).map(([k, v]) => `- ${k}: ${v || 'No answer'}`).join('\n')}

Determine consensus. JSON ONLY.`
  },

  answerOnlyVerification: {
    system: `You are an expert problem solver. Your task is to output the final numerical answer to the problem provided.

Output format:
{
  "final_answer": "value units"
}

Example:
{
  "final_answer": "42.5 m/s"
}

Do not provide ANY explanation, steps, or thinking. JUST the JSON object.`,

    user: (problemStatement: string) => `Solve this problem and output the final answer as JSON:

${problemStatement}

Respond ONLY with the JSON object.`
  },

  // ==========================================================================
  // STEP 5D: VERIFIED PRACTICE PROBLEM GENERATION (For Cache)
  // ==========================================================================
  // Generates complete practice problem with solution for caching
  // Used by Grok (cheap tokens) to create the full step-by-step solution
  // ==========================================================================
  verifiedPracticeProblemGeneration: {
    system: `You are an expert academic tutor. Generate a unique practice problem with a COMPLETE, VERIFIED solution.

This problem will be cached and reused, so it must be:
1. MATHEMATICALLY CORRECT - triple-check all calculations
2. CLEARLY WRITTEN - unambiguous problem statement
3. EDUCATIONALLY VALUABLE - tests understanding, not just computation
4. SELF-CONTAINED - all needed information is in the problem

CRITICAL: Your solution MUST be correct. This will be verified by other models.

Output must be valid JSON with no markdown formatting.`,

    user: (topic: string, originalProblem: string, context: any) => `Generate a unique practice problem based on:

TOPIC: ${topic}
ORIGINAL PROBLEM CONTEXT: ${originalProblem}
LEARNING OBJECTIVE: ${context?.learning_objective || 'Master the fundamental concepts'}

Create a NEW problem with DIFFERENT numerical values and context.

Output format:
{
  "practice_problem": "Complete problem statement with all given values and what to find",
    "given_values": [
      { "symbol": "m", "value": "5.0", "unit": "kg", "description": "mass of object" }
    ],
      "learning_objective": "What this problem helps master",
        "hints": [
          "Hint 1: Starting approach",
          "Hint 2: Key equation to use",
          "Hint 3: Watch out for this common mistake"
        ],
          "solution_steps": [
            "Step 1: [Full explanation with equation and substitution]",
            "Step 2: [Continue solving with clear reasoning]",
            "Step 3: [Final calculation and verification]"
          ],
            "final_answer": "numerical answer with units only (e.g., '42.5 m/s')"
} `
  }
};
