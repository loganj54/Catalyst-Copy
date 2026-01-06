// ============================================================================
// SEARCH RESOURCES DATABASE
// ============================================================================
// Searches for resources in the Pinecone vector database using OpenAI embeddings
// and retrieves full resource data from Supabase.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { generateEmbedding } from '../_shared/embeddings.ts';
import { queryVectors } from '../_shared/pinecone-client.ts';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse request body
    const { 
      target_resource_profile, 
      unit_id,
      topic,
      blueprint_id 
    } = await req.json();

    if (!target_resource_profile && !topic) {
      throw new Error('Missing target_resource_profile or topic for search');
    }

    // Determine what text to embed
    // Prioritize target_resource_profile, fallback to topic
    const textToEmbed = target_resource_profile || topic;

    console.log(`[search-resources-database] Searching for unit ${unit_id || 'unknown'}`);
    console.log(`[search-resources-database] Embedding text length: ${textToEmbed.length}`);

    // 1. Generate OpenAI Embedding (3072 dimensions)
    const embeddingResponse = await generateEmbedding(textToEmbed);
    const vector = embeddingResponse.embedding;

    // 2. Query Pinecone 'resources' namespace
    // We fetch top 3 to return the 3 highest similarity resources
    console.log('[search-resources-database] Querying Pinecone resources namespace...');
    const searchResults = await queryVectors(
      vector,
      3, // Fetch top 3
      undefined, // No filter
      'resources', // Namespace
      true // Include metadata
    );

    if (!searchResults.matches || searchResults.matches.length === 0) {
      console.log('[search-resources-database] No matches found in Pinecone');
      return new Response(
        JSON.stringify({
          success: true,
          resources: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[search-resources-database] Found ${searchResults.matches.length} matches in Pinecone`);
    
    // Log scores and metadata for debugging
    searchResults.matches.forEach((match, idx) => {
      console.log(`  - Match ${idx + 1}: Vector ID=${match.id}, Score=${match.score.toFixed(4)}`);
      if (match.metadata) {
        console.log(`    Metadata: ${JSON.stringify(match.metadata)}`);
      }
    });

    // 3. Process Top 3 Matches
    const MIN_SIMILARITY_THRESHOLD = 0.60;
    
    const validMatches = searchResults.matches.filter(m => m.score >= MIN_SIMILARITY_THRESHOLD);
    
    if (validMatches.length === 0) {
      console.log(`[search-resources-database] No matches above threshold ${MIN_SIMILARITY_THRESHOLD}.`);
      return new Response(
        JSON.stringify({
          success: true,
          resources: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 4. Extract resource IDs from Pinecone metadata
    // The metadata contains 'resource_id' which matches the 'id' column in resources_from_make table
    const resourceIds = validMatches
      .map(m => m.metadata?.resource_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    
    if (resourceIds.length === 0) {
      console.error('[search-resources-database] ❌ No resource IDs found in Pinecone metadata!');
      console.error('[search-resources-database] Check that vectors have "resource_id" in metadata');
      return new Response(
        JSON.stringify({
          success: true,
          resources: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[search-resources-database] Resource IDs from metadata: ${resourceIds.join(', ')}`);
    
    // 5. Fetch full resource data from Supabase resources_from_make table
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[search-resources-database] Fetching ${resourceIds.length} resources from resources_from_make table...`);
    
    const { data: resources, error: dbError } = await supabase
      .from('resources_from_make')
      .select('*')
      .in('id', resourceIds);

    if (dbError) {
      console.error('[search-resources-database] Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!resources || resources.length === 0) {
      console.error(`[search-resources-database] ❌ Resources found in Pinecone but NOT in Supabase! IDs: ${resourceIds.join(', ')}`);
      return new Response(
        JSON.stringify({
          success: true,
          resources: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[search-resources-database] Successfully retrieved ${resources.length} resources from database`);

    // 6. Format results - preserve order by similarity score
    const formattedResources = validMatches
      .map(match => {
        const metadataResourceId = match.metadata?.resource_id;
        if (!metadataResourceId) return null;
        
        const resource = resources.find(r => r.id === metadataResourceId);
        if (!resource) return null;
        
        return {
          id: resource.id,
          title: resource.title,
          url: resource.url,
          platform: resource.platform || 'Web',
          channel_name: resource.channel_name || 'Unknown',
          thumbnail_url: resource.thumbnail_url,
          duration_seconds: resource.duration_seconds,
          // Include raw fields for the generator to use
          summary: resource.summary,
          description: resource.description,
          // Default explanation (will be overwritten by generator)
          resource_explanation: resource.description || resource.summary || 'High similarity match from database.',
          relevance_score: match.score,
          from_cache: true // Treat database results as "cached/trusted"
        };
      })
      .filter(r => r !== null);

    console.log(`[search-resources-database] Returning ${formattedResources.length} resources`);

    return new Response(
      JSON.stringify({
        success: true,
        resources: formattedResources
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-resources-database] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
