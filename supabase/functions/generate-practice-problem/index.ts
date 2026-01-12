import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClientWithAuth, callClaudeJSON } from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    try {
        // Verify authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        const { problem_statement, topic } = await req.json();

        if (!problem_statement) {
            throw new Error('Missing problem_statement');
        }

        console.log(`[generate-practice-problem] Generating practice problem for topic: ${topic || 'unknown'}`);

        // Get authenticated client to verify user
        const authClient = createSupabaseClientWithAuth(authHeader);
        const { data: { user }, error: userError } = await authClient.auth.getUser();

        if (userError || !user) {
            throw new Error('Could not verify user');
        }

        // Call Claude Haiku 4.5 to generate the problem
        const result = await callClaudeJSON(
            PROMPTS.practiceProblemGeneration.system,
            PROMPTS.practiceProblemGeneration.user(problem_statement, topic || 'this subject'),
            {
                maxTokens: 2048,
                temperature: 1.0, // Maximum temperature for variety - each problem should be unique
            }
        );

        console.log('[generate-practice-problem] Practice problem generated successfully');

        return new Response(
            JSON.stringify({
                success: true,
                practice_problem: result,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('[generate-practice-problem] Error:', error);

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
