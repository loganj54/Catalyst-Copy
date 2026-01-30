// ============================================================================
// COMMENT SCRAPER - YouTube comment fetching and analysis
// ============================================================================
// Scrapes YouTube comments via Apify and analyzes them for quality signals.
// Comments provide valuable insights about video quality that transcripts can't.
// ============================================================================

const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
// Using clappi/youtube-comments-scraper - free tier compatible
const COMMENT_SCRAPER_ACTOR_ID = 'clappi~youtube-comments-scraper';
const XAI_API_KEY = Deno.env.get('XAI_API_KEY');

// ============================================================================
// TYPES
// ============================================================================

export interface YouTubeComment {
    author: string;
    text: string;
    likes: number;
    date: string;
}

export interface CommentData {
    scraped_at: string;
    comment_count: number;
    comments: YouTubeComment[];
}

export interface CommentAnalysis {
    // Quality signals from comments
    visual_quality_signal: number;      // -1 to 1 (negative = complaints, positive = praise)
    teaching_clarity_signal: number;    // -1 to 1
    beginner_friendly_signal: number;   // -1 to 1
    math_depth_signal: number;          // -1 to 1
    overall_sentiment: number;          // -1 to 1

    // Counts
    positive_mentions: number;
    negative_mentions: number;

    // Key themes
    praised_aspects: string[];
    criticized_aspects: string[];

    // Summary
    quality_summary: string;
}

// ============================================================================
// COMMENT SCRAPING
// ============================================================================

/**
 * Scrape YouTube comments using Apify (clappi/youtube-comments-scraper)
 */
export async function scrapeYouTubeComments(
    videoUrl: string,
    maxComments: number = 50
): Promise<CommentData | null> {
    if (!APIFY_API_TOKEN) {
        console.error('[Comments] APIFY_API_TOKEN not configured');
        return null;
    }

    console.log(`[Comments] Scraping comments for: ${videoUrl}`);

    try {
        // Input format for clappi/youtube-comments-scraper
        const inputPayload = {
            videoUrls: [videoUrl],
            maxCommentsPerVideo: maxComments
        };

        // Start the actor run
        const runResponse = await fetch(
            `https://api.apify.com/v2/acts/${COMMENT_SCRAPER_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputPayload),
            }
        );

        if (!runResponse.ok) {
            const errorText = await runResponse.text();
            console.error(`[Comments] Apify run failed: ${runResponse.status} - ${errorText}`);
            return null;
        }

        const runData = await runResponse.json();
        const runId = runData.data.id;
        const defaultDatasetId = runData.data.defaultDatasetId;

        console.log(`[Comments] Run ID: ${runId}, Dataset: ${defaultDatasetId}`);

        // Wait for completion (poll with timeout)
        let attempts = 0;
        const maxAttempts = 60;
        let runStatus = 'RUNNING';

        while (runStatus === 'RUNNING' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const statusResponse = await fetch(
                `https://api.apify.com/v2/acts/${COMMENT_SCRAPER_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`
            );
            const statusData = await statusResponse.json();
            runStatus = statusData.data.status;

            attempts++;
            if (attempts % 5 === 0) {
                console.log(`[Comments] Status: ${runStatus} (${attempts}/${maxAttempts})`);
            }
        }

        if (runStatus !== 'SUCCEEDED') {
            console.error(`[Comments] Run failed with status: ${runStatus}`);
            return null;
        }

        // Fetch results
        const resultsResponse = await fetch(
            `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`
        );

        if (!resultsResponse.ok) {
            console.error(`[Comments] Failed to fetch results: ${resultsResponse.status}`);
            return null;
        }

        const results = await resultsResponse.json();
        console.log(`[Comments] Fetched ${results.length} comment items`);

        // Parse comments from results
        // Actor output format: { text, likeCount (string like "3.4K"), author: { name }, publishedTime }
        const comments: YouTubeComment[] = [];

        // Helper to parse like count strings like "3.4K" or "1.2M"
        const parseLikeCount = (likeStr: string | number | undefined): number => {
            if (typeof likeStr === 'number') return likeStr;
            if (!likeStr) return 0;
            const str = String(likeStr).toLowerCase();
            if (str.includes('k')) return parseFloat(str) * 1000;
            if (str.includes('m')) return parseFloat(str) * 1000000;
            return parseInt(str, 10) || 0;
        };

        for (const item of results) {
            // Handle clappi actor output format:
            // { text, likeCount (string), author: { name }, publishedTimeText }
            if (item.text) {
                comments.push({
                    author: item.author?.name || item.author || 'Unknown',
                    text: item.text,
                    likes: parseLikeCount(item.likeCount),
                    date: item.publishedTimeText || item.publishedTime || ''
                });
            }
        }

        console.log(`[Comments] Parsed ${comments.length} comments`);

        return {
            scraped_at: new Date().toISOString(),
            comment_count: comments.length,
            comments: comments.slice(0, maxComments)
        };

    } catch (error) {
        console.error('[Comments] Scraping error:', error);
        return null;
    }
}

// ============================================================================
// COMMENT ANALYSIS
// ============================================================================

/**
 * Analyze comments to extract quality signals
 */
export async function analyzeComments(
    comments: YouTubeComment[]
): Promise<CommentAnalysis | null> {
    if (!XAI_API_KEY) {
        console.error('[Comments] XAI_API_KEY not configured');
        return null;
    }

    if (comments.length === 0) {
        console.log('[Comments] No comments to analyze');
        return null;
    }

    console.log(`[Comments] Analyzing ${comments.length} comments...`);

    // Prepare comments text (prioritize high-like comments)
    const sortedComments = [...comments].sort((a, b) => b.likes - a.likes);
    const commentTexts = sortedComments
        .slice(0, 30) // Top 30 by likes
        .map((c, i) => `[${c.likes} likes] ${c.text}`)
        .join('\n\n');

    const prompt = `Analyze these YouTube comments from an educational video. Extract signals about video quality.

COMMENTS:
${commentTexts}

Analyze for these quality signals. Score each from -1.0 to 1.0:
- Negative (-1.0 to -0.3): More complaints than praise
- Neutral (-0.3 to 0.3): Mixed or unclear
- Positive (0.3 to 1.0): More praise than complaints

Look for specific mentions of:
1. VISUAL QUALITY: References to animations, diagrams, visuals being good/bad
   - Positive: "great animation", "love the visuals", "helpful diagrams"
   - Negative: "can't see", "bad graphics", "confusing diagram"

2. TEACHING CLARITY: Comments about explanation quality
   - Positive: "finally understand", "so clear", "best explanation"
   - Negative: "still confused", "too fast", "doesn't explain well"

3. BEGINNER FRIENDLY: Comments about accessibility
   - Positive: "even I could understand", "perfect for beginners"
   - Negative: "assumes too much", "not for beginners"

4. MATH DEPTH: Comments about mathematical content
   - Positive: "thanks for the derivation", "great worked example"
   - Negative: "skipped steps", "didn't show the math"

5. OVERALL SENTIMENT: General positive/negative feeling

Return ONLY valid JSON:
{
  "visual_quality_signal": 0.X,
  "teaching_clarity_signal": 0.X,
  "beginner_friendly_signal": 0.X,
  "math_depth_signal": 0.X,
  "overall_sentiment": 0.X,
  "positive_mentions": N,
  "negative_mentions": N,
  "praised_aspects": ["aspect1", "aspect2"],
  "criticized_aspects": ["aspect1", "aspect2"],
  "quality_summary": "1-2 sentence summary of what comments reveal about video quality"
}`;

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${XAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'grok-4-1-fast-non-reasoning',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Comments] Grok API error: ${response.status} - ${errorText}`);
            return null;
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            console.error('[Comments] No content in response');
            return null;
        }

        const analysis: CommentAnalysis = JSON.parse(content);

        // Validate and clamp scores to [-1, 1]
        const clamp = (v: number) => Math.max(-1, Math.min(1, v || 0));

        analysis.visual_quality_signal = clamp(analysis.visual_quality_signal);
        analysis.teaching_clarity_signal = clamp(analysis.teaching_clarity_signal);
        analysis.beginner_friendly_signal = clamp(analysis.beginner_friendly_signal);
        analysis.math_depth_signal = clamp(analysis.math_depth_signal);
        analysis.overall_sentiment = clamp(analysis.overall_sentiment);

        console.log(`[Comments] Analysis complete:`);
        console.log(`  - Visual: ${analysis.visual_quality_signal.toFixed(2)}`);
        console.log(`  - Clarity: ${analysis.teaching_clarity_signal.toFixed(2)}`);
        console.log(`  - Beginner: ${analysis.beginner_friendly_signal.toFixed(2)}`);
        console.log(`  - Math: ${analysis.math_depth_signal.toFixed(2)}`);
        console.log(`  - Overall: ${analysis.overall_sentiment.toFixed(2)}`);

        return analysis;

    } catch (error) {
        console.error('[Comments] Analysis error:', error);
        return null;
    }
}

// ============================================================================
// SCORE ADJUSTMENT
// ============================================================================

/**
 * Adjust video scores based on comment analysis
 * Comments provide a "reality check" on transcript-based scores
 */
export function adjustScoresWithComments(
    transcriptScores: {
        beginner_score: number;
        visualization_score: number;
        math_explanation_score: number;
        real_world_score: number;
        ai_quality_score: number;
    },
    commentAnalysis: CommentAnalysis
): typeof transcriptScores {
    // Weight: 70% transcript, 30% comments
    const TRANSCRIPT_WEIGHT = 0.7;
    const COMMENT_WEIGHT = 0.3;

    // Convert comment signals (-1 to 1) to scores (0 to 1)
    const signalToScore = (signal: number) => (signal + 1) / 2;

    const adjustedScores = {
        beginner_score:
            transcriptScores.beginner_score * TRANSCRIPT_WEIGHT +
            signalToScore(commentAnalysis.beginner_friendly_signal) * COMMENT_WEIGHT,

        visualization_score:
            transcriptScores.visualization_score * TRANSCRIPT_WEIGHT +
            signalToScore(commentAnalysis.visual_quality_signal) * COMMENT_WEIGHT,

        math_explanation_score:
            transcriptScores.math_explanation_score * TRANSCRIPT_WEIGHT +
            signalToScore(commentAnalysis.math_depth_signal) * COMMENT_WEIGHT,

        real_world_score:
            transcriptScores.real_world_score, // Comments rarely mention this, keep transcript score

        ai_quality_score:
            transcriptScores.ai_quality_score * TRANSCRIPT_WEIGHT +
            signalToScore(commentAnalysis.teaching_clarity_signal) * COMMENT_WEIGHT
    };

    // Clamp all scores to [0, 1]
    for (const key of Object.keys(adjustedScores) as (keyof typeof adjustedScores)[]) {
        adjustedScores[key] = Math.max(0, Math.min(1, adjustedScores[key]));
    }

    console.log('[Comments] Adjusted scores:');
    console.log(`  - Beginner: ${transcriptScores.beginner_score.toFixed(2)} → ${adjustedScores.beginner_score.toFixed(2)}`);
    console.log(`  - Visual: ${transcriptScores.visualization_score.toFixed(2)} → ${adjustedScores.visualization_score.toFixed(2)}`);
    console.log(`  - Math: ${transcriptScores.math_explanation_score.toFixed(2)} → ${adjustedScores.math_explanation_score.toFixed(2)}`);
    console.log(`  - Quality: ${transcriptScores.ai_quality_score.toFixed(2)} → ${adjustedScores.ai_quality_score.toFixed(2)}`);

    return adjustedScores;
}

// ============================================================================
// COMBINED FUNCTION
// ============================================================================

/**
 * Scrape and analyze comments for a video
 */
export async function getCommentInsights(
    videoUrl: string
): Promise<{
    comments: CommentData | null;
    analysis: CommentAnalysis | null;
}> {
    // Scrape comments
    const comments = await scrapeYouTubeComments(videoUrl, 50);

    if (!comments || comments.comments.length === 0) {
        return { comments: null, analysis: null };
    }

    // Analyze comments
    const analysis = await analyzeComments(comments.comments);

    return { comments, analysis };
}
