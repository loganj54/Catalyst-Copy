// ============================================================================
// SEARCH YOUTUBE ATOMIC FUNCTION
// ============================================================================
// Searches YouTube Data API v3 for educational videos
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import type { SearchYoutubeInput, SearchYoutubeOutput, FunctionError, Resource } from '../_shared/types.ts';

const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
const TIMEOUT_MS = 10000;

/**
 * Main handler - searches YouTube for videos
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: SearchYoutubeInput = await req.json();
    
    if (!input.queries || !Array.isArray(input.queries) || input.queries.length === 0) {
      return errorResponse({
        error: 'Queries array is required and must not be empty',
        code: 'INVALID_INPUT',
        details: { field: 'queries' },
      });
    }

    const maxResults = input.max_results ?? 3;
    if (maxResults < 1 || maxResults > 10) {
      return errorResponse({
        error: 'max_results must be between 1 and 10',
        code: 'INVALID_INPUT',
        details: { field: 'max_results', value: maxResults },
      });
    }

    // Check API key
    if (!YOUTUBE_API_KEY) {
      return errorResponse({
        error: 'YouTube API key not configured',
        code: 'MISSING_API_KEY',
      });
    }

    console.log('[search-youtube] Searching YouTube...');
    console.log('  - Queries:', input.queries);
    console.log('  - Max results:', maxResults);

    const resources: Resource[] = [];
    const seenVideoIds = new Set<string>();
    const queriesUsed: string[] = [];
    let totalApiResults = 0;

    // Search with each query
    for (const query of input.queries) {
      if (resources.length >= maxResults) break;

      try {
        const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
        searchUrl.searchParams.set('part', 'snippet');
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('type', 'video');
        searchUrl.searchParams.set('maxResults', String(Math.min(5, maxResults)));
        searchUrl.searchParams.set('relevanceLanguage', input.filters?.language || 'en');
        searchUrl.searchParams.set('safeSearch', 'strict');
        searchUrl.searchParams.set('videoCategoryId', '27'); // Education category
        
        if (input.filters?.duration) {
          const durationMap = {
            'short': 'short',
            'medium': 'medium',
            'long': 'long',
          };
          searchUrl.searchParams.set('videoDuration', durationMap[input.filters.duration]);
        }
        
        searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

        console.log(`[search-youtube] Searching: "${query}"`);
        queriesUsed.push(query);

        // Call YouTube API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        let response;
        try {
          response = await fetch(searchUrl.toString(), { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errorText = await response.text();
          
          if (response.status === 429) {
            return errorResponse({
              error: 'YouTube API rate limit exceeded',
              code: 'RATE_LIMITED',
            });
          }

          console.error('[search-youtube] API error:', response.status, errorText);
          continue; // Skip this query
        }

        const data = await response.json();

        if (data.items && data.items.length > 0) {
          totalApiResults += data.items.length;

          for (const item of data.items) {
            if (resources.length >= maxResults) break;

            const videoId = item.id?.videoId;
            if (!videoId || seenVideoIds.has(videoId)) continue;

            seenVideoIds.add(videoId);

            const snippet = item.snippet || {};

            resources.push({
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title: snippet.title || 'YouTube Video',
              description: snippet.description?.substring(0, 500) || '',
              platform: 'YouTube',
              channel_name: snippet.channelTitle || null,
              channel_url: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : null,
              thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              duration_seconds: null,
              topic_signature: `Educational video: ${snippet.title}. ${snippet.description?.substring(0, 200) || ''}`,
              concepts_covered: [query],
              difficulty_level: 'intermediate',
              quality_score: 0.8,
              from_cache: false,
              query_used: query,
            });

            console.log(`[search-youtube] Found: ${snippet.title}`);
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error(`[search-youtube] Timeout for query: "${query}"`);
          continue;
        }
        console.error(`[search-youtube] Error with query "${query}":`, error);
        continue;
      }
    }

    console.log('[search-youtube] Search complete');
    console.log('  - Results:', resources.length);
    console.log('  - API results:', totalApiResults);

    const output: SearchYoutubeOutput = {
      resources,
      queries_used: queriesUsed,
      total_found: resources.length,
      metadata: {
        api_quota_used: queriesUsed.length * 100, // Approximate quota cost
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
    console.error('[search-youtube] Error:', error);
    
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
serve(withSelfHealing('search-youtube', handler));

