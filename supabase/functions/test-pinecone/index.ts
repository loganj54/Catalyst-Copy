// ============================================================================
// TEST PINECONE INTEGRATION
// ============================================================================
// Simple test function to verify Pinecone is working
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { generateEmbedding } from '../_shared/embeddings.ts';
import { upsertVectors, queryVectors, getIndexStats } from '../_shared/pinecone-client.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { action, text, namespace } = await req.json();

    if (action === 'test_store') {
      // Test storing a vector
      console.log('[test-pinecone] Testing vector storage...');
      
      const testText = text || "Newton's Laws of Motion explain the relationship between force, mass, and acceleration";
      const embedding = await generateEmbedding(testText);
      
      console.log(`[test-pinecone] Generated ${embedding.embedding.length}-dimensional embedding`);
      
      const testId = `test-${Date.now()}`;
      await upsertVectors([{
        id: testId,
        values: embedding.embedding,
        metadata: {
          text: testText,
          test: true,
          created_at: new Date().toISOString()
        }
      }], 'test');
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Vector stored in Pinecone!',
          vector_id: testId,
          dimensions: embedding.embedding.length,
          text: testText
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'test_search') {
      // Test searching for similar vectors
      console.log('[test-pinecone] Testing vector search...');
      
      const queryText = text || "force and acceleration";
      const embedding = await generateEmbedding(queryText);
      
      const results = await queryVectors(
        embedding.embedding,
        5,
        undefined,
        'test',
        true
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Search complete!',
          query: queryText,
          matches: results.matches.map(m => ({
            id: m.id,
            score: m.score,
            metadata: m.metadata
          }))
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'search_namespace') {
      // Search a specific namespace
      console.log(`[test-pinecone] Searching namespace: ${namespace}...`);
      
      const queryText = text || "example query";
      const embedding = await generateEmbedding(queryText);
      
      const results = await queryVectors(
        embedding.embedding,
        10, // Get more results for namespace searches
        undefined, // No filter
        namespace || 'test',
        true // Include metadata
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Search complete in ${namespace} namespace!`,
          query: queryText,
          namespace: namespace,
          matches: results.matches.map(m => ({
            id: m.id,
            score: m.score,
            metadata: m.metadata
          }))
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_stats') {
      // Get index statistics
      console.log('[test-pinecone] Getting index stats...');
      
      const stats = await getIndexStats();
      
      return new Response(
        JSON.stringify({
          success: true,
          stats: stats
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Invalid action. Use: test_store, test_search, search_namespace, or get_stats'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-pinecone] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

