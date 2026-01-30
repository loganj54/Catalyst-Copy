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
            // Enhanced 2-paragraph response when solution context is available
            userPrompt = `Explain "${term}" in the context of solving this problem.

PROBLEM/SOLUTION CONTEXT:
${solutionContext}

Write exactly TWO short paragraphs (no headers, no labels, just the paragraphs):

First paragraph: Define "${term}" in ${context || 'general engineering'} and its fundamental significance.

Second paragraph: Explain how "${term}" applies to this specific problem - why it's relevant and where it appears in the solution.

IMPORTANT FORMATTING RULES:
- Keep each paragraph under 50 words
- Write ALL equations and mathematical expressions in LaTeX format using $...$ delimiters (e.g., $Nu = hL/k$, $Re > 10^5$)
- Do NOT include any headers - just write the two paragraphs directly
- Be concise and student-friendly`;
        } else {
            // Original simple explanation when no solution context
            userPrompt = `Explain "${term}" with respect to "${context || 'general engineering principles'}". 
    
    Make the explanation descriptive but keep it under 100 words. 
    Focus on the relationship between the term and the context provided.`;
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
