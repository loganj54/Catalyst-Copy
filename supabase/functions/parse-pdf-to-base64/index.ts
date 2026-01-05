// ============================================================================
// PARSE PDF TO BASE64 ATOMIC FUNCTION
// ============================================================================
// Converts PDF ArrayBuffer to base64 for Claude vision
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { arrayBufferToBase64 } from '../_shared/supabase-client.ts';
import type { ParsePdfToBase64Input, ParsePdfToBase64Output, FunctionError } from '../_shared/types.ts';

const MAX_SIZE_MB = 32;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Main handler - converts PDF to base64
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: ParsePdfToBase64Input = await req.json();
    
    if (!input.pdf_buffer) {
      return errorResponse({
        error: 'pdf_buffer is required',
        code: 'INVALID_INPUT',
        details: { field: 'pdf_buffer' },
      });
    }

    // Convert to ArrayBuffer if needed
    let buffer: ArrayBuffer;
    
    if (input.pdf_buffer instanceof ArrayBuffer) {
      buffer = input.pdf_buffer;
    } else if (typeof input.pdf_buffer === 'object' && input.pdf_buffer.data) {
      // Handle { data: Uint8Array } format from some serializations
      buffer = new Uint8Array(input.pdf_buffer.data).buffer;
    } else {
      return errorResponse({
        error: 'pdf_buffer must be an ArrayBuffer',
        code: 'INVALID_INPUT',
        details: { type: typeof input.pdf_buffer },
      });
    }

    const sizeBytes = buffer.byteLength;
    const sizeMB = sizeBytes / (1024 * 1024);

    console.log('[parse-pdf-to-base64] Converting PDF...');
    console.log(`  - Size: ${sizeMB.toFixed(2)} MB`);

    // Check size limit
    if (sizeBytes === 0) {
      return errorResponse({
        error: 'PDF buffer is empty',
        code: 'INVALID_INPUT',
        details: { size_bytes: 0 },
      });
    }

    if (sizeBytes > MAX_SIZE_BYTES) {
      return errorResponse({
        error: `PDF exceeds ${MAX_SIZE_MB}MB limit`,
        code: 'INVALID_INPUT',
        details: {
          size_mb: sizeMB,
          max_mb: MAX_SIZE_MB,
        },
      });
    }

    // Convert to base64
    const base64 = arrayBufferToBase64(buffer);
    
    const parseTimeMs = Date.now() - startTime;

    console.log('[parse-pdf-to-base64] Conversion complete');
    console.log(`  - Base64 length: ${base64.length} chars`);
    console.log(`  - Time: ${parseTimeMs}ms`);

    const output: ParsePdfToBase64Output = {
      base64,
      size_mb: sizeMB,
      metadata: {
        parse_time_ms: parseTimeMs,
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
    console.error('[parse-pdf-to-base64] Error:', error);
    
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

// Wrap handler with self-healing
serve(withSelfHealing('parse-pdf-to-base64', handler));

