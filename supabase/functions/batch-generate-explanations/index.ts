// ============================================================================
// BATCH GENERATE RESOURCE EXPLANATIONS EDGE FUNCTION
// ============================================================================
// Generates contextual "Why this helps" explanations for resources across
// MULTIPLE units in a single API call. This reduces rate limiting and costs
// by batching all explanation requests together.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClientWithAuth, callClaudeJSON } from '../_shared/supabase-client.ts';

interface ResourceInput {
  url: string;
  title: string;
  description?: string;
  concepts_covered?: string[];
  id?: string;
}

interface UnitInput {
  unit_id: string;
  topic: string;
  description?: string;
  learning_objective?: string;
  resources: ResourceInput[];
}

interface ExplanationOutput {
  url: string;
  is_relevant: boolean;
  explanation: string;
}

interface UnitExplanationsOutput {
  unit_id: string;
  explanations: ExplanationOutput[];
}

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

    const { units, blueprint_id } = await req.json() as { 
      units: UnitInput[]; 
      blueprint_id?: string;
    };

    if (!units || !Array.isArray(units) || units.length === 0) {
      return new Response(
        JSON.stringify({ success: true, units: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out units with no resources
    const unitsWithResources = units.filter(u => u.resources && u.resources.length > 0);
    
    if (unitsWithResources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, units: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count total resources
    const totalResources = unitsWithResources.reduce((sum, u) => sum + u.resources.length, 0);
    console.log(`[batch-generate-explanations] Processing ${unitsWithResources.length} units with ${totalResources} total resources`);

    // Build the batched prompt
    const systemPrompt = `You are an expert educational tutor helping students understand why specific learning resources are helpful for their studies.

Your task is to evaluate and explain educational resources for relevance to each student's learning objective.

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
  "units": [
    {
      "unit_id": "the unit ID",
      "explanations": [
        {
          "url": "the resource URL",
          "is_relevant": true,
          "explanation": "2-3 sentence explanation..."
        }
      ]
    }
  ]
}`;

    // Build the user prompt with all units and their resources
    const unitsSummary = unitsWithResources.map((unit, unitIdx) => {
      const resourcesSummary = unit.resources.map((r, resIdx) => ({
        index: resIdx + 1,
        url: r.url,
        title: r.title,
        description: r.description?.substring(0, 250) || '',
        concepts: r.concepts_covered || []
      }));

      return {
        unit_id: unit.unit_id,
        topic: unit.topic,
        description: unit.description || '',
        learning_objective: unit.learning_objective || '',
        resources: resourcesSummary
      };
    });

    const userPrompt = `Evaluate and explain resources for the following ${unitsWithResources.length} learning units:

${JSON.stringify(unitsSummary, null, 2)}

For each unit, evaluate all its resources and provide explanations. Output valid JSON containing the explanations for all units.`;

    // Call Claude with the batched request
    // Use higher max tokens since we're processing multiple units
    const maxTokens = Math.min(8192, 1000 + (totalResources * 200));
    
    console.log(`[batch-generate-explanations] Calling Claude with max_tokens=${maxTokens}`);
    
    const data = await callClaudeJSON<{ units: UnitExplanationsOutput[] }>(
      systemPrompt, 
      userPrompt, 
      { temperature: 0.4, maxTokens }
    );
    
    const unitExplanations = data.units || [];
    console.log(`[batch-generate-explanations] Received explanations for ${unitExplanations.length} units`);

    // Build the response with updated resources
    const updatedUnits = unitsWithResources.map(unit => {
      const unitExpl = unitExplanations.find(ue => ue.unit_id === unit.unit_id);
      
      if (!unitExpl || !unitExpl.explanations) {
        // No explanations found for this unit, return resources as-is
        return {
          unit_id: unit.unit_id,
          resources: unit.resources
        };
      }

      // Merge explanations into resources
      const updatedResources = unit.resources.map(resource => {
        const expl = unitExpl.explanations.find(e => e.url === resource.url);
        if (expl && expl.is_relevant) {
          return { ...resource, resource_explanation: expl.explanation };
        }
        return resource;
      });

      return {
        unit_id: unit.unit_id,
        resources: updatedResources
      };
    });

    // Update database if blueprint_id is provided
    if (blueprint_id) {
      console.log(`[batch-generate-explanations] Updating database for blueprint ${blueprint_id}`);
      
      for (const unit of updatedUnits) {
        for (const resource of unit.resources) {
          if (resource.id && (resource as any).resource_explanation) {
            await supabase
              .from('blueprint_topic_resources')
              .update({ resource_explanation: (resource as any).resource_explanation })
              .eq('blueprint_id', blueprint_id)
              .eq('unit_id', unit.unit_id)
              .eq('resource_id', resource.id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        units: updatedUnits,
        stats: {
          units_processed: updatedUnits.length,
          total_resources: totalResources
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[batch-generate-explanations] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

