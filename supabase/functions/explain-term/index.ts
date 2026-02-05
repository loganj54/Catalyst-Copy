import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaude } from '../_shared/supabase-client.ts';

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    try {
        const { term, context, solutionContext } = await req.json();

        if (!term) {
            throw new Error('Term is required');
        }

        const systemPrompt = "You are an expert tutor in engineering and physics. Your goal is to explain technical concepts clearly, concisely, and accurately. You help students understand both the theory and practical application of concepts.";

        let userPrompt: string;

        if (solutionContext) {
            // Enhanced response when solution context is available
            userPrompt = `Explain "${term}" in the context of solving this problem.

PROBLEM/SOLUTION CONTEXT:
${solutionContext}

Structure your response as follows:
1. A clear overview paragraph (max 40 words).
2. A bulleted list of 2-3 key points (max 25 words each).

IMPORTANT GUIDELINES:
- **Tone:** Educational and clear, but accessible (Early Undergraduate level). Avoid overly complex jargon, but give actual substance.
- **Bolding:** Use bolding **Semantic Labels** only at the start of a bullet (e.g., "- **Flexibility:** It adapts to..."). If a bullet doesn't have a distinct concept label, DO NOT bold the first word.
- **Formatting:** Use standard dashes (-) for bullets. Write equations in LaTeX ($...$).
- Do NOT put spaces inside bold tags.`;
        } else {
            // Original explanation when no solution context
            userPrompt = `Explain "${term}" with respect to "${context || 'general engineering principles'}". 
    
    Structure:
    1. A single sentence overview (max 30 words).
    2. A bulleted list of 2-3 distinct facts (max 20 words each).

    IMPORTANT GUIDELINES:
    - **Tone:** Clear and Educational (Early Undergraduate).
    - **Bolding:** ONLY bold semantic labels (e.g., "- **Mechanism:** ..."). Do not randomly bold the first word.
    - **Formatting:** Markdown dashes (-). LaTeX in $...$. No bold spaces.`;
        }

        console.log(`[explain-term] Explaining: ${term} (Context: ${context}, Has Solution Context: ${!!solutionContext})`);

        const result = await callClaude(systemPrompt, userPrompt, {
            temperature: 0.3,
            maxTokens: 500
        });

        console.log('[explain-term] Explanation generated.');

        return new Response(
            JSON.stringify({
                explanation: result.content
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('[explain-term] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});
