// ============================================================================
// LINK RESOURCE TO BLUEPRINT ATOMIC FUNCTION
// ============================================================================
// Creates junction table entry linking resource to blueprint unit
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { LinkResourceToBlueprintInput, LinkResourceToBlueprintOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - links resource to blueprint unit
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: LinkResourceToBlueprintInput = await req.json();
    
    // Validate required fields
    if (!input.blueprint_id || input.blueprint_id.trim().length === 0) {
      return errorResponse({
        error: 'blueprint_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'blueprint_id' },
      });
    }

    if (!input.unit_id || input.unit_id.trim().length === 0) {
      return errorResponse({
        error: 'unit_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'unit_id' },
      });
    }

    if (!input.resource_id || input.resource_id.trim().length === 0) {
      return errorResponse({
        error: 'resource_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'resource_id' },
      });
    }

    // Validate relevance score
    const relevance = input.relevance ?? 0.8;
    if (relevance < 0 || relevance > 1) {
      return errorResponse({
        error: 'relevance must be between 0 and 1',
        code: 'INVALID_INPUT',
        details: { field: 'relevance', value: relevance },
      });
    }

    console.log('[link-resource-to-blueprint] Linking resource...');
    console.log('  - Blueprint:', input.blueprint_id);
    console.log('  - Unit:', input.unit_id);
    console.log('  - Resource:', input.resource_id);
    console.log('  - Relevance:', relevance);

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Build upsert data
    const linkData: any = {
      blueprint_id: input.blueprint_id,
      unit_id: input.unit_id,
      resource_id: input.resource_id,
      relevance_score: relevance,
    };

    // Add optional fields
    if (input.query_type) {
      linkData.query_type = input.query_type;
    }
    if (input.resource_explanation) {
      linkData.resource_explanation = input.resource_explanation;
    }

    // Upsert link
    const { data: linkResult, error: linkError } = await supabase
      .from('blueprint_topic_resources')
      .upsert(linkData, {
        onConflict: 'blueprint_id,unit_id,resource_id',
      })
      .select('id')
      .single();

    if (linkError) {
      console.error('[link-resource-to-blueprint] Database error:', linkError);
      
      // Check if it's a foreign key constraint error
      if (linkError.code === '23503') {
        return errorResponse({
          error: 'Referenced blueprint, unit, or resource does not exist',
          code: 'NOT_FOUND',
          details: linkError,
        });
      }

      return errorResponse({
        error: `Database error: ${linkError.message}`,
        code: 'DATABASE_ERROR',
        details: linkError,
      });
    }

    const linkId = linkResult?.id;

    console.log('[link-resource-to-blueprint] Link created successfully');
    console.log('  - Link ID:', linkId);

    const output: LinkResourceToBlueprintOutput = {
      success: true,
      link_id: linkId,
      metadata: {
        linked_at: new Date().toISOString(),
      },
    };

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[link-resource-to-blueprint] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Helper to create error response
 */
function errorResponse(error: FunctionError): Response {
  return new Response(
    JSON.stringify(error),
    {
      status: error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_FOUND' ? 404 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Wrap handler with self-healing
serve(withSelfHealing('link-resource-to-blueprint', handler));

