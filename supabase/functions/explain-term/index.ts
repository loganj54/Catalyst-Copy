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
        const { term, context } = await req.json();

        if (!term) {
            throw new Error('Term is required');
        }

        const systemPrompt = "You are an expert tutor in engineering and physics. Your goal is to explain technical concepts clearly, concisely, and accurately.";

        const userPrompt = `Explain "${term}" with respect to "${context || 'general engineering principles'}". 
    
    Make the explanation descriptive but keep it under 100 words. 
    Focus on the relationship between the term and the context provided.`;

        console.log(`[explain-term] Explaining: ${term} (Context: ${context})`);

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
