// ============================================================================
// RESOURCE VECTOR STORAGE
// ============================================================================
// Manages vector storage for educational resources
// - Metadata in Supabase (curated_resources table)
// - Vectors in Pinecone (3072 dimensions)
// ============================================================================

import { upsertVectors, queryVectors, deleteVectors } from './pinecone-client.ts';
import { generateEmbedding } from './embeddings.ts';

export interface ResourceVectorMetadata {
  resource_id: string;
  title: string;
  platform?: string;
  difficulty_level?: string;
  subject_area?: string;
  concepts?: string[];
}

/**
 * Store a resource vector in Pinecone
 * @param resourceId - UUID of the resource in Supabase
 * @param embedding - 3072-dimensional embedding
 * @param metadata - Resource metadata for filtering
 */
export async function storeResourceVector(
  resourceId: string,
  embedding: number[],
  metadata: ResourceVectorMetadata
): Promise<void> {
  if (embedding.length !== 3072) {
    throw new Error(`Expected 3072-dimensional embedding, got ${embedding.length}`);
  }

  await upsertVectors([{
    id: resourceId,
    values: embedding,
    metadata: {
      ...metadata,
      stored_at: new Date().toISOString(),
    },
  }], 'resources');

  console.log(`[resource-vector] Stored vector for resource ${resourceId}`);
}

/**
 * Search for similar resources using vector similarity
 * @param queryEmbedding - 3072-dimensional query embedding
 * @param topK - Number of results to return
 * @param filters - Optional metadata filters
 */
export async function searchSimilarResources(
  queryEmbedding: number[],
  topK: number = 10,
  filters?: {
    platform?: string;
    difficulty_level?: string;
    subject_area?: string;
    min_similarity?: number;
  }
): Promise<Array<{ resource_id: string; similarity: number; metadata: any }>> {
  if (queryEmbedding.length !== 3072) {
    throw new Error(`Expected 3072-dimensional embedding, got ${queryEmbedding.length}`);
  }

  // Build Pinecone filter
  const pineconeFilter: any = {};
  if (filters?.platform) {
    pineconeFilter.platform = { $eq: filters.platform };
  }
  if (filters?.difficulty_level) {
    pineconeFilter.difficulty_level = { $eq: filters.difficulty_level };
  }
  if (filters?.subject_area) {
    pineconeFilter.subject_area = { $eq: filters.subject_area };
  }

  const results = await queryVectors(
    queryEmbedding,
    topK,
    Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined,
    'resources',
    true
  );

  // Filter by minimum similarity if specified
  let matches = results.matches || [];
  if (filters?.min_similarity) {
    matches = matches.filter(m => m.score >= filters.min_similarity!);
  }

  return matches.map(match => ({
    resource_id: match.id,
    similarity: match.score,
    metadata: match.metadata || {},
  }));
}

/**
 * Delete a resource vector from Pinecone
 * @param resourceId - UUID of the resource
 */
export async function deleteResourceVector(resourceId: string): Promise<void> {
  await deleteVectors([resourceId], 'resources');
  console.log(`[resource-vector] Deleted vector for resource ${resourceId}`);
}

/**
 * Batch store multiple resource vectors
 * @param resources - Array of resources with embeddings
 */
export async function batchStoreResourceVectors(
  resources: Array<{
    resourceId: string;
    embedding: number[];
    metadata: ResourceVectorMetadata;
  }>
): Promise<void> {
  const vectors = resources.map(r => ({
    id: r.resourceId,
    values: r.embedding,
    metadata: {
      ...r.metadata,
      stored_at: new Date().toISOString(),
    },
  }));

  // Pinecone recommends batches of 100-200 vectors
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await upsertVectors(batch, 'resources');
    console.log(`[resource-vector] Stored batch ${i / batchSize + 1} (${batch.length} vectors)`);
  }

  console.log(`[resource-vector] Stored ${resources.length} resource vectors total`);
}

