// ============================================================================
// GENERATE EMBEDDING ATOMIC FUNCTION
// ============================================================================
// Pure function that generates semantic embeddings from text
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import type { GenerateEmbeddingInput, GenerateEmbeddingOutput, FunctionError } from '../_shared/types.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_TEXT_LENGTH = 8000;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000;

/**
 * Main handler - generates embedding from text
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: GenerateEmbeddingInput = await req.json();
    
    if (!input.text || typeof input.text !== 'string') {
      return errorResponse({
        error: 'Text field is required and must be a string',
        code: 'INVALID_INPUT',
        details: { field: 'text', received: input.text },
      });
    }

    const trimmedText = input.text.trim();
    
    if (trimmedText.length === 0) {
      return errorResponse({
        error: 'Text cannot be empty',
        code: 'INVALID_INPUT',
        details: { field: 'text', received: '' },
      });
    }

    // Check API key
    if (!OPENAI_API_KEY) {
      return errorResponse({
        error: 'OpenAI API key not configured',
        code: 'MISSING_API_KEY',
      });
    }

    // Truncate if needed
    let processedText = trimmedText;
    let truncated = false;
    let originalLength = trimmedText.length;
    
    if (trimmedText.length > MAX_TEXT_LENGTH) {
      processedText = trimmedText.substring(0, MAX_TEXT_LENGTH);
      truncated = true;
      console.log(`[generate-embedding] Truncated text from ${originalLength} to ${MAX_TEXT_LENGTH} chars`);
    }

    // Generate embedding with retry logic
    const embedding = await generateEmbeddingWithRetry(processedText);

    // Build response
    const output: GenerateEmbeddingOutput = {
      embedding: embedding,
      model: EMBEDDING_MODEL,
      metadata: {
        timestamp: new Date().toISOString(),
        text_length: processedText.length,
        ...(truncated && { truncated: true, original_length: originalLength }),
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
    console.error('[generate-embedding] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Generate embedding with exponential backoff retry
 */
async function generateEmbeddingWithRetry(text: string): Promise<number[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`[generate-embedding] Retry ${attempt}/${MAX_RETRIES} after ${delayMs}ms`);
        await sleep(delayMs);
      }

      const embedding = await callOpenAIEmbedding(text);
      return embedding;
    } catch (error) {
      lastError = error as Error;
      console.error(`[generate-embedding] Attempt ${attempt + 1} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.message.includes('API key')) {
        throw error;
      }
      if (error.message.includes('RATE_LIMITED') && attempt === MAX_RETRIES - 1) {
        throw new Error('RATE_LIMITED: OpenAI API rate limit hit. Please try again in 60 seconds.');
      }
    }
  }
  
  throw lastError || new Error('Failed to generate embedding after retries');
}

/**
 * Call OpenAI embeddings API
 */
async function callOpenAIEmbedding(text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      
      throw new Error(`OpenAI API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid response format from OpenAI');
    }

    return data.data[0].embedding;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`TIMEOUT: Request exceeded ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
serve(withSelfHealing('generate-embedding', handler));

