// ============================================================================
// ORCHESTRATE SEARCH RESOURCES
// ============================================================================
// Composes atomic search functions into complete resource discovery workflow
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import type { OrchestrateSearchResourcesInput, OrchestrateSearchResourcesOutput, FunctionError } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

/**
 * Call an atomic edge function
 */
async function callFunction(functionName: string, input: any, authHeader: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${functionName} failed: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Main orchestrator handler
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();
  const stepsCompleted: string[] = [];

  try {
    const input: OrchestrateSearchResourcesInput = await req.json();
    const authHeader = req.headers.get('Authorization') || '';

    if (!input.blueprint_id || !input.unit_id || !input.topic) {
      return errorResponse({
        error: 'blueprint_id, unit_id, and topic are required',
        code: 'INVALID_INPUT',
      });
    }

    console.log('[orchestrate-search-resources] Starting workflow');
    console.log('  - Topic:', input.topic);
    console.log('  - Queries:', input.search_queries?.length || 0);

    // STEP 1: Get or generate embedding for topic
    console.log('[orchestrate-search-resources] Step 1: Getting embedding...');
    
    let embedding: number[];
    
    // NEW: Check if target_resource_embedding was pre-computed and passed in the input
    if (input.target_resource_embedding && Array.isArray(input.target_resource_embedding) && input.target_resource_embedding.length === 1536) {
      console.log('[orchestrate-search-resources] ✅ Using pre-computed target resource embedding from structure generation');
      embedding = input.target_resource_embedding;
      // No API call needed - embedding already available!
    } else {
      // Fallback: Generate embedding on-demand (legacy behavior)
      console.log('[orchestrate-search-resources] ⚠️ No pre-computed target resource embedding found, generating on-demand...');
      
      // Use the target_resource_profile if available (PREFERRED), otherwise semantic_search_phrase, otherwise construct
      let embeddingText = input.target_resource_profile 
        || input.semantic_search_phrase
        || `${input.topic} ${input.description || ''} ${input.learning_objective || ''}`;
      
      console.log('[orchestrate-search-resources] Generating embedding from:', embeddingText.substring(0, 100) + '...');

      const embeddingResult = await callFunction('generate-embedding', {
        text: embeddingText.trim(),
      }, authHeader);
      stepsCompleted.push('generate-embedding');
      
      embedding = embeddingResult.embedding;
    }

    // STEP 2: Search cache for similar resources
    console.log('[orchestrate-search-resources] Step 2: Searching cache...');
    const cacheResult = await callFunction('search-db-cache', {
      embedding: embedding,
      threshold: 0.95,
      max_results: 3,
    }, authHeader);
    stepsCompleted.push('search-db-cache');

    // If cache hit, link and return
    if (cacheResult.cache_hit && cacheResult.resources.length > 0) {
      console.log('[orchestrate-search-resources] Cache HIT! Found', cacheResult.resources.length, 'resources');
      
      // Link cached resources to blueprint
      for (const resource of cacheResult.resources) {
        try {
          await callFunction('link-resource-to-blueprint', {
            blueprint_id: input.blueprint_id,
            unit_id: input.unit_id,
            resource_id: resource.id,
            relevance: resource.similarity || 0.95,
            query_type: 'cache',
          }, authHeader);
        } catch (linkError) {
          console.log('[orchestrate-search-resources] Link failed, continuing...');
        }
      }
      stepsCompleted.push('link-resource-to-blueprint');

      const totalTimeMs = Date.now() - startTime;

      const output: OrchestrateSearchResourcesOutput = {
        resources: cacheResult.resources,
        cache_hit: true,
        search_method: 'cache',
        metadata: {
          total_time_ms: totalTimeMs,
          steps_completed: stepsCompleted,
        },
      };

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 3: Cache miss - search YouTube
    console.log('[orchestrate-search-resources] Step 3: Searching YouTube...');
    const youtubeResult = await callFunction('search-youtube', {
      queries: input.search_queries?.map(q => q.query) || [input.topic],
      max_results: 3,
    }, authHeader);
    stepsCompleted.push('search-youtube');

    const newResources = youtubeResult.resources;

    if (newResources.length === 0) {
      console.log('[orchestrate-search-resources] No resources found');
      
      const totalTimeMs = Date.now() - startTime;
      const output: OrchestrateSearchResourcesOutput = {
        resources: [],
        cache_hit: false,
        search_method: 'youtube_api',
        metadata: {
          total_time_ms: totalTimeMs,
          steps_completed: stepsCompleted,
        },
      };

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 4: Analyze transcripts for each resource
    console.log('[orchestrate-search-resources] Step 4: Analyzing transcripts...');
    for (const resource of newResources) {
      try {
        const transcriptResult = await callFunction('analyze-transcript', {
          video_url: resource.url,
          metadata: {
            title: resource.title,
            description: resource.description,
            channelName: resource.channel_name,
          },
        }, authHeader);
        
        // Enrich resource with analysis
        resource.content_analysis = transcriptResult.analysis;
        resource.transcript_analyzed = true;
        resource.transcript_source = transcriptResult.transcript_source;
        resource.analysis_confidence = transcriptResult.confidence;
      } catch (transcriptError) {
        console.log('[orchestrate-search-resources] Transcript analysis failed for:', resource.title);
        resource.transcript_analyzed = false;
      }
    }
    stepsCompleted.push('analyze-transcript');

    // STEP 5: Store each resource with embedding
    console.log('[orchestrate-search-resources] Step 5: Storing resources...');
    for (const resource of newResources) {
      try {
        const storeResult = await callFunction('store-resource', {
          resource: resource,
          embedding: embedding, // Use same embedding for now
        }, authHeader);
        resource.id = storeResult.resource_id;
      } catch (storeError) {
        console.log('[orchestrate-search-resources] Store failed for:', resource.title);
      }
    }
    stepsCompleted.push('store-resource');

    // STEP 6: Link resources to blueprint
    console.log('[orchestrate-search-resources] Step 6: Linking to blueprint...');
    for (const resource of newResources) {
      if (resource.id) {
        try {
          await callFunction('link-resource-to-blueprint', {
            blueprint_id: input.blueprint_id,
            unit_id: input.unit_id,
            resource_id: resource.id,
            relevance: resource.quality_score || 0.8,
            query_type: resource.query_type || 'search',
          }, authHeader);
        } catch (linkError) {
          console.log('[orchestrate-search-resources] Link failed for:', resource.title);
        }
      }
    }
    stepsCompleted.push('link-resource-to-blueprint');

    // STEP 7: Generate explanations
    console.log('[orchestrate-search-resources] Step 7: Generating explanations...');
    try {
      const explanationResult = await callFunction('generate-resource-explanations', {
        topic: input.topic,
        resources: newResources,
        learning_objective: input.learning_objective,
        description: input.description,
      }, authHeader);
      
      // Update resources with explanations
      for (const resource of newResources) {
        const match = explanationResult.resources_with_explanations.find((r: any) => r.url === resource.url);
        if (match) {
          resource.resource_explanation = match.resource_explanation;
        }
      }
      stepsCompleted.push('generate-resource-explanations');
    } catch (explainError) {
      console.log('[orchestrate-search-resources] Explanation generation failed, continuing...');
    }

    const totalTimeMs = Date.now() - startTime;

    console.log('[orchestrate-search-resources] Workflow complete!');
    console.log('  - Resources found:', newResources.length);
    console.log('  - Steps:', stepsCompleted.length);
    console.log('  - Time:', totalTimeMs, 'ms');

    const output: OrchestrateSearchResourcesOutput = {
      resources: newResources,
      cache_hit: false,
      search_method: 'youtube_api',
      metadata: {
        total_time_ms: totalTimeMs,
        steps_completed: stepsCompleted,
      },
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[orchestrate-search-resources] Error:', error);
    
    return errorResponse({
      error: error.message || 'Workflow failed',
      code: 'INTERNAL_ERROR',
      details: { steps_completed: stepsCompleted },
    });
  }
};

function errorResponse(error: FunctionError): Response {
  return new Response(JSON.stringify(error), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(withSelfHealing('orchestrate-search-resources', handler));

