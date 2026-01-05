// ============================================================================
// STORE RESOURCE ATOMIC FUNCTION
// ============================================================================
// Stores educational resource with embedding in curated_resources table
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { formatVectorForPostgres } from '../_shared/embeddings.ts';
import type { StoreResourceInput, StoreResourceOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - stores resource with embedding
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: StoreResourceInput = await req.json();
    
    if (!input.resource) {
      return errorResponse({
        error: 'Resource object is required',
        code: 'INVALID_INPUT',
        details: { field: 'resource' },
      });
    }

    const { resource } = input;

    // Validate required fields
    if (!resource.url || resource.url.trim().length === 0) {
      return errorResponse({
        error: 'Resource URL is required',
        code: 'INVALID_INPUT',
        details: { field: 'resource.url', received: resource.url },
      });
    }

    if (!resource.title || resource.title.trim().length === 0) {
      return errorResponse({
        error: 'Resource title is required',
        code: 'INVALID_INPUT',
        details: { field: 'resource.title' },
      });
    }

    // Validate embedding
    if (!input.embedding || !Array.isArray(input.embedding)) {
      return errorResponse({
        error: 'Embedding is required and must be an array',
        code: 'INVALID_INPUT',
        details: { field: 'embedding', type: typeof input.embedding },
      });
    }

    if (input.embedding.length !== 1536) {
      return errorResponse({
        error: 'Embedding must be a 1536-dimensional vector',
        code: 'INVALID_INPUT',
        details: { field: 'embedding', length: input.embedding.length, expected: 1536 },
      });
    }

    console.log('[store-resource] Storing resource:', resource.title);
    console.log('  - URL:', resource.url);
    console.log('  - Platform:', resource.platform);

    // Format embedding for PostgreSQL
    const vectorString = formatVectorForPostgres(input.embedding);

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Build upsert data
    const upsertData: any = {
      url: resource.url,
      title: resource.title,
      description: resource.description || '',
      platform: resource.platform || 'Web',
      channel_name: resource.channel_name || null,
      channel_url: resource.channel_url || null,
      thumbnail_url: resource.thumbnail_url || null,
      duration_seconds: resource.duration_seconds || null,
      resource_type: 'video',
      topic_signature: resource.topic_signature || '',
      concepts_covered: resource.concepts_covered || [],
      difficulty_level: resource.difficulty_level || 'intermediate',
      quality_score: resource.quality_score || 0.7,
      topic_embedding: vectorString,
      times_served: 1,
    };

    // Add optional fields if present
    if (resource.transcript_analyzed !== undefined) {
      upsertData.transcript_analyzed = resource.transcript_analyzed;
    }
    if (resource.transcript_source) {
      upsertData.transcript_source = resource.transcript_source;
    }
    if (resource.content_analysis) {
      upsertData.content_analysis = resource.content_analysis;
    }
    if (resource.analysis_confidence !== undefined) {
      upsertData.analysis_confidence = resource.analysis_confidence;
    }

    // Upsert with retry logic
    let insertedResource;
    let insertError;
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      const result = await supabase
        .from('curated_resources')
        .upsert(upsertData, {
          onConflict: 'url',
          ignoreDuplicates: false,
        })
        .select('id')
        .single();

      insertedResource = result.data;
      insertError = result.error;

      if (!insertError) {
        break; // Success
      }

      if (retryCount < maxRetries) {
        console.log(`[store-resource] Retry ${retryCount + 1}/${maxRetries} after error:`, insertError.message);
        await sleep(1000);
        retryCount++;
      } else {
        break; // Failed after retries
      }
    }

    if (insertError) {
      console.error('[store-resource] Database error:', insertError);
      
      // Try to fetch existing resource by URL as fallback
      const { data: existingRes } = await supabase
        .from('curated_resources')
        .select('id')
        .eq('url', resource.url)
        .single();

      if (existingRes) {
        console.log('[store-resource] Found existing resource, returning ID');
        const output: StoreResourceOutput = {
          resource_id: existingRes.id,
          created: false,
          metadata: {
            stored_at: new Date().toISOString(),
          },
        };

        return new Response(JSON.stringify(output), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return errorResponse({
        error: `Database error: ${insertError.message}`,
        code: 'DATABASE_ERROR',
        details: insertError,
      });
    }

    const resourceId = insertedResource?.id;
    const created = !resource.id; // If resource already had an ID, it was an update

    console.log('[store-resource] Resource stored successfully');
    console.log('  - ID:', resourceId);
    console.log('  - Created:', created);

    const output: StoreResourceOutput = {
      resource_id: resourceId,
      created: created,
      metadata: {
        stored_at: new Date().toISOString(),
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
    console.error('[store-resource] Error:', error);
    
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
      status: error.code === 'INVALID_INPUT' ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Wrap handler with self-healing
serve(withSelfHealing('store-resource', handler));

