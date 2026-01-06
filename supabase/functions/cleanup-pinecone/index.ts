// ============================================================================
// CLEANUP PINECONE
// ============================================================================
// Delete vectors from Pinecone namespaces
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
const PINECONE_INDEX_HOST = Deno.env.get('PINECONE_INDEX_HOST');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { namespace, keep_test } = await req.json();

    if (!PINECONE_API_KEY || !PINECONE_INDEX_HOST) {
      throw new Error('Pinecone credentials not configured');
    }

    console.log(`[cleanup-pinecone] Deleting all vectors from namespace: ${namespace || 'default'}`);
    
    // Delete all vectors in the namespace
    const url = `https://${PINECONE_INDEX_HOST}/vectors/delete`;
    
    const body: any = {
      deleteAll: true
    };
    
    if (namespace) {
      body.namespace = namespace;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[cleanup-pinecone] Delete error:', response.status, errorText);
      throw new Error(`Pinecone delete failed: ${response.status} - ${errorText}`);
    }

    console.log(`[cleanup-pinecone] Successfully deleted all vectors from ${namespace || 'default'} namespace`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted all vectors from ${namespace || 'default'} namespace`,
        namespace: namespace
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cleanup-pinecone] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

