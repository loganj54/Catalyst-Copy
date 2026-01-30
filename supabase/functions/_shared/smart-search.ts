// ============================================================================
// SMART SEARCH - Intelligent multi-query YouTube search
// ============================================================================
// Generates specific search queries based on context and video type,
// then runs wide-net YouTube search to find relevant videos.
// ============================================================================

import { searchYouTubeWithApify, ApifyVideo, extractVideoId } from './youtube-helpers.ts';

const XAI_API_KEY = Deno.env.get('XAI_API_KEY');

// ============================================================================
// TYPES
// ============================================================================

export interface SearchContext {
    term: string;                    // The selected term (e.g., "Reynolds number")
    unitTopic?: string;              // The unit/topic context (e.g., "Fluid mechanics")
    problemText?: string;            // The problem the student is working on
    videoType: string;               // Selected video type
}

export interface SearchResult {
    videos: ApifyVideo[];
    queries: string[];
    totalFound: number;
}

// ============================================================================
// VIDEO TYPE DESCRIPTIONS
// ============================================================================

export interface VideoTypeConfig {
    short: string;      // For UI/prompts
    query: string;      // For embedding queries - matches stored language
    keywords: string[]; // For search query generation
}

export const VIDEO_TYPE_DESCRIPTIONS: Record<string, VideoTypeConfig> = {
    'beginner-overview': {
        short: 'An introductory video that assumes no prior knowledge.',
        query: `BEGINNER-FRIENDLY video suitable for complete beginners with no prior knowledge required.
Features EXCELLENT beginner accessibility with foundational explanations.
Explains concepts from the ground up in simple terms.
Teaching style emphasizes clarity and basic understanding.
Assumes NO prerequisites.
Good for students just starting to learn this topic.`,
        keywords: ['introduction', 'basics', 'explained for beginners', 'what is', 'fundamentals', 'overview']
    },

    'visualization': {
        short: 'A highly visual video with animations and demonstrations.',
        query: `Features STRONG VISUAL EXPLANATIONS with animations, diagrams, and visual demonstrations throughout.
Contains EXCELLENT visual quality using graphical representations.
Shows rather than tells with simulation and animated explanations.
Visual elements present include: diagrams, graphs, animations, simulations.
Teaching style: visual demonstration.
Highly visual video for understanding abstract concepts.`,
        keywords: ['animation', 'visual', 'simulation', 'diagram', 'demonstration', 'animated', 'graphical']
    },

    'math-explanation': {
        short: 'A video focused on mathematical derivations and worked examples.',
        query: `Contains DETAILED MATHEMATICAL DERIVATIONS with step-by-step equation work and calculations.
Features STRONG mathematical coverage with formulas and computational methods.
Shows step-by-step derivations, multiple worked examples with calculations.
Mathematical content includes: equations, derivations, proofs, calculations.
Teaching style: worked-example.
Focused on step-by-step problem solving and formula explanations.`,
        keywords: ['derivation', 'step by step', 'worked example', 'calculation', 'formula', 'equation', 'proof']
    },

    'real-world': {
        short: 'A video showing practical applications and engineering examples.',
        query: `Emphasizes REAL-WORLD APPLICATIONS with practical engineering examples and case studies.
Features STRONG practical applications connecting theory to practice.
Shows multiple real engineering examples, industry applications, case studies.
Real-world applications include: practical uses, industry examples, engineering problems.
Teaching style: applied demonstration.
Connects theoretical concepts to real-world scenarios.`,
        keywords: ['application', 'example', 'engineering', 'industry', 'practical', 'real world', 'case study']
    }
};

// Helper to get description string (for backward compatibility)
export function getVideoTypeDescription(videoType: string): string {
    const config = VIDEO_TYPE_DESCRIPTIONS[videoType];
    return config?.short || 'Educational video';
}

// Helper to get query text for embedding search
export function getVideoTypeQueryText(videoType: string): string {
    const config = VIDEO_TYPE_DESCRIPTIONS[videoType];
    return config?.query || 'Educational video content';
}

// Helper to get keywords for search generation
export function getVideoTypeKeywords(videoType: string): string[] {
    const config = VIDEO_TYPE_DESCRIPTIONS[videoType];
    return config?.keywords || ['explained', 'tutorial'];
}

// ============================================================================
// QUERY GENERATION
// ============================================================================

/**
 * Generate 5 highly specific YouTube search queries based on context
 */
export async function generateSearchQueries(context: SearchContext): Promise<string[]> {
    if (!XAI_API_KEY) {
        // Fallback to simple query generation
        return generateFallbackQueries(context);
    }

    console.log('[SmartSearch] Generating search queries with AI...');

    // Get keywords from the structured type config
    const typeConfig = VIDEO_TYPE_DESCRIPTIONS[context.videoType];
    const keywords = typeConfig?.keywords || ['explained', 'tutorial'];
    const typeDescription = typeConfig?.short || 'Educational video';

    const prompt = `Generate 5 highly specific YouTube search queries to find the best educational video.

Topic/Term: ${context.term}
${context.unitTopic ? `Learning Context: ${context.unitTopic}` : ''}
${context.problemText ? `Student is working on: ${context.problemText.substring(0, 500)}` : ''}

Video Type Needed: ${context.videoType}
Description: ${typeDescription}
Type Keywords to prioritize: ${keywords.join(', ')}

Requirements:
1. Generate exactly 5 search queries
2. Make each query SPECIFIC, not generic (e.g., "Reynolds number animation laminar turbulent flow" NOT just "Reynolds number")
3. CRITICAL: Include at least one keyword from the type keywords in each query: ${keywords.slice(0, 4).join(', ')}
4. Structure queries as: [topic] + [type keyword] + [specificity]
5. Vary the specificity across queries:
   - 2 queries: broad topic + type keyword
   - 2 queries: specific subtopic + type keyword
   - 1 query: related concept + type keyword
6. Consider the learning context when building queries
7. Each query should be 4-8 words

Return ONLY a JSON array of 5 strings, no explanation. Example:
["query one here", "query two here", "query three here", "query four here", "query five here"]`;

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
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            console.error('[SmartSearch] AI query generation failed, using fallback');
            return generateFallbackQueries(context);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            return generateFallbackQueries(context);
        }

        // Parse the response - handle both array and object responses
        let queries: string[];
        const parsed = JSON.parse(content);

        if (Array.isArray(parsed)) {
            queries = parsed;
        } else if (parsed.queries && Array.isArray(parsed.queries)) {
            queries = parsed.queries;
        } else {
            // Extract any array from the object
            const values = Object.values(parsed);
            const arrayValue = values.find(v => Array.isArray(v));
            queries = arrayValue as string[] || generateFallbackQueries(context);
        }

        console.log('[SmartSearch] Generated queries:', queries);
        return queries.slice(0, 5);

    } catch (error) {
        console.error('[SmartSearch] Query generation error:', error);
        return generateFallbackQueries(context);
    }
}

/**
 * Fallback query generation without AI
 */
function generateFallbackQueries(context: SearchContext): string[] {
    const { term, videoType, unitTopic } = context;

    // Get keywords from the structured type config
    const typeConfig = VIDEO_TYPE_DESCRIPTIONS[videoType];
    const keywords = typeConfig?.keywords || ['explained', 'tutorial'];

    const queries = keywords.slice(0, 4).map(kw => `${term} ${kw}`);

    if (unitTopic) {
        queries.push(`${term} ${unitTopic}`);
    }

    return queries.slice(0, 5);
}

// ============================================================================
// WIDE-NET SEARCH
// ============================================================================

/**
 * Run multiple search queries and aggregate results
 */
export async function searchYouTubeWideNet(queries: string[]): Promise<SearchResult> {
    console.log(`[SmartSearch] Running ${queries.length} queries for wide-net search...`);

    const allVideos: Map<string, ApifyVideo> = new Map();

    // Run all queries (could parallelize, but sequential is safer for rate limits)
    for (const query of queries) {
        try {
            console.log(`[SmartSearch] Searching: "${query}"`);
            const videos = await searchYouTubeWithApify(query);

            // Dedupe by video ID
            for (const video of videos) {
                const videoId = extractVideoId(video.url);
                if (videoId && !allVideos.has(videoId)) {
                    allVideos.set(videoId, video);
                }
            }

            console.log(`[SmartSearch] Found ${videos.length} videos, ${allVideos.size} unique total`);

            // Small delay between queries to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`[SmartSearch] Query failed: "${query}"`, error);
            // Continue with other queries
        }
    }

    const uniqueVideos = Array.from(allVideos.values());

    // Apply light filters
    const filteredVideos = uniqueVideos.filter(video => {
        // Filter out very short videos (likely clips/shorts)
        if (video.duration && video.duration < 120) return false;

        // Filter out very long videos (likely full lectures)
        if (video.duration && video.duration > 2700) return false; // 45 min

        return true;
    });

    console.log(`[SmartSearch] Final: ${filteredVideos.length} videos after filtering (from ${uniqueVideos.length})`);

    return {
        videos: filteredVideos,
        queries,
        totalFound: uniqueVideos.length
    };
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Full smart search: generate queries + run wide-net search
 */
export async function smartSearch(context: SearchContext): Promise<SearchResult> {
    console.log('[SmartSearch] Starting smart search...');
    console.log(`  - Term: ${context.term}`);
    console.log(`  - Video type: ${context.videoType}`);
    console.log(`  - Context: ${context.unitTopic || 'none'}`);

    // Step 1: Generate specific queries
    const queries = await generateSearchQueries(context);

    // Step 2: Run wide-net search
    const result = await searchYouTubeWideNet(queries);

    console.log(`[SmartSearch] Complete: ${result.videos.length} videos from ${queries.length} queries`);

    return result;
}
