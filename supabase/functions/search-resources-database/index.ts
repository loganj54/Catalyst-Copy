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
import { queryVectors, fetchVectors } from '../_shared/pinecone-client.ts';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse request body
    const {
      target_resource_profile,
      target_resource_embedding, // NEW: optional pre-computed embedding
      unit_id,
      topic,
      blueprint_id
    } = await req.json();

    // Get user from auth header for DB updates
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      userId = user?.id;
    }

    if (!target_resource_profile && !topic && !target_resource_embedding) {
      throw new Error('Missing target_resource_profile, topic, or target_resource_embedding for search');
    }

    console.log(`[search-resources-database] Searching for unit ${unit_id || 'unknown'}`);

    let vector: number[] | null = null;

    // 1. Determine vector source (Pinecone > Pre-computed > Generate)

    // Option A: Use pre-computed embedding if passed (backwards compatibility)
    if (target_resource_embedding && Array.isArray(target_resource_embedding) && target_resource_embedding.length === 3072) {
      console.log('[search-resources-database] ✅ Using provided pre-computed embedding (3072 dims)');
      vector = target_resource_embedding;
    }

    // Option B: Fetch from Pinecone target_profiles namespace using blueprint_id + unit_id
    if (!vector && unit_id && blueprint_id) {
      try {
        const vectorId = `target-${blueprint_id}-${unit_id}`;
        console.log(`[search-resources-database] Fetching embedding from Pinecone target_profiles (${vectorId})...`);
        const fetched = await fetchVectors([vectorId], 'target_profiles');

        if (fetched[vectorId] && fetched[vectorId].values) {
          vector = fetched[vectorId].values;
          console.log(`[search-resources-database] ✅ Retrieved embedding from Pinecone target_profiles (${vector.length} dims)`);
        } else {
          console.log('[search-resources-database] ⚠️ No embedding found in Pinecone for this unit');
        }
      } catch (fetchError) {
        console.error('[search-resources-database] Error fetching from Pinecone:', fetchError);
      }
    }

    // Option C: Generate embedding on-demand (fallback for old blueprints or missing data)
    if (!vector) {
      const textToEmbed = target_resource_profile || topic;
      if (!textToEmbed) {
        throw new Error('No embedding available and no text to generate from');
      }
      console.log(`[search-resources-database] ⚠️ Generating new embedding on-demand (Text length: ${textToEmbed.length})`);
      const embeddingResponse = await generateEmbedding(textToEmbed);
      vector = embeddingResponse.embedding;
    }

    // 2. Query Pinecone 'resources' namespace
    // Fetch top 10 candidates, then filter by threshold and sort by user rating
    console.log('[search-resources-database] Querying Pinecone resources namespace...');
    const searchResults = await queryVectors(
      vector,
      10, // Fetch top 10 candidates for rating-based sorting
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

    // 3. Filter by similarity threshold
    // text-embedding-3-large has a broader distribution. 0.55 is a strong semantic match.
    // 0.92 is only for near-duplicates.
    const MIN_SIMILARITY_THRESHOLD = 0.55;

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

    // NOTE: Resource saving moved to AFTER sorting (see below)
    // This ensures timestamps match the display order (sorted by rating)

    // 7. Format results and sort by average rating (highest first)
    const formattedResources = validMatches
      .map(match => {
        const metadataResourceId = match.metadata?.resource_id;
        if (!metadataResourceId) return null;

        const resource = resources.find(r => r.id === metadataResourceId);
        if (!resource) return null;

        return {
          id: resource.id,
          // Ensure type is present; default to 'video' for compatibility with frontend filters
          type: resource.type || 'video',
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
          from_cache: true, // Treat database results as "cached/trusted"
          // Rating fields
          average_rating: resource.average_rating ? parseFloat(resource.average_rating) : null,
          rating_count: resource.rating_count || 0
        };
      })
      .filter(r => r !== null)
      // Sort by average rating (highest first), unrated resources last
      .sort((a, b) => {
        // If both have ratings, sort by rating DESC
        if (a.average_rating !== null && b.average_rating !== null) {
          return b.average_rating - a.average_rating;
        }
        // Resources with ratings come before unrated
        if (a.average_rating !== null) return -1;
        if (b.average_rating !== null) return 1;
        // If both unrated, maintain similarity order
        return b.relevance_score - a.relevance_score;
      })
      // Return top 3 after sorting by rating
      .slice(0, 3);

    console.log(`[search-resources-database] Returning ${formattedResources.length} resources`);

    // 7. Save resources to blueprint AFTER sorting
    // This ensures timestamps match the display order (first resource = most recent)
    if (formattedResources.length > 0 && blueprint_id && unit_id) {
      console.log(`[search-resources-database] Saving ${formattedResources.length} resources to blueprint in display order...`);

      for (let i = 0; i < formattedResources.length; i++) {
        const resource = formattedResources[i];

        try {
          // Stagger timestamps: first resource = NOW, subsequent = progressively older
          // This ensures database order matches display order on page refresh
          const now = new Date();
          const resourceTimestamp = new Date(now.getTime() - (i * 1000));

          const linkData: Record<string, any> = {
            blueprint_id,
            unit_id,
            resource_id: resource.id,
            relevance_score: resource.relevance_score,
            query_type: 'database',
            from_cache: true,
            resource_explanation: resource.resource_explanation,
            is_hidden: false,
            created_at: resourceTimestamp.toISOString()
          };

          console.log(`[search-resources-database] Linking resource ${i + 1}/${formattedResources.length}:`, {
            resource_id: resource.id,
            title: resource.title?.substring(0, 40),
            created_at: linkData.created_at,
            is_primary: i === 0
          });

          // Use ignoreDuplicates to skip existing resources (preserves user selections)
          const { error: linkError } = await supabase
            .from('blueprint_topic_resources')
            .upsert(linkData, {
              onConflict: 'blueprint_id,unit_id,resource_id',
              ignoreDuplicates: true
            });

          if (linkError) {
            console.error(`[search-resources-database] ❌ Error linking: ${linkError.message}`);
          }
        } catch (err) {
          console.error(`[search-resources-database] Error:`, err);
        }
      }

      // Update topic response
      if (userId) {
        await supabase
          .from('topic_responses')
          .upsert({
            blueprint_id,
            unit_id,
            user_id: userId,
            response: 'needs_help',
            searched_at: new Date().toISOString(),
          }, { onConflict: 'blueprint_id,unit_id' });
      }
    }

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
