// ============================================================================
// CONTENT ANALYZER
// ============================================================================
// Uses GPT-5-nano to analyze video transcripts or metadata and extract
// detailed, specific information about what the resource teaches.
// This enables precise semantic matching between student needs and resources.
// ============================================================================

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANALYSIS_MODEL = 'gpt-5-nano-2025-08-07';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ContentAnalysis {
  detailed_summary: string;
  concepts_taught: string[];
  prerequisites_assumed: string[];
  difficulty_assessment: string;
  formulas_covered: string[];
  problem_types: string[];
  teaching_style: 'lecture' | 'worked_examples' | 'visual_explanation' | 'interactive' | 'mixed';
  key_topics: string[];
  estimated_duration_minutes?: number;
}

export interface AnalysisResult {
  success: boolean;
  analysis: ContentAnalysis | null;
  source: 'transcript' | 'metadata';
  confidence: number; // 0-1, higher for transcript-based analysis
  error?: string;
  tokens_used?: number;
}

export interface VideoMetadata {
  title: string;
  description?: string;
  channelName?: string;
  duration_seconds?: number;
}

// ============================================================================
// TRANSCRIPT ANALYSIS (High Confidence)
// ============================================================================

/**
 * Analyze a video transcript to extract detailed content information
 * 
 * @param transcript - Full or truncated video transcript
 * @param metadata - Video title, description, channel info
 * @returns Detailed content analysis with high confidence
 */
export async function analyzeTranscript(
  transcript: string,
  metadata: VideoMetadata
): Promise<AnalysisResult> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      analysis: null,
      source: 'transcript',
      confidence: 0,
      error: 'OPENAI_API_KEY not set',
    };
  }

  if (!transcript || transcript.trim().length < 100) {
    console.log('[content-analyzer] Transcript too short, falling back to metadata analysis');
    return analyzeMetadata(metadata);
  }

  console.log(`[content-analyzer] Analyzing transcript (${transcript.length} chars) with ${ANALYSIS_MODEL}`);

  const systemPrompt = `You are an expert educational content analyst. Your job is to analyze video transcripts and extract detailed, SPECIFIC information about what the video teaches.

CRITICAL: Be specific, not vague. Instead of "covers physics concepts", say "derives the blackbody radiation formula using Planck's quantization hypothesis".

Output valid JSON only, no markdown or explanations.`;

  const userPrompt = `Analyze this educational video transcript and extract detailed information.

VIDEO TITLE: ${metadata.title}
CHANNEL: ${metadata.channelName || 'Unknown'}
${metadata.description ? `DESCRIPTION: ${metadata.description.substring(0, 500)}` : ''}

TRANSCRIPT:
${transcript.substring(0, 12000)}

Extract and return this JSON structure:
{
  "detailed_summary": "2-3 sentences describing SPECIFICALLY what this video teaches, including any formulas, methods, or techniques demonstrated",
  "concepts_taught": ["array of SPECIFIC concepts - not vague terms like 'physics' but specific like 'Planck constant derivation from blackbody spectrum'"],
  "prerequisites_assumed": ["specific knowledge the viewer should already have"],
  "difficulty_assessment": "beginner/intermediate/advanced - with brief justification",
  "formulas_covered": ["any equations, formulas, or mathematical relationships shown - use LaTeX-like notation"],
  "problem_types": ["types of problems or calculations demonstrated"],
  "teaching_style": "one of: lecture, worked_examples, visual_explanation, interactive, mixed",
  "key_topics": ["3-5 main topics this video would help a student with"]
}

Be SPECIFIC and DETAILED. This information will be used to match students with exactly the right resources.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[content-analyzer] OpenAI API error: ${response.status}`, errorText);
      
      // Fall back to metadata analysis on API error
      console.log('[content-analyzer] Falling back to metadata analysis');
      return analyzeMetadata(metadata);
    }

    const data = await response.json();
    const tokensUsed = data.usage?.total_tokens || 0;
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[content-analyzer] No content in response');
      return analyzeMetadata(metadata);
    }

    const analysis = JSON.parse(content) as ContentAnalysis;
    
    // Validate and clean the analysis
    const validatedAnalysis = validateAnalysis(analysis);

    console.log(`[content-analyzer] Transcript analysis complete: ${validatedAnalysis.concepts_taught.length} concepts identified`);

    return {
      success: true,
      analysis: validatedAnalysis,
      source: 'transcript',
      confidence: 1.0, // Full confidence for transcript-based analysis
      tokens_used: tokensUsed,
    };

  } catch (error) {
    console.error('[content-analyzer] Error analyzing transcript:', error);
    return analyzeMetadata(metadata);
  }
}

// ============================================================================
// METADATA-ONLY ANALYSIS (Lower Confidence - Fallback)
// ============================================================================

/**
 * Analyze video based only on title and description (when transcript unavailable)
 * Returns lower confidence score since this is less accurate
 * 
 * @param metadata - Video title, description, channel info
 * @returns Content analysis with lower confidence
 */
export async function analyzeMetadata(
  metadata: VideoMetadata
): Promise<AnalysisResult> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      analysis: null,
      source: 'metadata',
      confidence: 0,
      error: 'OPENAI_API_KEY not set',
    };
  }

  console.log(`[content-analyzer] Analyzing metadata only for: ${metadata.title}`);

  const systemPrompt = `You are an educational content analyst. Analyze video metadata to infer what the video likely teaches.

Since you only have the title and description (no transcript), be appropriately cautious in your analysis. Focus on what can be reliably inferred.

Output valid JSON only.`;

  const userPrompt = `Analyze this educational video based on its metadata (no transcript available).

TITLE: ${metadata.title}
CHANNEL: ${metadata.channelName || 'Unknown'}
DESCRIPTION: ${metadata.description || 'No description available'}
DURATION: ${metadata.duration_seconds ? `${Math.round(metadata.duration_seconds / 60)} minutes` : 'Unknown'}

Based on this metadata, infer what the video likely covers. Return JSON:
{
  "detailed_summary": "1-2 sentences describing what this video likely covers based on the title/description",
  "concepts_taught": ["inferred concepts based on title - be conservative"],
  "prerequisites_assumed": ["likely prerequisites based on topic"],
  "difficulty_assessment": "estimated difficulty with reasoning",
  "formulas_covered": ["any formulas mentioned or implied"],
  "problem_types": ["types of problems this video might address"],
  "teaching_style": "best guess: lecture, worked_examples, visual_explanation, interactive, or mixed",
  "key_topics": ["3-5 topics this video likely helps with"]
}

Be conservative - only include what can be reasonably inferred from the metadata.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[content-analyzer] OpenAI API error: ${response.status}`, errorText);
      
      // Return a basic fallback analysis
      return createFallbackAnalysis(metadata);
    }

    const data = await response.json();
    const tokensUsed = data.usage?.total_tokens || 0;
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return createFallbackAnalysis(metadata);
    }

    const analysis = JSON.parse(content) as ContentAnalysis;
    const validatedAnalysis = validateAnalysis(analysis);

    console.log(`[content-analyzer] Metadata analysis complete: ${validatedAnalysis.concepts_taught.length} concepts inferred`);

    return {
      success: true,
      analysis: validatedAnalysis,
      source: 'metadata',
      confidence: 0.5, // Lower confidence for metadata-only analysis
      tokens_used: tokensUsed,
    };

  } catch (error) {
    console.error('[content-analyzer] Error analyzing metadata:', error);
    return createFallbackAnalysis(metadata);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a basic fallback analysis when API calls fail
 */
function createFallbackAnalysis(metadata: VideoMetadata): AnalysisResult {
  // Extract basic info from title
  const title = metadata.title || 'Unknown Video';
  const words = title.split(/\s+/).filter(w => w.length > 3);
  
  return {
    success: true,
    analysis: {
      detailed_summary: `Educational video: ${title}`,
      concepts_taught: words.slice(0, 5),
      prerequisites_assumed: ['basic understanding of the subject'],
      difficulty_assessment: 'intermediate - unknown',
      formulas_covered: [],
      problem_types: [],
      teaching_style: 'mixed',
      key_topics: words.slice(0, 3),
    },
    source: 'metadata',
    confidence: 0.2, // Very low confidence for fallback
  };
}

/**
 * Validate and clean analysis object to ensure all required fields exist
 */
function validateAnalysis(analysis: Partial<ContentAnalysis>): ContentAnalysis {
  return {
    detailed_summary: analysis.detailed_summary || 'No summary available',
    concepts_taught: ensureStringArray(analysis.concepts_taught),
    prerequisites_assumed: ensureStringArray(analysis.prerequisites_assumed),
    difficulty_assessment: analysis.difficulty_assessment || 'intermediate',
    formulas_covered: ensureStringArray(analysis.formulas_covered),
    problem_types: ensureStringArray(analysis.problem_types),
    teaching_style: validateTeachingStyle(analysis.teaching_style),
    key_topics: ensureStringArray(analysis.key_topics),
    estimated_duration_minutes: analysis.estimated_duration_minutes,
  };
}

function ensureStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function validateTeachingStyle(style: unknown): ContentAnalysis['teaching_style'] {
  const validStyles = ['lecture', 'worked_examples', 'visual_explanation', 'interactive', 'mixed'];
  if (typeof style === 'string' && validStyles.includes(style)) {
    return style as ContentAnalysis['teaching_style'];
  }
  return 'mixed';
}

/**
 * Generate a rich topic signature from analysis for embedding
 * This creates a comprehensive text that captures what the resource contains
 */
export function generateRichSignature(analysis: ContentAnalysis, metadata?: VideoMetadata): string {
  const parts: string[] = [];

  // Core summary
  parts.push(`This resource teaches: ${analysis.detailed_summary}`);

  // Specific concepts
  if (analysis.concepts_taught.length > 0) {
    parts.push(`\nSpecific concepts covered:\n${analysis.concepts_taught.map(c => `- ${c}`).join('\n')}`);
  }

  // Prerequisites
  if (analysis.prerequisites_assumed.length > 0) {
    parts.push(`\nPrerequisites needed: ${analysis.prerequisites_assumed.join(', ')}`);
  }

  // Difficulty
  parts.push(`\nDifficulty: ${analysis.difficulty_assessment}`);

  // Formulas
  if (analysis.formulas_covered.length > 0) {
    parts.push(`\nFormulas and equations: ${analysis.formulas_covered.join(', ')}`);
  }

  // Problem types
  if (analysis.problem_types.length > 0) {
    parts.push(`\nProblem types addressed: ${analysis.problem_types.join(', ')}`);
  }

  // Teaching style
  parts.push(`\nTeaching style: ${analysis.teaching_style}`);

  // Key topics for matching
  if (analysis.key_topics.length > 0) {
    parts.push(`\nKey topics for student matching: ${analysis.key_topics.join(', ')}`);
  }

  return parts.join('').trim();
}

