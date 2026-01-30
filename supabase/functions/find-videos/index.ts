// ============================================================================
// FIND VIDEOS EDGE FUNCTION
// ============================================================================
// Intelligent video discovery with hybrid two-pass analysis.
//
// Flow:
// 1. Analyze student's learning context (Claude Haiku)
// 2. Fast path: Search Pinecone for pre-loaded videos
// 3. Slow path (if needed): On-demand loading from YouTube
//    - Generate YouTube queries
//    - Search YouTube (Apify)
//    - Get transcripts (SupaData)
//    - Pass 1: Generic analysis (Grok)
//    - Pass 2: Relevance scoring (Claude)
//    - Store ALL videos, return only relevant ones
// 4. Return top 5 videos with match explanations
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  callClaude,
  callClaudeJSON
} from '../_shared/supabase-client.ts';
import { generateEmbedding } from '../_shared/embeddings.ts';
import { queryVectors, upsertVectors } from '../_shared/pinecone-client.ts';
import {
  searchYouTubeWithApify,
  getTranscriptWithSupaData,
  analyzeTranscriptWithGrok,
  ApifyVideo,
  GrokAnalysis
} from '../_shared/youtube-helpers.ts';

const PINECONE_NAMESPACE = 'resources';
const RELEVANCE_THRESHOLD = 0.6;
const MIN_RESULTS_FOR_FAST_PATH = 3;

// ============================================================================
// TYPES
// ============================================================================

interface FindVideosRequest {
  blueprint_id: string;
  unit_id: string;
  video_type?: string;
  preferred_video_types?: string[];
  max_results?: number;
}

interface LearningUnit {
  unit_id: string;
  unit_type: string;  // Can be 'walkthrough', 'topic', 'prerequisite', 'problem', etc.
  topic?: string;  // May not always be present
  title?: string;  // Alternative to topic
  description?: string;
  learning_objective?: string;
  difficulty?: string;
  equations?: any[];
  search_queries?: Array<{ query: string; query_type: string }>;
  [key: string]: any;  // Allow additional fields
}

interface StudentNeedAnalysis {
  need_description: string;  // Detailed description of what student needs
  detected_need_type: string;  // e.g., "worked example", "conceptual explanation"
  difficulty_level: string;
  youtube_queries: string[];  // 2-3 specific YouTube search queries
}

interface RelevanceScore {
  relevance_score: number;  // 0-1
  match_explanation: string;
  missing_elements: string[];
}

interface VideoWithRelevance {
  resource_id: string;
  title: string;
  url: string;
  platform: 'YouTube';
  channel_name: string;
  thumbnail_url: string;
  duration: number;
  categories: string[];
  difficulty_level?: string;
  relevance_score: number;
  match_explanation: string;
  average_rating: number | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Analyze student's learning context to determine what they need
 */
async function analyzeStudentContext(unit: LearningUnit, videoType?: string): Promise<StudentNeedAnalysis> {
  console.log('[Context] Analyzing student need...');

  // Get topic from various possible fields
  const topicText = unit.topic || unit.title || unit.unit_id || 'Unknown topic';

  // Map video type to search preferences
  let videoTypeGuidance = '';
  if (videoType) {
    const typeMap: Record<string, string> = {
      'beginner-overview': 'Focus on introductory, foundational content. Prioritize videos that assume no prior knowledge and explain concepts from the ground up. Look for "introduction", "basics", "for beginners" style content.',
      'visualization': 'Prioritize visual demonstrations, animations, diagrams, and graphical explanations. Look for videos with strong visual components, simulations, or animated explanations.',
      'math-explanation': 'Focus on step-by-step mathematical derivations, worked examples, and computational demonstrations. Prioritize videos that show the math being worked through on screen.',
      'real-world': 'Emphasize practical applications, case studies, real-world examples, and industry applications. Look for videos showing how concepts are used in practice.'
    };
    videoTypeGuidance = typeMap[videoType] || '';
  }

  const prompt = `You are analyzing a student's learning need to find the right educational video.

Learning unit information:
- Type: ${unit.unit_type}
- Topic: ${topicText}
- Description: ${unit.description || 'N/A'}
- Learning objective: ${unit.learning_objective || 'N/A'}
- Difficulty: ${unit.difficulty || 'intermediate'}
- Has equations: ${unit.equations && unit.equations.length > 0 ? 'yes' : 'no'}

${videoType ? `Student's video preference: ${videoTypeGuidance}
` : ''}Task: Determine what kind of video would help this student most.

Guidelines for video type detection:
- "walkthrough" units → student needs worked examples with step-by-step solutions
- "topic" units → student needs conceptual explanations or visual demonstrations
- "prerequisite" units → student needs introductory overviews or quick reviews
- Units with equations → prioritize computational/derivation videos
- Learning objectives with "apply" → need practical examples
- Learning objectives with "understand" → need conceptual explanations
- Learning objectives with "derive" → need derivation/proof videos
${videoType ? `
IMPORTANT: Incorporate the student's video preference into your search queries and need description.
` : ''}
Generate 2-3 specific YouTube search queries that would find the right videos.
Make queries specific, including:
- Key technical terms
- Problem types or boundary conditions
- Methodology (e.g., "step by step", "worked example", "animation")

Return JSON:
{
  "need_description": "2-3 sentence description of what video the student needs",
  "detected_need_type": "worked_example" | "conceptual_explanation" | "visual_demonstration" | "formula_derivation" | "introduction_overview" | "software_tutorial",
  "difficulty_level": "beginner" | "intermediate" | "advanced",
  "youtube_queries": ["query 1", "query 2", "query 3"]
}`;

  const analysis = await callClaudeJSON<StudentNeedAnalysis>(
    'You are an expert at analyzing student learning needs and finding the right educational videos.',
    prompt
  );

  console.log(`[Context] Need type: ${analysis.detected_need_type}`);
  console.log(`[Context] Generated ${analysis.youtube_queries.length} queries`);

  return analysis;
}

/**
 * Score a video's relevance to the student's specific need
 */
async function scoreVideoRelevance(
  transcript: string,
  videoSummary: string,
  studentNeed: string
): Promise<RelevanceScore> {
  // Use first 30% of transcript for speed
  const transcriptExcerpt = transcript.substring(0, Math.min(transcript.length * 0.3, 5000));

  const prompt = `You are evaluating if a YouTube video helps a student with a specific learning need.

Student need: ${studentNeed}

Video summary: ${videoSummary}

Video transcript (excerpt): ${transcriptExcerpt}

Score 0-1 how well this video addresses the student's need:
- 0.0-0.3: Not relevant (wrong topic or approach)
- 0.4-0.6: Somewhat relevant (related but not specific enough)
- 0.7-0.8: Good match (covers the need adequately)
- 0.9-1.0: Excellent match (precisely addresses the need)

Return JSON:
{
  "relevance_score": 0.XX,
  "match_explanation": "2-3 sentence explanation of why/how this video helps",
  "missing_elements": ["concept X", "step Y"] // If score < 0.9, what's missing?
}`;

  const score = await callClaudeJSON<RelevanceScore>(
    'You are an expert at evaluating educational video relevance to student learning needs.',
    prompt
  );

  console.log(`  → Relevance: ${score.relevance_score.toFixed(2)}`);

  return score;
}

/**
 * Generate match explanation for a Pinecone-matched video
 */
async function generateMatchExplanation(
  videoTitle: string,
  videoSummary: string,
  studentNeed: string
): Promise<string> {
  const prompt = `Explain in 2-3 sentences why this video would help a student who needs: ${studentNeed}

Video: "${videoTitle}"
Summary: ${videoSummary}

Keep it concise and specific. Focus on what the video covers that addresses their need.`;

  const response = await callClaude(
    'You are an expert at explaining why educational videos match student learning needs.',
    prompt
  );

  return response.content.trim();
}

/**
 * Fast path: Search Pinecone for pre-loaded videos
 */
async function searchPinecone(
  studentNeed: string,
  supabase: any
): Promise<VideoWithRelevance[]> {
  console.log('[Fast Path] Searching Pinecone...');

  // Generate embedding for student need
  const { embedding } = await generateEmbedding(studentNeed);

  // Query Pinecone
  const matches = await queryVectors(embedding, PINECONE_NAMESPACE, 15);

  if (matches.length === 0) {
    console.log('[Fast Path] No matches found');
    return [];
  }

  console.log(`[Fast Path] Found ${matches.length} candidates`);

  // Filter by threshold
  const relevantMatches = matches.filter(m => m.score >= RELEVANCE_THRESHOLD);

  if (relevantMatches.length === 0) {
    console.log('[Fast Path] No matches above threshold');
    return [];
  }

  console.log(`[Fast Path] ${relevantMatches.length} above threshold`);

  // Fetch full resource data from database
  const resourceIds = relevantMatches.map(m => m.metadata.resource_id);

  const { data: resources, error } = await supabase
    .from('resources_from_make')
    .select('*')
    .in('id', resourceIds);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // Build video objects with match explanations
  const videos: VideoWithRelevance[] = [];

  for (const resource of resources) {
    const match = relevantMatches.find(m => m.metadata.resource_id === resource.id);
    if (!match) continue;

    // Generate match explanation
    const matchExplanation = await generateMatchExplanation(
      resource.title,
      resource.summary,
      studentNeed
    );

    // Parse categories from full_content_analysis
    let categories: string[] = [];
    try {
      const analysis = JSON.parse(resource.full_content_analysis || '{}');
      categories = analysis.categories || [];
    } catch (e) {
      console.error('[Fast Path] Failed to parse categories:', e);
    }

    videos.push({
      resource_id: resource.id,
      title: resource.title,
      url: resource.url,
      platform: 'YouTube',
      channel_name: resource.channel_name,
      thumbnail_url: resource.thumbnail_url,
      duration: resource.duration_seconds,
      categories,
      difficulty_level: resource.difficulty_level,
      relevance_score: match.score,
      match_explanation: matchExplanation,
      average_rating: resource.average_rating,
    });
  }

  // Sort by relevance × rating
  videos.sort((a, b) => {
    const scoreA = a.relevance_score * (a.average_rating || 3.5);
    const scoreB = b.relevance_score * (b.average_rating || 3.5);
    return scoreB - scoreA;
  });

  return videos;
}

/**
 * Slow path: On-demand loading from YouTube
 */
async function loadVideosOnDemand(
  youtubeQueries: string[],
  studentNeed: string,
  supabase: any
): Promise<VideoWithRelevance[]> {
  console.log('[Slow Path] On-demand loading...');

  // Step 1: Search YouTube
  const allVideos: ApifyVideo[] = [];
  const videoUrls = new Set<string>();

  for (const query of youtubeQueries) {
    try {
      const videos = await searchYouTubeWithApify(query);

      for (const video of videos) {
        if (!videoUrls.has(video.url)) {
          videoUrls.add(video.url);
          allVideos.push(video);
        }
      }
    } catch (error) {
      console.error(`[Slow Path] Search error for "${query}":`, error);
    }
  }

  if (allVideos.length === 0) {
    console.log('[Slow Path] No videos found on YouTube');
    return [];
  }

  console.log(`[Slow Path] Found ${allVideos.length} unique videos`);

  // Take top 5-7 for processing (cost control)
  const videosToProcess = allVideos.slice(0, 7);

  const processedVideos: VideoWithRelevance[] = [];

  // Step 2-3: Process each video
  for (const video of videosToProcess) {
    try {
      console.log(`[Slow Path] Processing: ${video.title}`);

      // Get transcript
      const transcript = await getTranscriptWithSupaData(video.url);

      // PASS 1: Generic analysis (Grok)
      const analysis = await analyzeTranscriptWithGrok(transcript);

      // PASS 2: Specific relevance check (Claude)
      const relevance = await scoreVideoRelevance(
        transcript,
        analysis.summary,
        studentNeed
      );

      // Generate UUID for resource
      const resourceId = crypto.randomUUID();

      // Generate embedding for summary
      console.log('[Slow Path] Generating embedding...');
      const { embedding } = await generateEmbedding(analysis.summary);

      // Store in database (ALL videos, regardless of relevance)
      console.log('[Slow Path] Storing in database...');
      const { error: dbError } = await supabase
        .from('resources_from_make')
        .insert({
          id: resourceId,
          url: video.url,
          title: video.title,
          description: video.description || analysis.summary,
          platform: 'YouTube',
          channel_name: video.channelName,
          channel_url: video.channelUrl,
          thumbnail_url: video.thumbnailUrl,
          duration_seconds: video.duration,
          resource_type: 'video',
          original_search_query: youtubeQueries[0],
          key_phrases: analysis.key_phrases,
          transcript: transcript,
          summary: analysis.summary,
          difficulty_level: analysis.difficulty_level,
          problem_types_solved: analysis.problem_types_solved,
          equations_used: analysis.equations_used,
          tools_demonstrated: analysis.tools_demonstrated,
          pacing: analysis.pacing,
          full_content_analysis: JSON.stringify({
            categories: analysis.categories,
            problems: analysis.problems,
          }),
        });

      if (dbError) {
        console.error('[Slow Path] Database error:', dbError);
        continue;
      }

      // Store in Pinecone
      console.log('[Slow Path] Storing in Pinecone...');
      await upsertVectors(
        [
          {
            id: resourceId,
            values: embedding,
            metadata: {
              resource_id: resourceId,
              title: video.title,
              platform: 'YouTube',
              url: video.url,
            },
          },
        ],
        PINECONE_NAMESPACE
      );

      // Add to processed videos
      processedVideos.push({
        resource_id: resourceId,
        title: video.title,
        url: video.url,
        platform: 'YouTube',
        channel_name: video.channelName,
        thumbnail_url: video.thumbnailUrl || '',
        duration: video.duration || 0,
        categories: analysis.categories,
        difficulty_level: analysis.difficulty_level,
        relevance_score: relevance.relevance_score,
        match_explanation: relevance.match_explanation,
        average_rating: null,  // No ratings yet for new videos
      });

      console.log(`[Slow Path] ✅ Processed: ${video.title}`);
    } catch (error) {
      console.error(`[Slow Path] ❌ Error processing ${video.title}:`, error);
    }
  }

  return processedVideos;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const body: FindVideosRequest = await req.json();
    const { blueprint_id, unit_id, video_type, max_results = 5 } = body;

    console.log('='.repeat(80));
    console.log('[find-videos] Starting search');
    console.log(`  - Blueprint: ${blueprint_id}`);
    console.log(`  - Unit: ${unit_id}`);
    console.log(`  - Video Type: ${video_type || 'auto-detect'}`);
    console.log('='.repeat(80));

    if (!blueprint_id || !unit_id) {
      throw new Error('Missing required fields: blueprint_id, unit_id');
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Fetch learning unit from blueprint_structures
    const { data: structures, error: structError } = await supabase
      .from('blueprint_structures')
      .select('structure, all_search_queries')
      .eq('blueprint_id', blueprint_id)
      .single();

    if (structError || !structures) {
      console.error('[find-videos] Structure fetch error:', structError);
      throw new Error('Learning structure not found');
    }

    // Find the specific unit in the structure
    const structure = structures.structure;
    let unit: LearningUnit | null = null;

    // Search in prerequisites_section
    if (structure.prerequisites_section?.learning_units) {
      for (const prereq of structure.prerequisites_section.learning_units) {
        if (prereq.unit_id === unit_id) {
          unit = prereq;
          break;
        }
      }
    }

    // Search in content_sections
    if (!unit && structure.content_sections) {
      for (const section of structure.content_sections) {
        if (section.learning_units) {
          for (const lu of section.learning_units) {
            if (lu.unit_id === unit_id) {
              unit = lu;
              break;
            }
          }
        }
        if (unit) break;
      }
    }

    if (!unit) {
      console.error('[find-videos] Available units:', {
        prerequisites: structure.prerequisites_section?.learning_units?.map((u: any) => u.unit_id),
        sections: structure.content_sections?.flatMap((s: any) => s.learning_units?.map((u: any) => u.unit_id) || []),
      });
      throw new Error(`Unit ${unit_id} not found in learning structure`);
    }

    console.log(`[Main] Found unit:`, unit);
    console.log(`[Main] Unit keys:`, Object.keys(unit));

    // STEP 1: Analyze student context
    const contextAnalysis = await analyzeStudentContext(unit, video_type);

    // STEP 2: Fast path - Search Pinecone
    let videos = await searchPinecone(contextAnalysis.need_description, supabase);

    // STEP 3: Slow path if needed
    if (videos.length < MIN_RESULTS_FOR_FAST_PATH) {
      console.log(`[Main] Only ${videos.length} matches found, triggering on-demand loading...`);

      const newVideos = await loadVideosOnDemand(
        contextAnalysis.youtube_queries,
        contextAnalysis.need_description,
        supabase
      );

      // Merge results
      videos = [...videos, ...newVideos];

      // Filter by threshold
      videos = videos.filter(v => v.relevance_score >= RELEVANCE_THRESHOLD);

      // Sort by relevance × rating
      videos.sort((a, b) => {
        const scoreA = a.relevance_score * (a.average_rating || 3.5);
        const scoreB = b.relevance_score * (b.average_rating || 3.5);
        return scoreB - scoreA;
      });
    }

    // Limit to max_results
    const topVideos = videos.slice(0, max_results);

    console.log('\n' + '='.repeat(80));
    console.log('[find-videos] Complete!');
    console.log(`  - Total candidates: ${videos.length}`);
    console.log(`  - Returning: ${topVideos.length}`);
    console.log('='.repeat(80));

    return new Response(
      JSON.stringify({
        success: true,
        videos: topVideos,
        search_strategy_used: {
          detected_need: contextAnalysis.detected_need_type,
          queries_executed: contextAnalysis.youtube_queries.length,
          total_candidates: videos.length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[find-videos] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
