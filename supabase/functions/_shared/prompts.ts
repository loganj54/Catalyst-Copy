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
1. If this is a problem set, analyze EACH PROBLEM SEPARATELY. Every distinct problem should be its own entry.
2. Be specific - don't repeat the same information in multiple places.
3. Focus on what the student needs to LEARN and DO, not just what the document contains.
4. All output must be valid JSON with no markdown formatting.

FOR EACH PROBLEM, YOU MUST:
- Write a COMPLETE problem_statement that paraphrases the original but includes ALL numerical values, conditions, and context. Someone reading only your statement should fully understand what the problem asks.
- If there's a figure/diagram, describe it in detail (geometry, labels, dimensions, what it represents).
- Extract EVERY given variable with its symbol, value, and unit.
- List ALL unknowns we're solving for with clear descriptions.
- Include ALL assumptions (both explicit like "assume blackbody radiation" and implicit like "steady-state").

OUTPUT STRUCTURE:
{
  "document_type": "problem_set" | "study_guide" | "lecture_notes" | "textbook" | "other",
  "subject_area": "The broad field (e.g., 'Mechanical Engineering', 'Calculus')",
  "specific_topic": "The specific topic (e.g., 'Radiation Heat Transfer', 'Integration by Parts')",
  "course_level": "introductory" | "intermediate" | "advanced" | "graduate",
  
  "problems": [
    // ONE ENTRY PER PROBLEM - if the document has 5 problems, there should be 5 entries here
    {
      "problem_id": "A short identifier like 'Problem 1' or 'Q2a'",
      
      "problem_statement": "A COMPLETE restatement of the problem in your own words. This should be detailed enough that someone without the original document could understand exactly what the problem is asking. Include all numerical values, conditions, and context. Paraphrase the original but preserve all the technical details that make this problem unique.",
      
      "figure_description": "If there is a figure, diagram, or image associated with this problem, describe it in detail: what it shows, labels, dimensions, geometry, etc. If no figure, use null.",
      
      "given_variables": [
        // List ALL known quantities from the problem
        // Format: { "symbol": "T", "description": "Filament temperature", "value": "2300", "unit": "°C" }
        {
          "symbol": "The variable symbol used (T, λ, ε, etc.)",
          "description": "What this variable represents",
          "value": "The numerical value given",
          "unit": "The unit of measurement"
        }
      ],
      
      "unknown_variables": [
        // List everything we need to find/solve for
        // Format: { "symbol": "λ_max", "description": "The wavelength at which maximum emission occurs" }
        {
          "symbol": "The variable symbol (if applicable)",
          "description": "A complete description of what we're solving for - detailed enough for someone without the problem to understand"
        }
      ],
      
      "assumptions": [
        // List ALL assumptions stated in the problem or implied
        // Examples: "The filament radiates as a blackbody", "Steady-state conditions", "Negligible heat loss to surroundings"
        "Each assumption as a complete statement"
      ],
      
      "concepts_tested": ["List of specific concepts this problem tests"],
      "equations_needed": ["Specific equations/formulas needed to solve this"],
      "solving_approach": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
      "difficulty": 1-10,
      "estimated_minutes": number,
      "common_mistakes": ["Mistakes students often make on this type of problem"]
    }
  ],
  
  "prerequisites": [
    // Knowledge the student should have BEFORE attempting this material
    {
      "concept": "Name of prerequisite concept",
      "category": "math" | "physics" | "chemistry" | "engineering" | "other",
      "why_needed": "Brief explanation of why this is needed",
      "difficulty": "beginner" | "intermediate" | "advanced"
    }
  ],
  
  "key_equations": [
    // Master list of important equations across all problems
    {
      "name": "Equation name (e.g., 'Stefan-Boltzmann Law')",
      "formula": "The equation in text form",
      "variables": {"T": "Temperature in Kelvin", "σ": "Stefan-Boltzmann constant"},
      "when_to_use": "When to apply this equation"
    }
  ],
  
  "study_recommendations": {
    "total_time_minutes": number,
    "suggested_order": ["problem_id1", "problem_id2", ...],
    "focus_areas": ["Areas that need the most attention"],
    "tips": ["General tips for approaching this material"]
  }
}

If you cannot identify individual problems (e.g., it's lecture notes), use the "problems" array for major topics/sections instead, treating each as a learning unit.`,

    user: (content: string, taskType: string) => `Analyze the educational document provided and extract structured learning information.

STUDENT'S GOAL: ${taskType || 'Master this material'}

${content ? `ADDITIONAL CONTEXT FROM STUDENT:\n${content}\n` : ''}
INSTRUCTIONS:
- Look at the ENTIRE document carefully, including any figures, diagrams, or equations
- If this is a problem set, analyze EACH PROBLEM SEPARATELY - one entry per problem in the "problems" array
- Be specific about the exact equations shown and the solving approaches needed
- Identify what figures/diagrams show and how they relate to the problems
- Don't repeat the same information in multiple places
- Output valid JSON only, no markdown`
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
1. Generate 3-4 CLEVER, SPECIFIC search queries for EACH topic/concept (not 5 - keep it focused)
2. Queries should be PROGRESSIVE - start with introductory content, then build up to advanced
3. Target YouTube and educational platforms with specific keywords that find high-quality content
4. Think like a master teacher: what videos/resources would YOU recommend to teach this from scratch?
5. All output must be valid JSON with no markdown formatting.
6. Keep descriptions BRIEF (1-2 sentences max) - focus on search queries, not lengthy explanations.
7. COMPLETE THE JSON - ensure all brackets are closed. If running long, reduce detail rather than truncating.

SEARCH QUERY STRATEGY (generate 3-4 queries per topic, not all 5):
For each topic, pick the most relevant from this progression:
1. INTRODUCTION: "What is [topic] explained simply" or "[topic] basics for beginners tutorial"
2. CORE CONCEPT: "[topic] how it works explained" or "[topic] fundamentals deep dive"  
3. TUTORIAL/EXAMPLES: "[topic] step by step tutorial" or "[topic] example problems solved"
4. PRACTICE: "[topic] practice problems" or "[topic] advanced applications" (only if essential)

QUERY OPTIMIZATION TIPS:
- Include keywords like "tutorial", "explained", "walkthrough", "step by step", "for beginners"
- Add subject context: "engineering", "physics", "calculus", etc.
- Be specific about what type of content: "video", "lecture", "solved problems"
- Target known quality sources: Add channel names if appropriate (Khan Academy, Professor Leonard, MIT, etc.)
- For problem-solving topics, include "how to solve", "example", "practice"

OUTPUT STRUCTURE:
{
  "summary": {
    "title": "Learning structure title",
    "description": "Brief description of what this learning path covers",
    "total_estimated_time_minutes": number,
    "difficulty_progression": "beginner to [level]"
  },
  
  "prerequisites_section": {
    "description": "Foundational knowledge needed before the main content",
    "learning_units": [
      {
        "unit_id": "prereq_1",
        "topic": "The prerequisite topic name",
        "description": "Why this prerequisite is needed and what the student should learn",
        "category": "math" | "physics" | "chemistry" | "engineering" | "other",
        "difficulty": "beginner" | "intermediate" | "advanced",
        "estimated_time_minutes": number,
        "search_queries": [
          {
            "query": "The actual search query string to use",
            "query_type": "introduction" | "concept" | "tutorial" | "example" | "practice",
            "target_content": "What this query should find (e.g., 'introductory video explaining the basics')",
            "priority": 1-5
          }
        ]
      }
    ]
  },
  
  "content_sections": [
    {
      "section_id": "problem_1" or "section_1",
      "section_type": "problem" | "topic" | "chapter",
      "title": "Section title (e.g., 'Problem 1: Blackbody Radiation' or 'Heat Transfer Fundamentals')",
      "description": "What this section covers",
      "concepts": ["List of concepts covered in this section"],
      "learning_units": [
        {
          "unit_id": "section_1_unit_1",
          "topic": "Specific topic within this section",
          "learning_objective": "What the student will be able to do after this unit",
          "priority": "essential" | "recommended" | "supplementary",
          "estimated_time_minutes": number,
          "search_queries": [
            {
              "query": "The search query string",
              "query_type": "introduction" | "concept" | "tutorial" | "example" | "practice",
              "target_content": "Description of expected search results",
              "priority": 1-5
            }
          ]
        }
      ],
      "problem_details": {
        "original_problem_id": "Reference to the problem in the analysis (if applicable)",
        "key_equations": ["Equations needed for this problem"],
        "common_mistakes": ["Mistakes to watch out for"]
      }
    }
  ]
}

EXAMPLE SEARCH QUERIES:

For a prerequisite on "View Factors in Radiation Heat Transfer":
1. { "query": "introduction to radiation heat transfer basics explained", "query_type": "introduction", "priority": 1 }
2. { "query": "what are view factors radiation heat transfer tutorial", "query_type": "concept", "priority": 2 }
3. { "query": "how to calculate view factors step by step", "query_type": "tutorial", "priority": 3 }
4. { "query": "view factor geometry examples solved problems", "query_type": "example", "priority": 4 }
5. { "query": "view factor reciprocity summation rule engineering", "query_type": "practice", "priority": 5 }

For a problem section on "Stefan-Boltzmann Law calculations":
1. { "query": "Stefan-Boltzmann law explained simple introduction", "query_type": "introduction", "priority": 1 }
2. { "query": "blackbody radiation emission calculation tutorial", "query_type": "concept", "priority": 2 }
3. { "query": "Stefan-Boltzmann law example problems step by step", "query_type": "tutorial", "priority": 3 }
4. { "query": "radiation heat transfer problem solving walkthrough", "query_type": "example", "priority": 4 }
5. { "query": "thermal radiation practice problems engineering", "query_type": "practice", "priority": 5 }`,

    user: (input: any, inputType: 'document_analysis' | 'custom' = 'document_analysis') => `Generate a comprehensive learning structure with search queries based on the following ${inputType === 'document_analysis' ? 'document analysis' : 'input'}.

INPUT TYPE: ${inputType}

INPUT DATA:
${JSON.stringify(input, null, 2)}

INSTRUCTIONS:
1. Create a PREREQUISITES SECTION with learning units for each prerequisite concept
   - Generate 3-5 progressive search queries for each prerequisite
   - Start with basic introductions, build up to more detailed content
   
2. Create CONTENT SECTIONS organized by problem or topic
   - For problem sets: One section per problem
   - For study guides/notes: One section per major topic
   - Each section should have learning units covering the key concepts
   - Generate 3-5 search queries per learning unit
   
3. For EACH search query, think:
   - What would a great teacher recommend a student watch/read?
   - What search terms would find high-quality educational content?
   - How can we progress from "I know nothing" to "I can solve this"?

4. Be CREATIVE and SPECIFIC with search queries:
   - Don't just repeat the topic name - craft queries that will find great content
   - Include platform-specific keywords (tutorial, explained, walkthrough)
   - Target the student's level and build up progressively

Output valid JSON only, no markdown.`
  },

  // ==========================================================================
  // STEP 3: SEARCH RESOURCES (uses queries from generateStructure)
  // ==========================================================================
  // Executes search queries and finds actual learning resources
  // ==========================================================================
  resourceSearch: {
    system: `You are an expert at finding high-quality educational resources. Given an analysis of what a student needs to learn, suggest specific resources that would help them.

Focus on:
- YouTube videos from reputable educators (Khan Academy, Professor Leonard, 3Blue1Brown, MIT OpenCourseWare, etc.)
- Interactive tools and calculators
- Practice problem repositories
- Clear, well-explained tutorials

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
  }
};
