import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaude } from '../_shared/supabase-client.ts';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    try {
        const { term, context, solutionContext, question, conversationHistory } = await req.json();

        if (!term || !question) {
            throw new Error('Term and question are required');
        }

        const systemPrompt = `You are an expert tutor in engineering and physics. You are helping a student understand a specific term or concept in the context of a problem they are working on.

Your goal is to:
1. Answer their specific question clearly and concisely
2. Relate your answer back to the term "${term}" and the problem context when relevant
3. Use analogies and examples to make complex concepts accessible
4. Keep responses focused and under 150 words unless a longer explanation is truly necessary

IMPORTANT FORMATTING:
- Write ALL equations and mathematical expressions in LaTeX format using $...$ delimiters (e.g., $Nu = hL/k$, $Re > 10^5$)
- Be conversational but educational
- If the student asks a follow-up, build on previous responses naturally`;

        // Build context for the conversation
        let contextBlock = '';

        if (solutionContext) {
            contextBlock += `\n\nPROBLEM/SOLUTION CONTEXT:\n${solutionContext}`;
        }

        if (context) {
            contextBlock += `\n\nSUBJECT AREA: ${context}`;
        }

        // Build conversation history string
        let conversationBlock = '';
        if (conversationHistory && conversationHistory.length > 0) {
            conversationBlock = '\n\nPREVIOUS CONVERSATION:\n';
            conversationHistory.forEach((msg: Message) => {
                const prefix = msg.role === 'user' ? 'Student' : 'Tutor';
                conversationBlock += `${prefix}: ${msg.content}\n`;
            });
        }

        const userPrompt = `The student is asking about: "${term}"
${contextBlock}
${conversationBlock}
CURRENT QUESTION: ${question}

Please provide a helpful, clear response.`;

        console.log(`[ask-question] Term: ${term}, Question: "${question.substring(0, 50)}..."`);
        console.log(`[ask-question] Has solution context: ${!!solutionContext}, History length: ${conversationHistory?.length || 0}`);

        const result = await callClaude(systemPrompt, userPrompt, {
            temperature: 0.4,
            maxTokens: 800
        });

        console.log('[ask-question] Response generated.');

        return new Response(
            JSON.stringify({
                answer: result.content
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('[ask-question] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});
