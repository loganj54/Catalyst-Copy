// ============================================================================
// PINECONE CLIENT
// ============================================================================
// Handles vector storage and similarity search using Pinecone
// Supports 3072-dimensional embeddings from text-embedding-3-large
// ============================================================================

const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
const PINECONE_INDEX_HOST = Deno.env.get('PINECONE_INDEX_HOST');

export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

export interface PineconeQueryResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface PineconeQueryResponse {
  matches: PineconeQueryResult[];
  namespace?: string;
}

/**
 * Upsert vectors to Pinecone index
 * @param vectors - Array of vectors to upsert
 * @param namespace - Optional namespace for organization
 */
export async function upsertVectors(
  vectors: PineconeVector[],
  namespace?: string
): Promise<{ upsertedCount: number }> {
  if (!PINECONE_API_KEY || !PINECONE_INDEX_HOST) {
    throw new Error('Pinecone credentials not configured');
  }

  const url = `https://${PINECONE_INDEX_HOST}/vectors/upsert`;
  
  const body: any = { vectors };
  if (namespace) {
    body.namespace = namespace;
  }

  console.log(`[pinecone] Upserting ${vectors.length} vectors...`);

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
    console.error('[pinecone] Upsert error:', response.status, errorText);
    throw new Error(`Pinecone upsert failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`[pinecone] Upserted ${result.upsertedCount || vectors.length} vectors`);

  return { upsertedCount: result.upsertedCount || vectors.length };
}

/**
 * Query vectors by similarity
 * @param queryVector - The query embedding (3072 dimensions)
 * @param topK - Number of results to return
 * @param filter - Optional metadata filter
 * @param namespace - Optional namespace
 * @param includeMetadata - Whether to include metadata in results
 */
export async function queryVectors(
  queryVector: number[],
  topK: number = 10,
  filter?: Record<string, any>,
  namespace?: string,
  includeMetadata: boolean = true
): Promise<PineconeQueryResponse> {
  if (!PINECONE_API_KEY || !PINECONE_INDEX_HOST) {
    throw new Error('Pinecone credentials not configured');
  }

  const url = `https://${PINECONE_INDEX_HOST}/query`;
  
  const body: any = {
    vector: queryVector,
    topK,
    includeMetadata,
  };
  
  if (filter) {
    body.filter = filter;
  }
  
  if (namespace) {
    body.namespace = namespace;
  }

  console.log(`[pinecone] Querying for top ${topK} similar vectors...`);

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
    console.error('[pinecone] Query error:', response.status, errorText);
    throw new Error(`Pinecone query failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`[pinecone] Found ${result.matches?.length || 0} matches`);

  return result;
}

/**
 * Delete vectors by IDs
 * @param ids - Array of vector IDs to delete
 * @param namespace - Optional namespace
 */
export async function deleteVectors(
  ids: string[],
  namespace?: string
): Promise<void> {
  if (!PINECONE_API_KEY || !PINECONE_INDEX_HOST) {
    throw new Error('Pinecone credentials not configured');
  }

  const url = `https://${PINECONE_INDEX_HOST}/vectors/delete`;
  
  const body: any = { ids };
  if (namespace) {
    body.namespace = namespace;
  }

  console.log(`[pinecone] Deleting ${ids.length} vectors...`);

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
    console.error('[pinecone] Delete error:', response.status, errorText);
    throw new Error(`Pinecone delete failed: ${response.status} - ${errorText}`);
  }

  console.log(`[pinecone] Deleted ${ids.length} vectors`);
}

/**
 * Fetch vectors by IDs
 * @param ids - Array of vector IDs to fetch
 * @param namespace - Optional namespace
 */
export async function fetchVectors(
  ids: string[],
  namespace?: string
): Promise<Record<string, PineconeVector>> {
  if (!PINECONE_API_KEY || !PINECONE_INDEX_HOST) {
    throw new Error('Pinecone credentials not configured');
  }

  const url = `https://${PINECONE_INDEX_HOST}/vectors/fetch?${ids.map(id => `ids=${id}`).join('&')}${namespace ? `&namespace=${namespace}` : ''}`;

  console.log(`[pinecone] Fetching ${ids.length} vectors...`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Api-Key': PINECONE_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[pinecone] Fetch error:', response.status, errorText);
    throw new Error(`Pinecone fetch failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`[pinecone] Fetched ${Object.keys(result.vectors || {}).length} vectors`);

  return result.vectors || {};
}

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<any> {
  if (!PINECONE_API_KEY || !PINECONE_INDEX_HOST) {
    throw new Error('Pinecone credentials not configured');
  }

  const url = `https://${PINECONE_INDEX_HOST}/describe_index_stats`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Api-Key': PINECONE_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[pinecone] Stats error:', response.status, errorText);
    throw new Error(`Pinecone stats failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

