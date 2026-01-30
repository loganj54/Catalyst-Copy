// ============================================================================
// YOUTUBE TRANSCRIPT FETCHER
// ============================================================================
// Fetches video transcripts using Supadata.ai API (reliable third-party service)
// Falls back to metadata-only analysis if transcript unavailable.
// ============================================================================

const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY');

export interface TranscriptResult {
  success: boolean;
  transcript: string | null;
  source: 'auto_generated' | 'manual' | 'failed';
  language: string | null;
  wordCount: number;
  error?: string;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;
  
  // Match youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  
  // Match youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  
  // Match youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  
  // Match just the video ID if passed directly
  const idMatch = url.match(/^([a-zA-Z0-9_-]{11})$/);
  if (idMatch) return idMatch[1];
  
  return null;
}

/**
 * Parse transcript from SupaData format to plain text
 * SupaData may return either:
 * 1. Plain text string
 * 2. Array of segments: [{"text":"...", "offset":123, "duration":456}, ...]
 * 3. Object with nested data
 */
function parseTranscriptData(transcriptData: any): string {
  // If it's already a string, return it
  if (typeof transcriptData === 'string') {
    return transcriptData;
  }

  // If it's an array of segments (common SupaData format)
  if (Array.isArray(transcriptData)) {
    const textSegments = transcriptData
      .filter(segment => segment && typeof segment === 'object' && segment.text)
      .map(segment => segment.text.trim())
      .filter(text => text.length > 0);
    
    if (textSegments.length > 0) {
      return textSegments.join(' ');
    }
  }

  // If it's an object with a text property
  if (transcriptData && typeof transcriptData === 'object') {
    if (transcriptData.text) {
      return String(transcriptData.text);
    }
    if (transcriptData.content) {
      return String(transcriptData.content);
    }
  }

  // Fallback: try to stringify
  return String(transcriptData);
}

/**
 * Fetch transcript for a YouTube video using Supadata.ai API
 * 
 * @param videoIdOrUrl - YouTube video ID or full URL
 * @returns TranscriptResult with transcript text and metadata
 */
export async function fetchTranscript(videoIdOrUrl: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;
  
  if (!videoId || videoId.length !== 11) {
    return {
      success: false,
      transcript: null,
      source: 'failed',
      language: null,
      wordCount: 0,
      error: 'Invalid video ID or URL',
    };
  }

  // Check if API key is configured
  if (!SUPADATA_API_KEY) {
    console.log('[transcript] SUPADATA_API_KEY not set - skipping transcript fetch');
    return {
      success: false,
      transcript: null,
      source: 'failed',
      language: null,
      wordCount: 0,
      error: 'Transcript API not configured (SUPADATA_API_KEY missing)',
    };
  }

  console.log(`[transcript] Fetching transcript via Supadata for: ${videoId}`);

  try {
    // Call Supadata.ai transcript API
    const response = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`,
      {
        method: 'GET',
        headers: {
          'x-api-key': SUPADATA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[transcript] Supadata API error: ${response.status} - ${errorText}`);
      
      // Check for specific error types
      if (response.status === 404) {
        return {
          success: false,
          transcript: null,
          source: 'failed',
          language: null,
          wordCount: 0,
          error: 'No transcript available for this video',
        };
      }
      
      return {
        success: false,
        transcript: null,
        source: 'failed',
        language: null,
        wordCount: 0,
        error: `Supadata API error: ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Extract transcript text from response
    // Supadata may return different formats depending on the endpoint and parameters
    const rawTranscript = data.content || data.transcript || data.text || data.data?.transcript;
    
    if (!rawTranscript) {
      console.log('[transcript] No transcript data found in response');
      return {
        success: false,
        transcript: null,
        source: 'failed',
        language: null,
        wordCount: 0,
        error: 'No transcript data in response',
      };
    }

    // Parse the transcript (handles both array format and plain text)
    const transcriptText = parseTranscriptData(rawTranscript);
    
    if (!transcriptText || transcriptText.trim().length < 50) {
      console.log('[transcript] Supadata returned empty or very short transcript');
      return {
        success: false,
        transcript: null,
        source: 'failed',
        language: null,
        wordCount: 0,
        error: 'Transcript too short or empty',
      };
    }

    const cleanedText = transcriptText.trim().replace(/\s+/g, ' ');
    const wordCount = cleanedText.split(/\s+/).length;
    
    // Determine if auto-generated based on response metadata
    const isAutoGenerated = data.isAutoGenerated ?? true;
    
    console.log(`[transcript] Supadata success: ${wordCount} words (${isAutoGenerated ? 'auto' : 'manual'})`);
    console.log(`[transcript] First 200 chars: ${cleanedText.substring(0, 200)}...`);

    return {
      success: true,
      transcript: cleanedText,
      source: isAutoGenerated ? 'auto_generated' : 'manual',
      language: data.language || 'en',
      wordCount,
    };

  } catch (error) {
    console.error('[transcript] Supadata fetch error:', error);
    return {
      success: false,
      transcript: null,
      source: 'failed',
      language: null,
      wordCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Truncate transcript to a maximum length while preserving complete sentences
 * 
 * @param transcript - Full transcript text
 * @param maxChars - Maximum characters (default 15000 for ~3500 tokens)
 * @returns Truncated transcript
 */
export function truncateTranscript(transcript: string, maxChars: number = 15000): string {
  if (!transcript || transcript.length <= maxChars) {
    return transcript;
  }

  const truncated = transcript.substring(0, maxChars);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? ')
  );

  if (lastSentenceEnd > maxChars * 0.7) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.9) {
    return truncated.substring(0, lastSpace).trim() + '...';
  }

  return truncated.trim() + '...';
}

// ============================================================================
// BATCH TRANSCRIPT FETCHING
// ============================================================================

export interface BatchTranscriptResult {
  transcripts: Map<string, TranscriptResult>;
  succeeded: number;
  failed: number;
}

/**
 * Fetch transcripts for multiple YouTube videos using SupaData batch API
 * Much more efficient than individual calls - single job with polling
 *
 * @param videoIdsOrUrls - Array of YouTube video IDs or URLs
 * @returns Map of videoId -> TranscriptResult
 */
export async function fetchTranscriptsBatch(videoIdsOrUrls: string[]): Promise<BatchTranscriptResult> {
  if (!SUPADATA_API_KEY) {
    console.error('[transcript] SUPADATA_API_KEY not set - cannot batch fetch');
    return {
      transcripts: new Map(),
      succeeded: 0,
      failed: videoIdsOrUrls.length
    };
  }

  // Extract video IDs from URLs
  const videoIds = videoIdsOrUrls
    .map(v => extractVideoId(v) || v)
    .filter(id => id && id.length === 11);

  if (videoIds.length === 0) {
    console.log('[transcript] No valid video IDs for batch fetch');
    return {
      transcripts: new Map(),
      succeeded: 0,
      failed: videoIdsOrUrls.length
    };
  }

  console.log(`[transcript] Starting batch fetch for ${videoIds.length} videos...`);

  try {
    // Step 1: Create batch job
    const createResponse = await fetch(
      'https://api.supadata.ai/v1/youtube/transcript/batch',
      {
        method: 'POST',
        headers: {
          'x-api-key': SUPADATA_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoIds: videoIds,
          text: true
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[transcript] Batch create failed: ${createResponse.status} - ${errorText}`);
      return {
        transcripts: new Map(),
        succeeded: 0,
        failed: videoIds.length
      };
    }

    const createData = await createResponse.json();
    const jobId = createData.jobId;

    if (!jobId) {
      console.error('[transcript] No jobId in batch response');
      return {
        transcripts: new Map(),
        succeeded: 0,
        failed: videoIds.length
      };
    }

    console.log(`[transcript] Batch job created: ${jobId}`);

    // Step 2: Poll for completion
    const maxAttempts = 60; // 60 * 2s = 120 seconds max
    let attempts = 0;
    let jobStatus = 'pending';
    let jobResults: any = null;

    while (jobStatus !== 'completed' && jobStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      attempts++;

      const statusResponse = await fetch(
        `https://api.supadata.ai/v1/youtube/batch/${jobId}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': SUPADATA_API_KEY,
          },
        }
      );

      if (!statusResponse.ok) {
        console.error(`[transcript] Batch status check failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      jobStatus = statusData.status;
      jobResults = statusData;

      console.log(`[transcript] Batch status: ${jobStatus} (attempt ${attempts}/${maxAttempts})`);
    }

    if (jobStatus !== 'completed') {
      console.error(`[transcript] Batch job did not complete: ${jobStatus}`);
      return {
        transcripts: new Map(),
        succeeded: 0,
        failed: videoIds.length
      };
    }

    // Step 3: Parse results
    const transcripts = new Map<string, TranscriptResult>();
    let succeeded = 0;
    let failed = 0;

    const results = jobResults?.results || [];

    for (const result of results) {
      const videoId = result.videoId || result.id;

      if (!videoId) continue;

      if (result.error || !result.content) {
        failed++;
        transcripts.set(videoId, {
          success: false,
          transcript: null,
          source: 'failed',
          language: null,
          wordCount: 0,
          error: result.error || 'No transcript content'
        });
        continue;
      }

      // Parse the transcript content
      const transcriptText = parseTranscriptData(result.content);

      if (!transcriptText || transcriptText.trim().length < 50) {
        failed++;
        transcripts.set(videoId, {
          success: false,
          transcript: null,
          source: 'failed',
          language: null,
          wordCount: 0,
          error: 'Transcript too short or empty'
        });
        continue;
      }

      const cleanedText = transcriptText.trim().replace(/\s+/g, ' ');
      const wordCount = cleanedText.split(/\s+/).length;
      const isAutoGenerated = result.isAutoGenerated ?? true;

      succeeded++;
      transcripts.set(videoId, {
        success: true,
        transcript: cleanedText,
        source: isAutoGenerated ? 'auto_generated' : 'manual',
        language: result.language || 'en',
        wordCount
      });
    }

    console.log(`[transcript] Batch complete: ${succeeded} succeeded, ${failed} failed`);

    return {
      transcripts,
      succeeded,
      failed
    };

  } catch (error) {
    console.error('[transcript] Batch fetch error:', error);
    return {
      transcripts: new Map(),
      succeeded: 0,
      failed: videoIds.length
    };
  }
}
