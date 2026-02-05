// ============================================================================
// FIND-VIDEOS-SANDBOX (v2 - AI-Powered Video Search)
// ============================================================================
// Enhanced video discovery with target resource profiles.
// 
// Flow:
// 1. Generate target resource profile based on selected query (Claude Haiku 4.5)
// 2. Check Pinecone for existing matches using profile
// 3. If cache hits found, use Grok to rank by profile fulfillment
// 4. If no good match, trigger full YouTube search pipeline
// 5. Return ranked video list (for reroll feature)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, callClaude } from '../_shared/supabase-client.ts';
import { searchYouTubeWithApify, extractVideoId } from '../_shared/youtube-helpers.ts';
import { analyzeVideosBatch, findBestMatch, AnalyzedVideo } from '../_shared/video-analyzer.ts';
import {
    searchVideosByEmbedding,
    buildVideoQueryText,
    storeAnalyzedVideos,
    getVideoFromSupabase,
    PINECONE_NAMESPACE
} from '../_shared/video-storage.ts';

const XAI_API_KEY = Deno.env.get('XAI_API_KEY');

// ============================================================================
// TYPES
// ============================================================================

interface FindVideosSandboxRequest {
    term: string;                    // The selected term (e.g., "Reynolds number")
    selected_query: string;          // The query user selected from 5 options
    unit_topic?: string;             // Learning context
    problem_text?: string;           // The problem/solution context
    blueprint_id?: string;           // For saving rankings to DB
    min_similarity?: number;         // Minimum similarity score for cache hit (default 0.65)
    force_refresh?: boolean;         // Skip cache and force new search
}

interface RankedVideo {
    rank: number;
    video_id: string;
    url: string;
    title: string;
    channel_name: string;
    thumbnail_url: string;
    duration_seconds: number;
    summary: string;
    description?: string;
    average_rating?: number;
    rating_count?: number;
    similarity_score?: number;
    profile_match_score?: number;
}

interface FindVideosSandboxResponse {
    success: boolean;
    video?: RankedVideo;              // Best match (for immediate display)
    ranked_videos?: RankedVideo[];    // Full ranked list (for reroll)
    target_resource_profile?: string; // The generated profile
    source: 'cache' | 'fresh_search';
    stats?: {
        videos_searched: number;
        videos_analyzed: number;
        videos_stored: number;
        cache_hits: number;
    };
    debug?: {
        target_resource_profile: string;
        search_method: string;
    };
    error?: string;
}

// ============================================================================
// TARGET RESOURCE PROFILE GENERATION
// ============================================================================

async function generateTargetResourceProfile(
    term: string,
    selectedQuery: string,
    context: string | undefined,
    problemText: string | undefined
): Promise<string> {
    console.log('[Sandbox] Generating target resource profile...');

    const systemPrompt = `You are an expert educational content curator. Your job is to describe the IDEAL tutorial video that would help a student understand a specific concept.

Think about:
- What teaching approach would work best for this specific question?
- What visual elements would help understanding?
- What connections should be made to related concepts?
- What level of mathematical depth is appropriate?`;

    let userPrompt: string;

    if (problemText) {
        userPrompt = `A student is working through this problem/solution:

${problemText.substring(0, 3000)}${problemText.length > 3000 ? '...' : ''}

They selected this search query: "${selectedQuery}"
The term they're confused about: "${term}"
${context ? `Topic area: ${context}` : ''}

Generate a TARGET RESOURCE PROFILE describing the perfect tutorial video.

Format your response EXACTLY like this (keep it concise, 3-7 unique points):

"The student wishes to answer: '${selectedQuery}'. The perfect video should: 1. [specific requirement based on the problem context] 2. [another requirement] 3. [etc]"

IMPORTANT:
- Base requirements on HOW "${term}" actually appears in this problem
- Don't force connections that don't exist (e.g., if they just need to know "what is diameter", don't force heat transfer connections unless relevant)
- Be specific and actionable for matching videos`;
    } else {
        userPrompt = `A student searched for: "${selectedQuery}"
The term: "${term}"
${context ? `Topic area: ${context}` : ''}

Generate a TARGET RESOURCE PROFILE describing the perfect tutorial video.

Format your response EXACTLY like this:

"The student wishes to answer: '${selectedQuery}'. The perfect video should: 1. [specific requirement] 2. [another requirement] 3. [etc]"`;
    }

    try {
        const result = await callClaude(systemPrompt, userPrompt, {
            temperature: 0.3,
            maxTokens: 500
        });

        const profile = result.content.trim();
        console.log(`[Sandbox] Generated profile (${profile.length} chars)`);
        return profile;
    } catch (error) {
        console.error('[Sandbox] Failed to generate profile:', error);
        // Fallback profile
        return `The student wishes to answer: "${selectedQuery}". The perfect video should: 1. Clearly explain ${term} 2. Use visual aids 3. Provide examples`;
    }
}

// ============================================================================
// GROK RANKING (for cache hits)
// ============================================================================

async function rankVideosByProfileWithGrok(
    videos: Array<{ video_id: string; title: string; transcript: string; summary?: string }>,
    targetProfile: string
): Promise<Array<{ video_id: string; rank: number; score: number }>> {
    console.log(`[Sandbox] Ranking ${videos.length} videos with Grok...`);

    if (!XAI_API_KEY) {
        console.warn('[Sandbox] XAI_API_KEY not set, using fallback ranking');
        return videos.map((v, i) => ({ video_id: v.video_id, rank: i + 1, score: 1 - (i * 0.1) }));
    }

    const systemPrompt = `You are an expert at matching educational videos to student needs. Your job is CRITICAL - rank these videos by how well they fulfill the target resource profile.`;

    // Build compact video summaries for ranking
    const videoSummaries = videos.slice(0, 15).map((v, i) =>
        `VIDEO ${i + 1} (ID: ${v.video_id}):\nTitle: ${v.title}\n${v.summary ? `Summary: ${v.summary}` : `Transcript excerpt: ${v.transcript.substring(0, 500)}...`}`
    ).join('\n\n---\n\n');

    const userPrompt = `TARGET RESOURCE PROFILE:
${targetProfile}

VIDEOS TO RANK:
${videoSummaries}

Rank these videos from BEST to WORST match for the target profile.
Your ranking is CRITICAL for the student's learning experience.

Return ONLY a JSON array of objects with video_id and score (0-1):
[{"video_id": "xxx", "score": 0.95}, {"video_id": "yyy", "score": 0.82}, ...]`;

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${XAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'grok-3-fast-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2,
                max_tokens: 1000
            }),
        });

        if (!response.ok) {
            throw new Error(`Grok API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        let cleanedContent = content.trim();
        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const rankings = JSON.parse(cleanedContent);
        return rankings.map((r: any, i: number) => ({
            video_id: r.video_id,
            rank: i + 1,
            score: r.score || (1 - i * 0.05)
        }));
    } catch (error) {
        console.error('[Sandbox] Grok ranking failed:', error);
        // Fallback: return in original order
        return videos.map((v, i) => ({ video_id: v.video_id, rank: i + 1, score: 1 - (i * 0.1) }));
    }
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
    console.log('[find-videos-sandbox] Request received (v2 - AI-Powered)');
    console.log('='.repeat(80));

    try {
        // Parse request
        const body: FindVideosSandboxRequest = await req.json();
        const {
            term,
            selected_query,
            unit_topic,
            problem_text,
            blueprint_id,
            min_similarity = 0.65,
            force_refresh = false
        } = body;

        // Use selected_query if provided, otherwise generate a default
        const searchQuery = selected_query || `What is ${term}?`;

        console.log(`[Sandbox] Term: "${term}"`);
        console.log(`[Sandbox] Selected query: "${searchQuery}"`);
        console.log(`[Sandbox] Context: ${unit_topic || 'none'}`);
        console.log(`[Sandbox] Blueprint ID: ${blueprint_id || 'none'}`);
        console.log(`[Sandbox] Force refresh: ${force_refresh}`);

        // Validate required fields
        if (!term) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required field: term'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create Supabase client
        const supabase = createSupabaseClient();

        // ========================================================================
        // STEP 1: Generate Target Resource Profile
        // ========================================================================

        console.log('='.repeat(80));
        console.log('[Sandbox] STEP 1: GENERATE TARGET RESOURCE PROFILE');
        console.log('='.repeat(80));

        const targetResourceProfile = await generateTargetResourceProfile(
            term,
            searchQuery,
            unit_topic,
            problem_text
        );

        console.log(`[Sandbox] Profile: ${targetResourceProfile.substring(0, 200)}...`);

        // ========================================================================
        // STEP 2: Check Pinecone cache using profile
        // ========================================================================

        let rankedVideos: RankedVideo[] = [];
        let source: 'cache' | 'fresh_search' = 'fresh_search';
        let cacheHits = 0;

        if (!force_refresh) {
            console.log('='.repeat(80));
            console.log('[Sandbox] STEP 2: CACHE LOOKUP');
            console.log('='.repeat(80));

            try {
                // Use target profile as query text for semantic search
                const cacheResults = await searchVideosByEmbedding(
                    targetResourceProfile,
                    15 // top 15 results
                );

                console.log(`[Sandbox] Cache search returned ${cacheResults.length} results`);

                // Filter by minimum similarity
                const validResults = cacheResults.filter(r => r.score >= min_similarity);
                console.log(`[Sandbox] ${validResults.length} results above ${min_similarity} threshold`);

                if (validResults.length > 0) {
                    cacheHits = validResults.length;
                    console.log('[Sandbox] ✓ CACHE HIT! Fetching video details...');

                    // Fetch full video details from Supabase
                    const videoDetails = await Promise.all(
                        validResults.slice(0, 15).map(async (result) => {
                            const video = await getVideoFromSupabase(supabase, result.id);
                            return video ? { ...video, similarity_score: result.score } : null;
                        })
                    );

                    const validVideos = videoDetails.filter(v => v !== null);
                    console.log(`[Sandbox] Retrieved ${validVideos.length} video details`);

                    if (validVideos.length > 0) {
                        // Rank videos using Grok
                        const videosForRanking = validVideos.map(v => ({
                            video_id: v!.video_id,
                            title: v!.title,
                            transcript: '', // We'll use summary instead
                            summary: v!.summary
                        }));

                        const rankings = await rankVideosByProfileWithGrok(videosForRanking, targetResourceProfile);
                        console.log(`[Sandbox] Grok ranked ${rankings.length} videos`);

                        // Map rankings back to full video data
                        rankedVideos = rankings.slice(0, 5).map(r => {
                            const video = validVideos.find(v => v!.video_id === r.video_id)!;
                            return {
                                rank: r.rank,
                                video_id: video.video_id,
                                url: video.url,
                                title: video.title,
                                channel_name: video.channel_name || '',
                                thumbnail_url: video.thumbnail_url || '',
                                duration_seconds: parseInt(video.duration) || 0,
                                summary: video.summary || '',
                                description: video.description || '',
                                average_rating: video.average_rating || 0,
                                rating_count: video.rating_count || 0,
                                similarity_score: (video as any).similarity_score,
                                profile_match_score: r.score
                            };
                        });

                        source = 'cache';
                        console.log(`[Sandbox] Returning ${rankedVideos.length} cached videos`);
                    }
                } else {
                    console.log('[Sandbox] Cache MISS - no videos above similarity threshold');
                }
            } catch (error) {
                console.error('[Sandbox] Cache search error (continuing with fresh search):', error);
            }
        } else {
            console.log('[Sandbox] force_refresh=true, skipping cache lookup');
        }

        // ========================================================================
        // STEP 3: Fresh YouTube search (if cache miss)
        // ========================================================================

        if (rankedVideos.length === 0) {
            console.log('='.repeat(80));
            console.log('[Sandbox] STEP 3: FRESH YOUTUBE SEARCH');
            console.log('='.repeat(80));

            // Use ONLY the user's selected query - no multi-query generation
            console.log(`[Sandbox] Searching YouTube with single query: "${searchQuery}"`);
            const youtubeVideos = await searchYouTubeWithApify(searchQuery);

            // Filter videos by duration (2-45 min)
            const filteredVideos = youtubeVideos.filter(video => {
                if (video.duration && video.duration < 120) return false;  // Too short
                if (video.duration && video.duration > 2700) return false; // Too long (45 min)
                return true;
            });

            console.log(`[Sandbox] Found ${filteredVideos.length} videos from YouTube (filtered from ${youtubeVideos.length})`);

            if (filteredVideos.length === 0) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'No videos found on YouTube for this query',
                        target_resource_profile: targetResourceProfile
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Analyze videos
            console.log('[Sandbox] Analyzing videos...');
            const analyzedVideos = await analyzeVideosBatch(
                filteredVideos,
                5,
                1000,
                false
            );

            console.log(`[Sandbox] Analyzed ${analyzedVideos.length} videos`);

            if (analyzedVideos.length === 0) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Failed to analyze any videos',
                        target_resource_profile: targetResourceProfile
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Store videos
            console.log('[Sandbox] Storing videos...');
            await storeAnalyzedVideos(supabase, analyzedVideos);

            // Rank using Grok
            const videosForRanking = analyzedVideos.map(v => ({
                video_id: v.videoId,
                title: v.title,
                transcript: v.transcript.substring(0, 1000),
                summary: v.analysis.summary
            }));

            const rankings = await rankVideosByProfileWithGrok(videosForRanking, targetResourceProfile);

            // Build ranked videos
            rankedVideos = rankings.slice(0, 5).map(r => {
                const video = analyzedVideos.find(v => v.videoId === r.video_id)!;
                return {
                    rank: r.rank,
                    video_id: video.videoId,
                    url: video.url,
                    title: video.title,
                    channel_name: video.channelName || '',
                    thumbnail_url: video.thumbnailUrl || '',
                    duration_seconds: video.duration || 0,
                    summary: video.analysis.summary,
                    description: video.description || '',
                    average_rating: 0,
                    rating_count: 0,
                    profile_match_score: r.score
                };
            });

            source = 'fresh_search';
        }

        // ========================================================================
        // STEP 4: Save rankings to database (if blueprint_id provided)
        // ========================================================================

        if (blueprint_id && rankedVideos.length > 0) {
            console.log('[Sandbox] Saving rankings to database...');
            try {
                await supabase.from('blueprint_video_rankings').upsert({
                    blueprint_id,
                    term,
                    search_query: searchQuery,
                    target_resource_profile: targetResourceProfile,
                    ranked_videos: rankedVideos,
                    selected_rank: 1
                }, {
                    onConflict: 'blueprint_id,term,search_query'
                });
                console.log('[Sandbox] Rankings saved successfully');
            } catch (error) {
                console.error('[Sandbox] Failed to save rankings:', error);
            }
        }

        // ========================================================================
        // STEP 5: Return response
        // ========================================================================

        const response: FindVideosSandboxResponse = {
            success: true,
            video: rankedVideos[0] || undefined,
            ranked_videos: rankedVideos,
            target_resource_profile: targetResourceProfile,
            source,
            stats: {
                videos_searched: rankedVideos.length,
                videos_analyzed: rankedVideos.length,
                videos_stored: rankedVideos.length,
                cache_hits: cacheHits
            },
            debug: {
                target_resource_profile: targetResourceProfile,
                search_method: source
            }
        };

        console.log('[Sandbox] Complete!');
        console.log(`  - Source: ${source}`);
        console.log(`  - Ranked videos: ${rankedVideos.length}`);
        if (rankedVideos[0]) {
            console.log(`  - Best match: "${rankedVideos[0].title.substring(0, 50)}..."`);
        }

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
