// ============================================================================
// GENERATE BLUEPRINT NAME ATOMIC FUNCTION
// ============================================================================
// Generates AI name for blueprint based on analysis
// Extracted from analyze-document/index.ts lines 527-565
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { callClaudeJSON } from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';
import type { GenerateBlueprintNameInput, GenerateBlueprintNameOutput, FunctionError } from '../_shared/types.ts';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const input: GenerateBlueprintNameInput = await req.json();
    
    if (!input.analysis) {
      return errorResponse({ error: 'analysis is required', code: 'INVALID_INPUT' });
    }

    console.log('[generate-blueprint-name] Generating name...');

    const result = await callClaudeJSON<GenerateBlueprintNameOutput>(
      PROMPTS.blueprintNaming.system,
      PROMPTS.blueprintNaming.user(input.analysis, input.current_title || 'Untitled Blueprint'),
      { temperature: 0.5, maxTokens: 500 }
    );

    console.log('[generate-blueprint-name] Generated:', result.blueprint_name);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-blueprint-name] Error:', error);
    return errorResponse({ error: error.message || 'Internal error', code: 'API_ERROR' });
  }
};

function errorResponse(error: FunctionError): Response {
  return new Response(JSON.stringify(error), {
    status: error.code === 'INVALID_INPUT' ? 400 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(withSelfHealing('generate-blueprint-name', handler));

