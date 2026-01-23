// ============================================================================
// GENERATE DEEP DIVE SOLUTION
// ============================================================================
// A SIMPLE edge function that takes a problem statement and returns a
// detailed step-by-step solution walkthrough.
//
// ONE CALL TO CLAUDE. THAT'S IT.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaude } from '../_shared/supabase-client.ts';

const SOLUTION_PROMPT = `You are an expert tutor who creates detailed, step-by-step solution walkthroughs for homework problems.

Your task is to solve the given problem completely, showing every step of the work.

FORMAT YOUR RESPONSE AS MARKDOWN:
- Use ## headers for major steps (e.g., "## Step 1: Identify Given Values")
- Use **bold** for key concepts and important terms
- Use LaTeX notation for ALL math: $inline$ or $$block$$
- Be conversational but precise
- Explain the WHY behind each step, not just the HOW
- Include any relevant formulas with explanation of variables

Structure your solution like this:
1. First identify what is given and what we need to find
2. State the relevant equations/concepts
3. Show the step-by-step solution with clear reasoning
4. State the final answer clearly
5. Optionally include a "Common Mistakes to Avoid" section

Be thorough - this should read like a professor's detailed solution guide.`;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { problemStatement, context } = await req.json();

    if (!problemStatement) {
      throw new Error('Missing problemStatement');
    }

    console.log('[Deep Dive] Generating solution for problem...');
    console.log('[Deep Dive] Problem length:', problemStatement.length);

    // Build the user message
    const userMessage = `Please provide a detailed step-by-step solution for the following problem:

**PROBLEM:**
${problemStatement}

${context ? `**CONTEXT:**\n${context}` : ''}

Generate a complete, detailed walkthrough solution.`;

    // ONE CALL TO CLAUDE - simple text response, no JSON parsing needed
    const response = await callClaude(SOLUTION_PROMPT, userMessage, {
      maxTokens: 8000,
      temperature: 0.3
    });

    console.log('[Deep Dive] Solution generated successfully');
    console.log('[Deep Dive] Response length:', response.content.length);
    console.log('[Deep Dive] Tokens used:', response.usage);

    // Return the solution directly
    return new Response(JSON.stringify({
      success: true,
      solution: response.content,
      usage: response.usage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Deep Dive] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
