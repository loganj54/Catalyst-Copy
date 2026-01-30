// ============================================================================
// VIDEO STORAGE - Supabase and Pinecone storage for analyzed videos
// ============================================================================
// Stores analyzed videos in both Supabase (structured data) and 
// Pinecone (vector embeddings for semantic search).
// ============================================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { generateEmbedding } from './embeddings.ts';
import { upsertVectors, queryVectors, PineconeQueryResult } from './pinecone-client.ts';
import type { AnalyzedVideo, VideoAnalysis } from './video-analyzer.ts';
import { getVideoTypeQueryText } from './smart-search.ts';

// ============================================================================
// CONSTANTS
// ============================================================================

const PINECONE_NAMESPACE = 'video-sandbox';

// ============================================================================
// TYPES
// ============================================================================

export interface StoredVideo {
    id: string;
    video_id: string;
    url: string;
    title: string;
    channel_name: string;
    thumbnail_url: string;
    duration: string;
    beginner_score: number;
    visualization_score: number;
    math_explanation_score: number;
    real_world_score: number;
    ai_quality_score: number;
    summary: string;
}

export interface VideoSearchResult {
    video: StoredVideo;
    similarity_score: number;
    type_score: number;
}

// ============================================================================
// SUPABASE STORAGE
// ============================================================================

/**
 * Store a single analyzed video in Supabase
 */
export async function storeVideoInSupabase(
    supabase: SupabaseClient,
    video: AnalyzedVideo
): Promise<string | null> {
    console.log(`[Storage] Storing video in Supabase: "${video.title.substring(0, 40)}..."`);

    // Build storage object
    const storageData: Record<string, any> = {
        video_id: video.videoId,
        url: video.url,
        title: video.title,
        channel_name: video.channelName || null,
        channel_url: video.channelUrl || null,
        thumbnail_url: video.thumbnailUrl || null,
        duration: video.duration || null,
        transcript: video.transcript,
        summary: video.analysis.summary,
        teaching_style: video.analysis.teaching_style,
        visual_elements: video.analysis.visual_elements,
        math_coverage: video.analysis.math_coverage,
        applications: video.analysis.applications,
        beginner_score: video.analysis.beginner_score,
        visualization_score: video.analysis.visualization_score,
        math_explanation_score: video.analysis.math_explanation_score,
        real_world_score: video.analysis.real_world_score,
        ai_quality_score: video.analysis.ai_quality_score,
        embedding_text: video.embedding_text,
        updated_at: new Date().toISOString()
    };

    // Add comment data if available
    if (video.comments) {
        storageData.comments_json = JSON.stringify(video.comments);
    }
    if (video.comment_analysis) {
        storageData.comment_analysis_json = JSON.stringify(video.comment_analysis);
    }

    const { data, error } = await supabase
        .from('video_sandbox')
        .upsert(storageData, {
            onConflict: 'video_id',
            ignoreDuplicates: false
        })
        .select('id')
        .single();

    if (error) {
        console.error(`[Storage] Supabase error for "${video.title}":`, error);
        return null;
    }

    console.log(`[Storage] Stored in Supabase: ${data.id}`);
    return data.id;
}

/**
 * Store multiple analyzed videos in Supabase
 */
export async function storeVideosInSupabase(
    supabase: SupabaseClient,
    videos: AnalyzedVideo[]
): Promise<number> {
    console.log(`[Storage] Storing ${videos.length} videos in Supabase...`);

    let successCount = 0;

    for (const video of videos) {
        const id = await storeVideoInSupabase(supabase, video);
        if (id) successCount++;
    }

    console.log(`[Storage] Stored ${successCount}/${videos.length} videos in Supabase`);
    return successCount;
}

/**
 * Get a video from Supabase by ID
 */
export async function getVideoFromSupabase(
    supabase: SupabaseClient,
    videoId: string
): Promise<StoredVideo | null> {
    const { data, error } = await supabase
        .from('video_sandbox')
        .select('*')
        .eq('video_id', videoId)
        .single();

    if (error) {
        console.error('[Storage] Get video error:', error);
        return null;
    }

    return data as StoredVideo;
}

// ============================================================================
// PINECONE STORAGE
// ============================================================================

/**
 * Store a single video embedding in Pinecone
 */
export async function storeVideoInPinecone(
    video: AnalyzedVideo
): Promise<boolean> {
    console.log(`[Storage] Storing video in Pinecone: "${video.title.substring(0, 40)}..."`);

    try {
        // Generate embedding from the composite text
        const { embedding } = await generateEmbedding(video.embedding_text);

        // Upsert to Pinecone with rich metadata
        await upsertVectors([{
            id: video.videoId,
            values: embedding,
            metadata: {
                title: video.title,
                url: video.url,
                channel_name: video.channelName || '',
                thumbnail_url: video.thumbnailUrl || '',
                duration: video.duration || '',
                summary: video.analysis.summary.substring(0, 500), // Truncate for metadata limits
                teaching_style: video.analysis.teaching_style,
                // Scores for filtering
                beginner_score: video.analysis.beginner_score,
                visualization_score: video.analysis.visualization_score,
                math_explanation_score: video.analysis.math_explanation_score,
                real_world_score: video.analysis.real_world_score,
                ai_quality_score: video.analysis.ai_quality_score
            }
        }], PINECONE_NAMESPACE);

        console.log(`[Storage] Stored in Pinecone: ${video.videoId}`);
        return true;

    } catch (error) {
        console.error(`[Storage] Pinecone error for "${video.title}":`, error);
        return false;
    }
}

/**
 * Store multiple video embeddings in Pinecone (batched)
 */
export async function storeVideosInPinecone(
    videos: AnalyzedVideo[],
    batchSize: number = 10
): Promise<number> {
    console.log(`[Storage] Storing ${videos.length} videos in Pinecone...`);

    let successCount = 0;

    // Process in batches for efficiency
    for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize);
        console.log(`[Storage] Processing Pinecone batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(videos.length / batchSize)}`);

        // Generate embeddings for batch
        const vectorPromises = batch.map(async (video) => {
            try {
                const { embedding } = await generateEmbedding(video.embedding_text);
                return {
                    id: video.videoId,
                    values: embedding,
                    metadata: {
                        title: video.title,
                        url: video.url,
                        channel_name: video.channelName || '',
                        thumbnail_url: video.thumbnailUrl || '',
                        duration: video.duration || '',
                        summary: video.analysis.summary.substring(0, 500),
                        teaching_style: video.analysis.teaching_style,
                        beginner_score: video.analysis.beginner_score,
                        visualization_score: video.analysis.visualization_score,
                        math_explanation_score: video.analysis.math_explanation_score,
                        real_world_score: video.analysis.real_world_score,
                        ai_quality_score: video.analysis.ai_quality_score
                    }
                };
            } catch (error) {
                console.error(`[Storage] Embedding failed for "${video.title}":`, error);
                return null;
            }
        });

        const vectors = (await Promise.all(vectorPromises)).filter(v => v !== null);

        if (vectors.length > 0) {
            try {
                await upsertVectors(vectors as any[], PINECONE_NAMESPACE);
                successCount += vectors.length;
            } catch (error) {
                console.error('[Storage] Batch upsert failed:', error);
            }
        }
    }

    console.log(`[Storage] Stored ${successCount}/${videos.length} videos in Pinecone`);
    return successCount;
}

// ============================================================================
// VECTOR SEARCH
// ============================================================================

/**
 * Search Pinecone for videos matching a query
 */
export async function searchVideosByEmbedding(
    queryText: string,
    videoType: string,
    topK: number = 10,
    minTypeScore: number = 0.75
): Promise<PineconeQueryResult[]> {
    console.log(`[Storage] Searching Pinecone for: "${queryText.substring(0, 50)}..."`);
    console.log(`[Storage] Video type filter: ${videoType} >= ${minTypeScore}`);

    // Generate query embedding
    const { embedding } = await generateEmbedding(queryText);

    // Build metadata filter for video type
    const typeScoreField = videoType.replace('-', '_') + '_score';
    const filter = {
        [typeScoreField]: { $gte: minTypeScore }
    };

    // Query Pinecone
    const results = await queryVectors(
        embedding,
        topK,
        filter,
        PINECONE_NAMESPACE,
        true // include metadata
    );

    console.log(`[Storage] Found ${results.matches?.length || 0} matching videos`);

    return results.matches || [];
}

/**
 * Build query text for video search that matches the structure
 * of stored video embedding text.
 *
 * The key insight: embedding similarity works best when query and document
 * "speak the same language" - use the same vocabulary, structure, and emphasis.
 */
export function buildVideoQueryText(
    term: string,
    context: string | undefined,
    videoType: string,
    problemText?: string
): string {
    // Get the rich query text that matches embedding language
    const queryText = getVideoTypeQueryText(videoType);

    const parts: string[] = [];

    // Section 1: Topic identification (matches "KEY TOPICS" in embedding)
    parts.push(`KEY TOPICS: ${term}`);
    if (context) {
        parts.push(`Learning context: ${context}`);
    }

    // Section 2: What student is looking for
    parts.push(`\nStudent needs help understanding: ${term}.`);
    if (problemText) {
        const truncatedProblem = problemText.length > 300
            ? problemText.substring(0, 300) + '...'
            : problemText;
        parts.push(`Working on: ${truncatedProblem}`);
    }

    // Section 3: Video type requirements (matches embedding type descriptions)
    parts.push(`\nVIDEO TYPE NEEDED:`);
    parts.push(queryText);

    // Section 4: Score expectations (mirrors score block in embeddings)
    const scoreFieldMap: Record<string, string> = {
        'beginner-overview': 'Beginner-Friendliness',
        'visualization': 'Visual Quality',
        'math-explanation': 'Math Depth',
        'real-world': 'Real-World Focus'
    };

    const scoreLabel = scoreFieldMap[videoType] || 'Quality';
    parts.push(`\nSCORE REQUIREMENTS:`);
    parts.push(`- ${scoreLabel}: HIGH (75%+) - STRONG ${scoreLabel.toLowerCase()}`);

    return parts.join('\n');
}

// ============================================================================
// COMBINED STORAGE
// ============================================================================

/**
 * Store analyzed videos in both Supabase and Pinecone
 */
export async function storeAnalyzedVideos(
    supabase: SupabaseClient,
    videos: AnalyzedVideo[]
): Promise<{ supabaseCount: number; pineconeCount: number }> {
    console.log(`[Storage] Storing ${videos.length} videos in both Supabase and Pinecone...`);

    // Store in Supabase first (primary storage)
    const supabaseCount = await storeVideosInSupabase(supabase, videos);

    // Then store in Pinecone (vector search)
    const pineconeCount = await storeVideosInPinecone(videos);

    console.log(`[Storage] Complete: ${supabaseCount} in Supabase, ${pineconeCount} in Pinecone`);

    return { supabaseCount, pineconeCount };
}

export { PINECONE_NAMESPACE };
