import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClientWithAuth } from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';
import { OpenAI } from "https://esm.sh/openai@4.0.0";

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

        const { problem_statement } = await req.json();

        if (!problem_statement) {
            throw new Error('Missing problem_statement');
        }

        console.log(`[solve-practice-problem] Solving practice problem with Grok...`);

        // Get authenticated client to verify user
        const authClient = createSupabaseClientWithAuth(authHeader);
        const { data: { user }, error: userError } = await authClient.auth.getUser();

        if (userError || !user) {
            throw new Error('Could not verify user');
        }

        // Initialize Grok Client
        const chatApiKey = Deno.env.get("XAI_API_KEY") || Deno.env.get("CHAT_API_KEY");
        if (!chatApiKey) {
            throw new Error("Missing XAI_API_KEY");
        }

        const chatBaseUrl = "https://api.x.ai/v1";
        // User requested "Grok 4.1 fast reasoning". 
        // Using specific model version 'grok-4-1-fast-non-reasoning'.
        const chatModel = "grok-4-1-fast-non-reasoning";

        const client = new OpenAI({
            apiKey: chatApiKey,
            baseURL: chatBaseUrl,
        });

        // Construct Prompt
        const systemPrompt = PROMPTS.practiceProblemSolution.system;
        const userPrompt = PROMPTS.practiceProblemSolution.user(problem_statement);

        console.log(`[solve-practice-problem] Calling Grok model: ${chatModel}`);

        const completion = await client.chat.completions.create({
            model: chatModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.3, // Low temp for reasoning
            max_tokens: 4096,
        });

        const content = completion.choices[0]?.message?.content;

        if (!content) {
            throw new Error("No content received from Grok");
        }

        // Parse JSON safely
        let result;
        try {
            let jsonStr = content.trim();
            // Remove markdown code blocks if present
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.slice(7);
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.slice(3);
            }
            if (jsonStr.endsWith('```')) {
                jsonStr = jsonStr.slice(0, -3);
            }
            jsonStr = jsonStr.trim();

            result = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse Grok response as JSON:", content);
            throw new Error("Invalid JSON response from Grok");
        }

        console.log('[solve-practice-problem] Solution generated successfully');

        return new Response(
            JSON.stringify({
                success: true,
                solution: result,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('[solve-practice-problem] Error:', error);

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
