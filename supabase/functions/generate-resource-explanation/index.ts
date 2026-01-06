// ============================================================================
// GENERATE RESOURCE EXPLANATION
// ============================================================================
// Generates contextual explanations for educational resources
// Explains why a specific resource is relevant to a specific topic
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_MODEL = 'claude-haiku-4-5'; // Use the fast model

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const { 
      resources, 
      topic, 
      description, 
      learning_objective,
      blueprint_id,
      unit_id
    } = await req.json();

    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          resources: []
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[generate-resource-explanation] Generating explanations for ${resources.length} resources`);
    console.log(`  - Topic: ${topic}`);

    if (!ANTHROPIC_API_KEY) {
      console.error('[generate-resource-explanation] Missing ANTHROPIC_API_KEY');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing API key',
          resources: resources 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Generate Explanations with Claude
    const systemPrompt = `You are an expert educational tutor helping students understand why specific learning resources are helpful for their studies.

Your task is to evaluate and explain educational resources for relevance to the student's learning objective.

CRITICAL: You should mark resources as irrelevant ONLY in extreme cases (e.g., a cooking video for calculus, a makeup tutorial for physics).

For RELEVANT resources (99% of educational videos should be marked relevant):
- Set "is_relevant": true
- Write 2-3 sentences explaining what the resource covers and how it helps the student
- Be encouraging and specific, speak directly using "you" and "your"
- Don't just repeat the video title
- Even if the video is broader or narrower than the exact topic, it's still RELEVANT if it teaches related concepts

For COMPLETELY IRRELEVANT resources (EXTREME cases only - wrong subject entirely):
- Set "is_relevant": false
- Set "explanation": "NOT_RELEVANT"
- ONLY use this if the video is about a completely different subject (e.g., skincare for physics, cooking for math)

IMPORTANT: When in doubt, mark it as RELEVANT. It's better to include a somewhat-related resource than to exclude a helpful one.

OUTPUT FORMAT (JSON only):
{
  "explanations": [
    {
      "resource_id": "the resource UUID",
      "is_relevant": true or false,
      "explanation": "2-3 sentence explanation OR 'NOT_RELEVANT' if COMPLETELY off-topic"
    }
  ]
}`;

    // Build resource summaries for the prompt
    const resourceSummaries = resources.map((r, idx) => ({
      index: idx + 1,
      resource_id: r.id,
      title: r.title,
      channel: r.channel_name || 'Unknown',
      // Prefer using the high-quality summary if available, otherwise fall back to description
      description: r.summary || (r.description ? r.description.substring(0, 500) : ''),
    }));

    const userPrompt = `Evaluate and explain these educational resources for relevance:

LEARNING TOPIC: ${topic}
${description ? `TOPIC DESCRIPTION: ${description}` : ''}
${learning_objective ? `LEARNING OBJECTIVE: ${learning_objective}` : ''}

RESOURCES TO EVALUATE:
${JSON.stringify(resourceSummaries, null, 2)}

For each resource:
1. Be GENEROUS - if it's even partially related, mark as relevant
2. If relevant, write a 2-3 sentence explanation of what it covers and how it helps
3. If COMPLETELY off-topic, mark is_relevant as false and use "NOT_RELEVANT"

Output valid JSON only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: 0.4,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-resource-explanation] Claude API error:', response.status, errorText);
      throw new Error(`Claude API error: ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.content?.find((block: any) => block.type === 'text')?.text || '';
    
    let explanations: Array<{ resource_id: string; is_relevant?: boolean; explanation: string }> = [];
    
    // Parse JSON response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        explanations = parsed.explanations || [];
        console.log(`[generate-resource-explanation] Parsed ${explanations.length} resource explanations`);
      } catch (parseError) {
        console.error('[generate-resource-explanation] Failed to parse explanation JSON:', parseError);
      }
    }

    // 2. Update Database & Return Enriched Resources
    const supabase = createSupabaseClient();
    const enrichedResources = [...resources];

    for (const enrichedResource of enrichedResources) {
      const match = explanations.find(e => e.resource_id === enrichedResource.id);
      
      if (match) {
        // Add explanation to the response object
        enrichedResource.resource_explanation = match.explanation;
        
        // Update database if we have blueprint info
        if (blueprint_id && unit_id && enrichedResource.id) {
          console.log(`[generate-resource-explanation] Updating database for resource ${enrichedResource.id}`);
          
          const { error: updateError } = await supabase
            .from('blueprint_topic_resources')
            .update({ resource_explanation: match.explanation })
            .eq('blueprint_id', blueprint_id)
            .eq('unit_id', unit_id)
            .eq('resource_id', enrichedResource.id);
            
          if (updateError) {
            console.error('[generate-resource-explanation] DB Update error:', updateError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resources: enrichedResources
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[generate-resource-explanation] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

