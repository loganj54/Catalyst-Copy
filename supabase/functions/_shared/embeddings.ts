// ============================================================================
// EMBEDDING GENERATION HELPER
// ============================================================================
// Generates vector embeddings using OpenAI's text-embedding-3-small model
// for semantic similarity matching in the resource caching system.
// ============================================================================

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResponse {
  embedding: number[];
  tokens_used: number;
}

/**
 * Generate a vector embedding for the given text using OpenAI's embedding API.
 * 
 * @param text - The text to generate an embedding for
 * @returns The embedding vector (1536 dimensions) and token count
 * @throws Error if the API call fails or returns invalid data
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not set. Run: supabase secrets set OPENAI_API_KEY=your-key'
    );
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  // Truncate very long text to avoid token limits (8191 tokens max for this model)
  // Approximate: 1 token ≈ 4 characters
  const maxChars = 30000;
  const truncatedText = text.length > maxChars 
    ? text.substring(0, maxChars) + '...'
    : text;

  console.log('[embeddings] Generating embedding...');
  console.log(`  - Model: ${EMBEDDING_MODEL}`);
  console.log(`  - Text length: ${truncatedText.length} chars`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[embeddings] OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    console.error('[embeddings] Invalid response structure:', JSON.stringify(data));
    throw new Error('Invalid embedding response from OpenAI');
  }

  const embedding = data.data[0].embedding;
  const tokensUsed = data.usage?.total_tokens || 0;

  console.log(`[embeddings] Generated ${embedding.length}-dimension embedding`);
  console.log(`  - Tokens used: ${tokensUsed}`);

  return {
    embedding,
    tokens_used: tokensUsed,
  };
}

/**
 * Generate embeddings for multiple texts in a single API call (batch mode).
 * More efficient than calling generateEmbedding multiple times.
 * 
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of embeddings in the same order as input texts
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not set. Run: supabase secrets set OPENAI_API_KEY=your-key'
    );
  }

  if (!texts || texts.length === 0) {
    return [];
  }

  // Truncate and filter empty texts
  const maxChars = 30000;
  const processedTexts = texts.map(text => {
    if (!text || text.trim().length === 0) {
      return '[empty]';
    }
    return text.length > maxChars 
      ? text.substring(0, maxChars) + '...'
      : text;
  });

  console.log(`[embeddings] Generating ${texts.length} embeddings in batch...`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: processedTexts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[embeddings] OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data)) {
    console.error('[embeddings] Invalid batch response:', JSON.stringify(data));
    throw new Error('Invalid batch embedding response from OpenAI');
  }

  // Sort by index to ensure correct order
  const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
  
  const results: EmbeddingResponse[] = sorted.map((item: any) => ({
    embedding: item.embedding,
    tokens_used: Math.floor((data.usage?.total_tokens || 0) / texts.length),
  }));

  console.log(`[embeddings] Generated ${results.length} embeddings`);
  console.log(`  - Total tokens: ${data.usage?.total_tokens || 0}`);

  return results;
}

/**
 * Create a combined text for embedding from topic information.
 * This produces a consistent format for both queries and stored signatures.
 * 
 * @param topic - The topic name
 * @param description - Topic description
 * @param searchQueries - Optional array of search queries
 * @returns Combined text optimized for embedding
 */
export function createTopicEmbeddingText(
  topic: string,
  description?: string,
  searchQueries?: string[]
): string {
  const parts: string[] = [
    `Topic: ${topic}`,
  ];

  if (description) {
    parts.push(`Description: ${description}`);
  }

  if (searchQueries && searchQueries.length > 0) {
    parts.push(`Related searches: ${searchQueries.join('; ')}`);
  }

  return parts.join('\n');
}

/**
 * Format a vector for use in a PostgreSQL query.
 * Converts the number array to the format expected by pgvector.
 * 
 * @param embedding - The embedding vector array
 * @returns String formatted for pgvector: '[0.1,0.2,0.3,...]'
 */
export function formatVectorForPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export { EMBEDDING_DIMENSIONS };

