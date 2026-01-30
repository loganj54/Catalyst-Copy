// ============================================================================
// VIDEO ANALYZER - Deep 4-dimension video analysis
// ============================================================================
// Analyzes video transcripts to score them on 4 dimensions:
// - Beginner-friendliness
// - Visualization quality
// - Math/derivation depth  
// - Real-world applications
// 
// Also integrates YouTube comment analysis for quality signal adjustment.
// ============================================================================

import { getTranscriptWithSupaData, ApifyVideo, extractVideoId } from './youtube-helpers.ts';
import {
    getCommentInsights,
    adjustScoresWithComments,
    CommentData,
    CommentAnalysis
} from './comment-scraper.ts';

const XAI_API_KEY = Deno.env.get('XAI_API_KEY');

// ============================================================================
// TYPES
// ============================================================================

export interface VideoAnalysis {
    // Core content
    summary: string;
    teaching_style: string;  // 'lecture', 'visual', 'worked-example', 'demo'
    visual_elements: string[];
    math_coverage: string[];
    applications: string[];
    key_phrases: string[];

    // 4-Dimension Scores (0.0 to 1.0)
    beginner_score: number;
    visualization_score: number;
    math_explanation_score: number;
    real_world_score: number;
    ai_quality_score: number;
}

export interface AnalyzedVideo extends ApifyVideo {
    videoId: string;
    transcript: string;
    analysis: VideoAnalysis;
    embedding_text: string;
    // Comment data (optional, may be null if scraping failed)
    comments?: CommentData | null;
    comment_analysis?: CommentAnalysis | null;
}

// ============================================================================
// ANALYSIS PROMPT
// ============================================================================

const DEEP_ANALYSIS_PROMPT = `You are an expert educational video analyzer. Analyze this video transcript and score it on multiple dimensions.

Score each dimension from 0.0 to 1.0:

1. beginner_score: How accessible to complete beginners?
   - 0.9-1.0: Assumes NO prior knowledge, explains from absolute basics, defines all terms
   - 0.6-0.8: Some assumed knowledge but mostly accessible
   - 0.3-0.5: Assumes foundational understanding
   - 0.0-0.2: Assumes significant prior knowledge, advanced content

2. visualization_score: How visual is the teaching approach?
   - Look for phrases like: "as you can see", "in this diagram", "the animation shows", "looking at this graph"
   - Consider mentions of: diagrams, graphs, simulations, demonstrations, visual aids
   - 0.9-1.0: Heavily visual, constant references to on-screen visuals
   - 0.6-0.8: Good visual support mentioned
   - 0.3-0.5: Some visuals mentioned
   - 0.0-0.2: Primarily verbal/lecture style, no visual references

3. math_explanation_score: How much mathematical derivation and worked examples?
   - 0.9-1.0: Step-by-step derivations, multiple worked examples with calculations
   - 0.6-0.8: Some equations explained, a worked example
   - 0.3-0.5: Equations mentioned but not derived
   - 0.0-0.2: Conceptual only, no mathematical content

4. real_world_score: How practical and applied is the content?
   - 0.9-1.0: Multiple real engineering examples, industry applications, case studies
   - 0.6-0.8: Some practical examples mentioned
   - 0.3-0.5: Brief mention of applications
   - 0.0-0.2: Purely theoretical, no practical context

5. ai_quality_score: Overall teaching quality
   - Consider: clarity, pacing, depth, accuracy, engagement
   - 0.9-1.0: Exceptional teaching, very clear and well-structured
   - 0.6-0.8: Good quality, clear explanations
   - 0.3-0.5: Adequate but could be clearer
   - 0.0-0.2: Confusing, poorly structured, or inaccurate

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence summary of the video's main content",
  "teaching_style": "lecture" | "visual" | "worked-example" | "demo",
  "visual_elements": ["list", "of", "visual", "elements", "mentioned"],
  "math_coverage": ["equations", "derivations", "methods", "covered"],
  "applications": ["real-world", "applications", "mentioned"],
  "key_phrases": ["specific", "searchable", "technical", "terms", "from", "video"],
  "beginner_score": 0.X,
  "visualization_score": 0.X,
  "math_explanation_score": 0.X,
  "real_world_score": 0.X,
  "ai_quality_score": 0.X
}`;

// ============================================================================
// SINGLE VIDEO ANALYSIS
// ============================================================================

/**
 * Analyze a single video with transcript
 */
async function analyzeVideoWithTranscript(
    video: ApifyVideo,
    transcript: string
): Promise<VideoAnalysis | null> {
    if (!XAI_API_KEY) {
        throw new Error('XAI API key not configured');
    }

    // Truncate transcript if too long (keep ~8000 words for Grok context)
    const truncatedTranscript = transcript.length > 32000
        ? transcript.substring(0, 32000) + '...[truncated]'
        : transcript;

    console.log(`[Analyzer] Analyzing: "${video.title.substring(0, 50)}..."`);

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${XAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'grok-4-1-fast-non-reasoning',
                messages: [
                    { role: 'system', content: DEEP_ANALYSIS_PROMPT },
                    {
                        role: 'user',
                        content: `Video Title: ${video.title}\nDuration: ${video.duration || 'unknown'} seconds\nChannel: ${video.channelName || 'unknown'}\n\nTranscript:\n${truncatedTranscript}`
                    }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Analyzer] Grok API error: ${response.status} - ${errorText}`);
            return null;
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            console.error('[Analyzer] No content in response');
            return null;
        }

        const analysis: VideoAnalysis = JSON.parse(content);

        // Validate scores are in range
        const validateScore = (score: number) => Math.max(0, Math.min(1, score || 0.5));

        analysis.beginner_score = validateScore(analysis.beginner_score);
        analysis.visualization_score = validateScore(analysis.visualization_score);
        analysis.math_explanation_score = validateScore(analysis.math_explanation_score);
        analysis.real_world_score = validateScore(analysis.real_world_score);
        analysis.ai_quality_score = validateScore(analysis.ai_quality_score);

        console.log(`[Analyzer] Scores: B=${analysis.beginner_score.toFixed(2)} V=${analysis.visualization_score.toFixed(2)} M=${analysis.math_explanation_score.toFixed(2)} R=${analysis.real_world_score.toFixed(2)}`);

        return analysis;

    } catch (error) {
        console.error(`[Analyzer] Analysis failed for "${video.title}":`, error);
        return null;
    }
}

/**
 * Generate embedding text from video and analysis
 * 
 * This creates a rich, descriptive text that explicitly describes all quality
 * dimensions so semantic search can match videos to user intent.
 */
function generateEmbeddingText(video: ApifyVideo, analysis: VideoAnalysis): string {
    // Helper to describe score levels
    const describeScore = (score: number, dimension: string): string => {
        if (score >= 0.9) return `EXCELLENT ${dimension}`;
        if (score >= 0.75) return `STRONG ${dimension}`;
        if (score >= 0.6) return `GOOD ${dimension}`;
        if (score >= 0.4) return `MODERATE ${dimension}`;
        if (score >= 0.2) return `LIMITED ${dimension}`;
        return `MINIMAL ${dimension}`;
    };

    // Build explicit type descriptions
    const beginnerDesc = analysis.beginner_score >= 0.75
        ? 'This is a BEGINNER-FRIENDLY video suitable for complete beginners with no prior knowledge required.'
        : analysis.beginner_score >= 0.5
            ? 'This video is suitable for intermediate learners with some foundational knowledge.'
            : 'This is an ADVANCED video requiring significant prior knowledge.';

    const visualDesc = analysis.visualization_score >= 0.75
        ? 'Features STRONG VISUAL EXPLANATIONS with animations, diagrams, and visual demonstrations throughout.'
        : analysis.visualization_score >= 0.5
            ? 'Includes some visual aids to support explanations.'
            : 'Primarily lecture-based with minimal visual aids.';

    const mathDesc = analysis.math_explanation_score >= 0.75
        ? 'Contains DETAILED MATHEMATICAL DERIVATIONS with step-by-step equation work and calculations.'
        : analysis.math_explanation_score >= 0.5
            ? 'Includes some mathematical explanations and formulas.'
            : 'Light on mathematical detail, focuses on conceptual understanding.';

    const realWorldDesc = analysis.real_world_score >= 0.75
        ? 'Emphasizes REAL-WORLD APPLICATIONS with practical engineering examples and case studies.'
        : analysis.real_world_score >= 0.5
            ? 'Includes some practical applications and examples.'
            : 'Focuses on theoretical concepts rather than applications.';

    // Score summary for explicit matching
    const scoreBlock = `
VIDEO TYPE SCORES:
- Beginner-Friendliness: ${(analysis.beginner_score * 100).toFixed(0)}% - ${describeScore(analysis.beginner_score, 'beginner accessibility')}
- Visual Quality: ${(analysis.visualization_score * 100).toFixed(0)}% - ${describeScore(analysis.visualization_score, 'visual explanations')}
- Math Depth: ${(analysis.math_explanation_score * 100).toFixed(0)}% - ${describeScore(analysis.math_explanation_score, 'mathematical coverage')}
- Real-World Focus: ${(analysis.real_world_score * 100).toFixed(0)}% - ${describeScore(analysis.real_world_score, 'practical applications')}
- Overall Quality: ${(analysis.ai_quality_score * 100).toFixed(0)}%`;

    // Construct the full embedding text
    return `VIDEO TITLE: ${video.title}
CHANNEL: ${video.channelName || 'Unknown'}

SUMMARY: ${analysis.summary}

${beginnerDesc}
${visualDesc}
${mathDesc}
${realWorldDesc}

TEACHING STYLE: ${analysis.teaching_style}

${analysis.visual_elements.length > 0 ? `VISUAL ELEMENTS PRESENT: ${analysis.visual_elements.join(', ')}` : ''}
${analysis.math_coverage.length > 0 ? `MATHEMATICAL CONTENT: ${analysis.math_coverage.join(', ')}` : ''}
${analysis.applications.length > 0 ? `REAL-WORLD APPLICATIONS: ${analysis.applications.join(', ')}` : ''}

KEY TOPICS: ${analysis.key_phrases.slice(0, 10).join(', ')}
${scoreBlock}`;
}

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

/**
 * Analyze multiple videos in batches (with optional comment analysis)
 */
export async function analyzeVideosBatch(
    videos: ApifyVideo[],
    batchSize: number = 5,
    delayMs: number = 500,
    includeComments: boolean = true // Re-enabled after fixing input format
): Promise<AnalyzedVideo[]> {
    console.log(`[Analyzer] Starting batch analysis of ${videos.length} videos (batch size: ${batchSize})`);
    console.log(`[Analyzer] Comment analysis: ${includeComments ? 'ENABLED' : 'disabled'}`);

    const results: AnalyzedVideo[] = [];
    const failed: string[] = [];

    // Process in batches
    for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize);
        console.log(`[Analyzer] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(videos.length / batchSize)} (${batch.length} videos)`);

        // Process batch in parallel
        const batchPromises = batch.map(async (video) => {
            const videoId = extractVideoId(video.url);
            if (!videoId) {
                console.warn(`[Analyzer] Invalid URL: ${video.url}`);
                return null;
            }

            try {
                // Step 1: Get transcript
                const transcript = await getTranscriptWithSupaData(video.url);
                if (!transcript || transcript.length < 100) {
                    console.warn(`[Analyzer] No/short transcript for: ${video.title}`);
                    failed.push(video.title);
                    return null;
                }

                // Step 2: Analyze transcript (get initial scores)
                let analysis = await analyzeVideoWithTranscript(video, transcript);
                if (!analysis) {
                    failed.push(video.title);
                    return null;
                }

                // Step 3: Scrape and analyze comments (if enabled)
                let comments: CommentData | null = null;
                let commentAnalysis: CommentAnalysis | null = null;

                if (includeComments) {
                    console.log(`[Analyzer] Fetching comments for: ${video.title.substring(0, 30)}...`);

                    try {
                        const commentInsights = await getCommentInsights(video.url);
                        comments = commentInsights.comments;
                        commentAnalysis = commentInsights.analysis;

                        // Step 4: Adjust scores based on comment signals
                        if (commentAnalysis) {
                            const adjustedScores = adjustScoresWithComments(
                                {
                                    beginner_score: analysis.beginner_score,
                                    visualization_score: analysis.visualization_score,
                                    math_explanation_score: analysis.math_explanation_score,
                                    real_world_score: analysis.real_world_score,
                                    ai_quality_score: analysis.ai_quality_score
                                },
                                commentAnalysis
                            );

                            // Update analysis with adjusted scores
                            analysis = {
                                ...analysis,
                                beginner_score: adjustedScores.beginner_score,
                                visualization_score: adjustedScores.visualization_score,
                                math_explanation_score: adjustedScores.math_explanation_score,
                                real_world_score: adjustedScores.real_world_score,
                                ai_quality_score: adjustedScores.ai_quality_score
                            };

                            console.log(`[Analyzer] Scores adjusted with comment signals for: ${video.title.substring(0, 30)}...`);
                        }
                    } catch (commentError) {
                        console.warn(`[Analyzer] Comment analysis failed (continuing without): ${commentError}`);
                        // Continue without comments - transcript analysis is still valid
                    }
                }

                // Step 5: Generate embedding text (after score adjustment)
                const embedding_text = generateEmbeddingText(video, analysis);

                const result: AnalyzedVideo = {
                    ...video,
                    videoId,
                    transcript,
                    analysis,
                    embedding_text,
                    comments,
                    comment_analysis: commentAnalysis
                };

                return result;

            } catch (error) {
                console.error(`[Analyzer] Failed to process "${video.title}":`, error);
                failed.push(video.title);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);

        // Filter out nulls and add to results
        for (const result of batchResults) {
            if (result) {
                results.push(result);
            }
        }

        console.log(`[Analyzer] Batch complete: ${results.length} successful, ${failed.length} failed`);

        // Delay between batches to avoid rate limits
        if (i + batchSize < videos.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log(`[Analyzer] Analysis complete: ${results.length}/${videos.length} videos analyzed`);
    if (failed.length > 0) {
        console.log(`[Analyzer] Failed videos: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '...' : ''}`);
    }

    return results;
}

// ============================================================================
// BEST MATCH SELECTION
// ============================================================================

/**
 * Find the best video match for a given video type
 * 
 * Applies a hard filter: only videos with type score >= 0.75 are considered.
 * If no videos meet the threshold, returns the highest-scoring video anyway.
 */
export function findBestMatch(
    videos: AnalyzedVideo[],
    videoType: string,
    minTypeScore: number = 0.75
): AnalyzedVideo | null {
    if (videos.length === 0) return null;

    // Score field mapping
    const scoreField: Record<string, keyof VideoAnalysis> = {
        'beginner-overview': 'beginner_score',
        'visualization': 'visualization_score',
        'math-explanation': 'math_explanation_score',
        'real-world': 'real_world_score'
    };

    const targetField = scoreField[videoType] || 'ai_quality_score';

    // Hard filter: only consider videos with type score >= threshold
    const qualifiedVideos = videos.filter(v => {
        const score = (v.analysis[targetField] as number) || 0;
        return score >= minTypeScore;
    });

    console.log(`[Analyzer] ${qualifiedVideos.length}/${videos.length} videos meet ${videoType} threshold (>= ${minTypeScore})`);

    // Use qualified videos if any, otherwise fall back to all
    const candidates = qualifiedVideos.length > 0 ? qualifiedVideos : videos;

    // Sort by target score (descending), then by quality score
    const sorted = [...candidates].sort((a, b) => {
        const aScore = (a.analysis[targetField] as number) || 0;
        const bScore = (b.analysis[targetField] as number) || 0;

        if (aScore !== bScore) return bScore - aScore;

        // Tiebreaker: overall quality
        return (b.analysis.ai_quality_score || 0) - (a.analysis.ai_quality_score || 0);
    });

    const best = sorted[0];
    const bestScore = (best.analysis[targetField] as number);
    console.log(`[Analyzer] Best match for "${videoType}": "${best.title}" (score: ${bestScore.toFixed(2)}${qualifiedVideos.length === 0 ? ' - BELOW THRESHOLD, fallback' : ''})`);

    return best;
}
