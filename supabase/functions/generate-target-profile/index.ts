import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, callClaudeJSON } from '../_shared/supabase-client.ts';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { topic, context, unit_type = 'topic' } = await req.json();

        if (!topic) {
            throw new Error('Topic is required');
        }

        const systemPrompt = `You are an expert educational curriculum designer. Your task is to generate a SPECIFIC target resource profile for a learning video.
    
    This text will be used to semantic search for the perfect video.
    
    GUIDELINES:
    - Keep it concise (2-3 sentences)
    - Describe a video that explains '${topic}' clearly, considering the context of '${context}'
    - Focus on "understanding" and "concepts"
    - Example: "A video explaining Newton's Second Law clearly, defining force, mass, and acceleration. The video should cover the relationship F=ma with real-world examples and demonstrate how to apply it to simple problems."
    
    OUTPUT JSON:
    {
      "target_resource_profile": "The generated text description"
    }`;

        const userPrompt = `Generate a target resource profile for:
    Topic: ${topic}
    Context/Section: ${context || 'General Engineering'}
    Unit Type: ${unit_type}
    
    Output valid JSON only.`;

        console.log(`[generate-target-profile] Generating profile for: ${topic}`);

        const result = await callClaudeJSON(systemPrompt, userPrompt);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
