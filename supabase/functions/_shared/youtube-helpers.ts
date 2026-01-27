// ============================================================================
// YOUTUBE HELPERS - Shared utilities for YouTube video processing
// ============================================================================
// Reusable functions for searching YouTube, fetching transcripts, and
// analyzing video content with Grok. Used by both load-resources-database
// and find-videos edge functions.
// ============================================================================

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
const APIFY_ACTOR_ID = Deno.env.get('APIFY_ACTOR_ID');
const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY');
const SUPADATA_API_ENDPOINT = Deno.env.get('SUPADATA_API_ENDPOINT');
const XAI_API_KEY = Deno.env.get('XAI_API_KEY');

// ============================================================================
// TYPES
// ============================================================================

export interface ApifyVideo {
  url: string;
  title: string;
  channelName: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  description?: string;
}

export interface GrokAnalysis {
  categories: string[];  // Multiple categories allowed
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  problem_types_solved: string[];
  equations_used: string[];
  tools_demonstrated: string[];
  pacing: 'quick_review' | 'thorough' | 'deep_dive';
  key_phrases: string[];
  summary: string;
  problems: string[];
}

// ============================================================================
// GROK ANALYSIS PROMPT
// ============================================================================

const GROK_ANALYSIS_PROMPT = `You are an expert in analyzing engineering educational video transcripts, particularly in fields like mechanical engineering, electrical, civil, aerospace, and all other engineering disciplines. Your task is to thoroughly analyze the provided transcript from a YouTube video and categorize it for a database system. This system recommends videos to students based on their specific learning needs, such as homework problems. For example, if a student needs help with "one-dimensional steady-state conduction through a flat wall with given temperature and heat flux boundary conditions," the system should match it to videos with highly specific key phrases.

Input: The full transcript of the YouTube video.

Output: Produce a structured JSON object with the following fields. Do not add extra text outside the JSON. ALWAYS respond in 100% valid JSON. Ensure the analysis is detailed, accurate, and based solely on the transcript content.

{
  "categories": [
    // An array of strings representing categorizations. Can include MULTIPLE categories that apply:
    // - "worked_example" (step-by-step problem solving with calculations and final answer)
    // - "conceptual_explanation" (explains theory, concepts, or "why" without heavy computation)
    // - "visual_demonstration" (uses diagrams, animations, simulations to illustrate concepts)
    // - "formula_derivation" (derives equations from first principles, shows mathematical proofs)
    // - "introduction_overview" (introductory or survey-level content for beginners)
    // - "software_tutorial" (demonstrates how to use MATLAB, Excel, Python, CAD, simulation tools, etc.)
    // - "common_mistakes" (focuses on pitfalls, errors to avoid, troubleshooting)
    // - "real_world_application" (shows practical engineering applications, case studies)
    // Include all categories that clearly apply (typically 1-3 categories per video).
  ],
  "difficulty_level": "beginner" | "intermediate" | "advanced",
    // - "beginner": Introductory, assumes little/no prior knowledge
    // - "intermediate": Assumes foundational knowledge, typical undergraduate level
    // - "advanced": Graduate-level or specialized advanced topics

  "problem_types_solved": [
    // Array of specific problem types or scenarios solved in this video
    // Examples: "composite wall conduction", "forced convection over a flat plate", "transient heat conduction with lumped capacitance"
    // Be specific! Include boundary conditions, geometry, method if applicable
    // Leave empty [] if no specific problems are solved
  ],

  "equations_used": [
    // Array of equations or formulas used, derived, or explained
    // Examples: "Fourier's Law", "q = -kA(dT/dx)", "Newton's Law of Cooling", "Biot number = hL/k"
    // Include both equation names AND symbolic forms when mentioned
    // Leave empty [] if no specific equations are used
  ],

  "tools_demonstrated": [
    // Array of software, tools, or computational methods demonstrated
    // Examples: "MATLAB", "Excel", "Python", "ANSYS", "SolidWorks", "hand calculation", "graphing calculator"
    // Only include if the video shows HOW to use the tool (not just mentions it)
    // Leave empty [] if no tools are demonstrated
  ],

  "pacing": "quick_review" | "thorough" | "deep_dive",
    // - "quick_review": Brief overview, fast-paced, summary format (< 10 minutes typical)
    // - "thorough": Standard teaching pace with explanations and examples (10-30 minutes)
    // - "deep_dive": In-depth exploration, detailed derivations, multiple examples (> 30 minutes)

  "key_phrases": [
    // An array of exactly 10 extremely specific, descriptive key phrases (strings) that capture the core content, topics, problems, methods, or concepts discussed. These should be detailed enough for precise database searching and matching to student queries.
    // Examples: "One-dimensional steady-state conduction through a flat wall with fixed temperature on one side and convective heat transfer on the other", "Solving transient heat conduction using lumped capacitance method with Biot number calculation", "Finite difference method for 2D heat conduction in a rectangular plate".
    // Make them searchable: Include specific boundary conditions, equations, materials, or scenarios mentioned. Avoid generic phrases like "heat transfer basics".
  ],
  "summary": "A brief 2-3 sentence summary of the video's main content and educational value.",
  "problems": [
    // An array of specific problems extracted from the transcript. Each entry: "Problem 1: [concise description of the problem, including key parameters, conditions, and what is being asked]."
    // Only include if the video features explicit homework-style or computational problems (e.g., numerical examples, derivations, or step-by-step solutions). List sequentially if multiple. Leave empty [] if none.
  ]
}`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Search for YouTube videos using Apify Actor
 */
export async function searchYouTubeWithApify(searchQuery: string): Promise<ApifyVideo[]> {
  if (!APIFY_API_TOKEN || !APIFY_ACTOR_ID) {
    throw new Error('Apify credentials not configured');
  }

  console.log(`[Apify] Searching YouTube for: "${searchQuery}"`);

  // Input format for grow_media/youtube-search-api actor
  const inputPayload = {
    q: searchQuery,
    maxResults: 10,
    relevanceLanguage: "en",
    useFilters: false,
    channelType: "any",
    order: "relevance",
    safeSearch: "moderate",
    videoDefinition: "any",
    videoDuration: "any",
    videoLicense: "any",
  };

  console.log(`[Apify] Starting actor run...`);

  const runResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputPayload),
  });

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify run failed: ${runResponse.status} - ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;
  const defaultDatasetId = runData.data.defaultDatasetId;

  console.log(`[Apify] Run ID: ${runId}, Dataset: ${defaultDatasetId}`);

  // Wait for the run to complete (poll with timeout)
  let attempts = 0;
  const maxAttempts = 60;
  let runStatus = 'RUNNING';

  while (runStatus === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`);
    const statusData = await statusResponse.json();
    runStatus = statusData.data.status;

    attempts++;
    console.log(`[Apify] Status: ${runStatus} (${attempts}/${maxAttempts})`);
  }

  if (runStatus !== 'SUCCEEDED') {
    throw new Error(`Apify run failed: ${runStatus}`);
  }

  // Fetch results
  const resultsResponse = await fetch(`https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`);

  if (!resultsResponse.ok) {
    throw new Error(`Failed to fetch results: ${resultsResponse.status}`);
  }

  const results = await resultsResponse.json();
  console.log(`[Apify] Found ${results.length} videos`);

  // Map to our format
  return results.map((item: any) => ({
    url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
    title: item.title || '',
    channelName: item.channelName || item.channelTitle || '',
    channelUrl: item.channelUrl || '',
    thumbnailUrl: item.thumbnailUrl || item.thumbnail || '',
    duration: item.duration || item.lengthSeconds || 0,
    description: item.description || '',
  }));
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parse transcript from SupaData format to plain text
 */
export function parseTranscriptSegments(transcriptData: any): string {
  if (typeof transcriptData === 'string') {
    return transcriptData;
  }

  if (Array.isArray(transcriptData)) {
    const textSegments = transcriptData
      .filter(segment => segment && segment.text)
      .map(segment => segment.text.trim())
      .filter(text => text.length > 0);

    return textSegments.join(' ');
  }

  if (transcriptData && typeof transcriptData === 'object' && transcriptData.text) {
    return transcriptData.text;
  }

  return String(transcriptData);
}

/**
 * Get video transcript using SupaData API
 */
export async function getTranscriptWithSupaData(videoUrl: string): Promise<string> {
  if (!SUPADATA_API_KEY) {
    throw new Error('SupaData API key not configured');
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${videoUrl}`);
  }

  console.log(`[SupaData] Fetching transcript for: ${videoId}`);

  const endpoint = SUPADATA_API_ENDPOINT || 'https://api.supadata.ai/v1/transcript';

  let response = await fetch(`${endpoint}?url=${encodeURIComponent(videoUrl)}`, {
    method: 'GET',
    headers: {
      'x-api-key': SUPADATA_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  // Try alternate auth methods if 401
  if (!response.ok && response.status === 401) {
    response = await fetch(`${endpoint}?url=${encodeURIComponent(videoUrl)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPADATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SupaData error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  const rawTranscript = data.transcript || data.text || data.content || data.data?.transcript || '';

  if (!rawTranscript) {
    throw new Error('No transcript found in response');
  }

  const transcript = parseTranscriptSegments(rawTranscript);

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript parsing resulted in empty text');
  }

  console.log(`[SupaData] Transcript length: ${transcript.length} chars`);

  return transcript;
}

/**
 * Analyze transcript using Grok 4.1
 */
export async function analyzeTranscriptWithGrok(transcript: string): Promise<GrokAnalysis> {
  if (!XAI_API_KEY) {
    throw new Error('XAI API key not configured');
  }

  console.log('[Grok] Analyzing transcript...');

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-non-reasoning',
      messages: [
        {
          role: 'system',
          content: GROK_ANALYSIS_PROMPT,
        },
        {
          role: 'user',
          content: `Transcript to analyze: ${transcript}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in Grok response');
  }

  const analysis: GrokAnalysis = JSON.parse(content);

  console.log('[Grok] Analysis complete');
  console.log(`  - Categories: ${analysis.categories.join(', ')}`);
  console.log(`  - Difficulty: ${analysis.difficulty_level}`);
  console.log(`  - Key phrases: ${analysis.key_phrases.length}`);

  return analysis;
}
