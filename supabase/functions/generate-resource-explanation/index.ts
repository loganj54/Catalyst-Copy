// ============================================================================
// GENERATE RESOURCE EXPLANATION EDGE FUNCTION
// ============================================================================
// Generates contextual "Why this helps" explanations for resources
// using Claude.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClientWithAuth, callClaudeJSON } from '../_shared/supabase-client.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify user
    const supabase = createSupabaseClientWithAuth(authHeader);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { resources, topic, description, learning_objective, blueprint_id, unit_id } = await req.json();

    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, resources: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-resource-explanation] Generating for ${resources.length} resources`);

    // Prepare prompt
    const systemPrompt = `You are an expert educational tutor helping students understand why specific learning resources are helpful for their studies.

Your task is to evaluate and explain educational resources for relevance to the student's learning objective.

CRITICAL: You should mark resources as irrelevant ONLY in extreme cases.

For RELEVANT resources (99% of educational videos should be marked relevant):
- Set "is_relevant": true
- Write 2-3 sentences explaining what the resource covers and how it helps the student achieve their learning objective.
- Connect the resource content specifically to the topic provided.
- Be encouraging and specific, speak directly using "you" and "your".
- Start with "This resource helps because..." or similar.

For COMPLETELY IRRELEVANT resources (EXTREME cases only):
- Set "is_relevant": false
- Set "explanation": "NOT_RELEVANT"

OUTPUT FORMAT (JSON only):
{
  "explanations": [
    {
      "url": "the resource URL",
      "is_relevant": true,
      "explanation": "2-3 sentence explanation..."
    }
  ]
}`;

    const resourceSummaries = resources.map((r: any, idx: number) => ({
      index: idx + 1,
      url: r.url,
      title: r.title,
      description: r.description?.substring(0, 300) || '',
      concepts: r.concepts_covered || []
    }));

    const userPrompt = `Evaluate and explain these educational resources for relevance:

LEARNING TOPIC: ${topic}
${description ? `TOPIC DESCRIPTION: ${description}` : ''}
${learning_objective ? `LEARNING OBJECTIVE: ${learning_objective}` : ''}

RESOURCES TO EVALUATE:
${JSON.stringify(resourceSummaries, null, 2)}

Output valid JSON containing the explanations.`;

    // Call Claude using helper
    const data = await callClaudeJSON(systemPrompt, userPrompt, { temperature: 0.4 });
    const explanations = data.explanations || [];

    // Merge explanations
    const updatedResources = resources.map((r: any) => {
        const expl = explanations.find((e: any) => e.url === r.url);
        if (expl && expl.is_relevant) {
            return { ...r, resource_explanation: expl.explanation };
        }
        return r;
    });

    // Update Database if blueprint_id and unit_id are provided
    if (blueprint_id && unit_id) {
        console.log(`[generate-resource-explanation] Updating database for unit ${unit_id}`);
        for (const res of updatedResources) {
            if (res.id && res.resource_explanation) {
                await supabase
                    .from('blueprint_topic_resources')
                    .update({ resource_explanation: res.resource_explanation })
                    .eq('blueprint_id', blueprint_id)
                    .eq('unit_id', unit_id)
                    .eq('resource_id', res.id);
            }
        }
    }

    return new Response(
      JSON.stringify({ success: true, resources: updatedResources }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[generate-resource-explanation] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
