// ============================================================================
// FETCH DOCUMENT ATOMIC FUNCTION
// ============================================================================
// Downloads document from Supabase storage with authentication
// Extracted from analyze-document/index.ts lines 299-441
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import type { FetchDocumentInput, FetchDocumentOutput, FunctionError } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const TIMEOUT_MS = 30000;
const MAX_SIZE_BYTES = 32 * 1024 * 1024; // 32MB

/**
 * Main handler - fetches document from storage
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Parse and validate input
    const input: FetchDocumentInput = await req.json();
    
    if (!input.file_url || input.file_url.trim().length === 0) {
      return errorResponse({
        error: 'file_url is required',
        code: 'INVALID_INPUT',
        details: { field: 'file_url' },
      });
    }

    console.log('[fetch-document] Fetching file...');
    console.log('  - URL:', input.file_url);

    // Try direct fetch first (works for public buckets)
    let fileResponse: Response;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      fileResponse = await fetch(input.file_url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        return errorResponse({
          error: 'Download timeout exceeded',
          code: 'TIMEOUT',
        });
      }
      throw fetchError;
    }

    // If direct fetch failed, try authenticated fetch
    if (!fileResponse.ok) {
      console.log('[fetch-document] Direct fetch failed, trying authenticated...');
      
      // Parse URL to extract bucket and path
      const publicPrefix = '/storage/v1/object/public/';
      let prefixIndex = input.file_url.indexOf(publicPrefix);
      let prefixLength = publicPrefix.length;
      
      if (prefixIndex === -1) {
        const privatePrefix = '/storage/v1/object/';
        prefixIndex = input.file_url.indexOf(privatePrefix);
        prefixLength = privatePrefix.length;
      }
      
      if (prefixIndex !== -1 && SUPABASE_URL && SERVICE_KEY) {
        const afterPrefix = input.file_url.substring(prefixIndex + prefixLength);
        const firstSlashIndex = afterPrefix.indexOf('/');
        
        if (firstSlashIndex !== -1) {
          const bucketNameEncoded = afterPrefix.substring(0, firstSlashIndex);
          const filePathEncoded = afterPrefix.substring(firstSlashIndex + 1);
          
          const bucketName = decodeURIComponent(bucketNameEncoded);
          const filePath = decodeURIComponent(filePathEncoded);
          
          console.log('[fetch-document] Parsed - bucket:', bucketName, 'path:', filePath);
          
          const encodedBucket = encodeURIComponent(bucketName);
          const encodedPath = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
          const authenticatedUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${encodedBucket}/${encodedPath}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
          
          try {
            fileResponse = await fetch(authenticatedUrl, {
              headers: {
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (authError) {
            clearTimeout(timeoutId);
            if (authError.name === 'AbortError') {
              return errorResponse({
                error: 'Download timeout exceeded',
                code: 'TIMEOUT',
              });
            }
            throw authError;
          }
        }
      }
      
      if (!fileResponse.ok) {
        console.error('[fetch-document] Download failed:', fileResponse.status);
        return errorResponse({
          error: `Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`,
          code: fileResponse.status === 404 ? 'NOT_FOUND' : 'API_ERROR',
        });
      }
    }

    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    console.log('[fetch-document] Content type:', contentType);

    // Get content as ArrayBuffer or text
    let content: ArrayBuffer | string;
    
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      content = await fileResponse.arrayBuffer();
      
      if (content.byteLength > MAX_SIZE_BYTES) {
        return errorResponse({
          error: `File exceeds ${MAX_SIZE_BYTES / (1024 * 1024)}MB limit`,
          code: 'INVALID_INPUT',
          details: { size_mb: content.byteLength / (1024 * 1024) },
        });
      }
    } else {
      content = await fileResponse.text();
    }

    const fetchTimeMs = Date.now() - startTime;
    const sizeBytes = content instanceof ArrayBuffer ? content.byteLength : content.length;

    console.log('[fetch-document] Download complete');
    console.log('  - Size:', (sizeBytes / 1024).toFixed(2), 'KB');
    console.log('  - Time:', fetchTimeMs, 'ms');

    const output: FetchDocumentOutput = {
      content,
      content_type: contentType,
      metadata: {
        file_size_bytes: sizeBytes,
        fetch_time_ms: fetchTimeMs,
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
    console.error('[fetch-document] Error:', error);
    
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
      status: error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_FOUND' ? 404 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Wrap handler with self-healing
serve(withSelfHealing('fetch-document', handler));

