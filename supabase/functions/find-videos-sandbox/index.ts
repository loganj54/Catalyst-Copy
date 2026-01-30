// ============================================================================
// FIND-VIDEOS-SANDBOX
// ============================================================================
// Isolated test environment for the enhanced video discovery system.
// 
// Flow:
// 1. Check Pinecone for existing matches
// 2. If no good match, trigger full YouTube search pipeline
// 3. Analyze all found videos (deep 4-dimension scoring)
// 4. Store all in Supabase and Pinecone
// 5. Return best match for requested video type
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { smartSearch, SearchContext } from '../_shared/smart-search.ts';
import { analyzeVideosBatch, findBestMatch, AnalyzedVideo } from '../_shared/video-analyzer.ts';
import {
    searchVideosByEmbedding,
    buildVideoQueryText,
    storeAnalyzedVideos,
    getVideoFromSupabase,
    PINECONE_NAMESPACE
} from '../_shared/video-storage.ts';

// ============================================================================
// TYPES
// ============================================================================

interface FindVideosSandboxRequest {
    term: string;                    // The selected term (e.g., "Reynolds number")
    unit_topic?: string;             // Learning context
    problem_text?: string;           // The problem being worked on
    video_type: string;              // Selected video type
    min_similarity?: number;         // Minimum similarity score for cache hit (default 0.5)
    force_refresh?: boolean;         // Skip cache and force new search
}

interface FindVideosSandboxResponse {
    success: boolean;
    video?: {
        video_id: string;
        url: string;
        title: string;
        channel_name: string;
        thumbnail_url: string;
        duration: string;
        summary: string;
        scores: {
            beginner: number;
            visualization: number;
            math_explanation: number;
            real_world: number;
            quality: number;
        };
    };
    source: 'cache' | 'fresh_search';
    stats?: {
        videos_searched: number;
        videos_analyzed: number;
        videos_stored: number;
    };
    debug?: {
        embedding_query_text: string;
        resource_info: string;
        user_query: string;
    };
    error?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    console.log('='.repeat(80));
    console.log('[find-videos-sandbox] Request received');
    console.log('='.repeat(80));

    try {
        // Parse request
        const body: FindVideosSandboxRequest = await req.json();
        const {
            term,
            unit_topic,
            problem_text,
            video_type,
            min_similarity = 0.5,
            force_refresh = false
        } = body;

        console.log(`[Sandbox] Term: "${term}"`);
        console.log(`[Sandbox] Video type: ${video_type}`);
        console.log(`[Sandbox] Context: ${unit_topic || 'none'}`);
        console.log(`[Sandbox] Force refresh: ${force_refresh}`);

        // Validate required fields
        if (!term || !video_type) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required fields: term and video_type'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create Supabase client
        const supabase = createSupabaseClient();

        // ========================================================================
        // STEP 1: Check Pinecone cache (unless force_refresh)
        // ========================================================================

        if (!force_refresh) {
            console.log('[Sandbox] Checking Pinecone cache...');

            const queryText = buildVideoQueryText(term, unit_topic, video_type, problem_text);

            try {
                const cacheResults = await searchVideosByEmbedding(
                    queryText,
                    video_type,
                    5, // top 5 results
                    0.75 // hard filter: only videos with type score >= 0.75
                );

                if (cacheResults.length > 0 && cacheResults[0].score >= min_similarity) {
                    const topMatch = cacheResults[0];
                    console.log(`[Sandbox] Cache HIT! Score: ${topMatch.score.toFixed(3)}`);

                    // Get full video details from Supabase
                    const fullVideo = await getVideoFromSupabase(supabase, topMatch.id);

                    if (fullVideo) {
                        const response: FindVideosSandboxResponse = {
                            success: true,
                            source: 'cache',
                            video: {
                                video_id: fullVideo.video_id,
                                url: fullVideo.url,
                                title: fullVideo.title,
                                channel_name: fullVideo.channel_name || '',
                                thumbnail_url: fullVideo.thumbnail_url || '',
                                duration: fullVideo.duration || '',
                                summary: fullVideo.summary || '',
                                scores: {
                                    beginner: fullVideo.beginner_score,
                                    visualization: fullVideo.visualization_score,
                                    math_explanation: fullVideo.math_explanation_score,
                                    real_world: fullVideo.real_world_score,
                                    quality: fullVideo.ai_quality_score
                                }
                            },
                            debug: {
                                embedding_query_text: queryText,
                                resource_info: `Video: "${fullVideo.title}" by ${fullVideo.channel_name || 'Unknown'}. Scores - Beginner: ${fullVideo.beginner_score.toFixed(2)}, Visualization: ${fullVideo.visualization_score.toFixed(2)}, Math: ${fullVideo.math_explanation_score.toFixed(2)}, Real-world: ${fullVideo.real_world_score.toFixed(2)}`,
                                user_query: `Term: "${term}", Context: "${unit_topic || 'none'}", Video Type: "${video_type}"`
                            }
                        };

                        return new Response(
                            JSON.stringify(response),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }
                } else {
                    console.log(`[Sandbox] Cache MISS (no results or similarity < ${min_similarity})`);
                }
            } catch (error) {
                console.error('[Sandbox] Cache search error (continuing with fresh search):', error);
            }
        }

        // ========================================================================
        // STEP 2: Run full YouTube search pipeline
        // ========================================================================

        console.log('[Sandbox] Starting fresh YouTube search...');

        const searchContext: SearchContext = {
            term,
            unitTopic: unit_topic,
            problemText: problem_text,
            videoType: video_type
        };

        const searchResult = await smartSearch(searchContext);
        console.log(`[Sandbox] Found ${searchResult.videos.length} videos from YouTube`);

        if (searchResult.videos.length === 0) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No videos found on YouTube for this query'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ========================================================================
        // STEP 3: Analyze all videos (deep 4-dimension scoring)
        // ========================================================================

        console.log('[Sandbox] Analyzing all videos (this may take a while)...');

        const analyzedVideos = await analyzeVideosBatch(
            searchResult.videos,
            5,    // batch size
            1000, // delay between batches
            false // disable comment scraping (too expensive)
        );

        console.log(`[Sandbox] Successfully analyzed ${analyzedVideos.length} videos`);

        if (analyzedVideos.length === 0) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Failed to analyze any videos (transcripts may be unavailable)'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ========================================================================
        // STEP 4: Store all videos in Supabase and Pinecone
        // ========================================================================

        console.log('[Sandbox] Storing all analyzed videos...');

        const { supabaseCount, pineconeCount } = await storeAnalyzedVideos(
            supabase,
            analyzedVideos
        );

        // ========================================================================
        // STEP 5: Find and return best match
        // ========================================================================

        console.log('[Sandbox] Finding best match for video type...');

        const bestMatch = findBestMatch(analyzedVideos, video_type);

        if (!bestMatch) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No suitable video found for the selected type'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Build response
        const queryText = buildVideoQueryText(term, unit_topic, video_type, problem_text);
        const response: FindVideosSandboxResponse = {
            success: true,
            source: 'fresh_search',
            video: {
                video_id: bestMatch.videoId,
                url: bestMatch.url,
                title: bestMatch.title,
                channel_name: bestMatch.channelName || '',
                thumbnail_url: bestMatch.thumbnailUrl || '',
                duration: String(bestMatch.duration || ''),
                summary: bestMatch.analysis.summary,
                scores: {
                    beginner: bestMatch.analysis.beginner_score,
                    visualization: bestMatch.analysis.visualization_score,
                    math_explanation: bestMatch.analysis.math_explanation_score,
                    real_world: bestMatch.analysis.real_world_score,
                    quality: bestMatch.analysis.ai_quality_score
                }
            },
            stats: {
                videos_searched: searchResult.totalFound,
                videos_analyzed: analyzedVideos.length,
                videos_stored: supabaseCount
            },
            debug: {
                embedding_query_text: queryText,
                resource_info: `Video: "${bestMatch.title}" by ${bestMatch.channelName || 'Unknown'}. Scores - Beginner: ${bestMatch.analysis.beginner_score.toFixed(2)}, Visualization: ${bestMatch.analysis.visualization_score.toFixed(2)}, Math: ${bestMatch.analysis.math_explanation_score.toFixed(2)}, Real-world: ${bestMatch.analysis.real_world_score.toFixed(2)}`,
                user_query: `Term: "${term}", Context: "${unit_topic || 'none'}", Video Type: "${video_type}"`
            }
        };

        console.log('[Sandbox] Complete!');
        console.log(`  - Best video: "${bestMatch.title.substring(0, 50)}..."`);
        console.log(`  - Type score: ${bestMatch.analysis[video_type.replace('-', '_') + '_score' as keyof typeof bestMatch.analysis] || 'N/A'}`);

        return new Response(
            JSON.stringify(response),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[Sandbox] Fatal error:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
