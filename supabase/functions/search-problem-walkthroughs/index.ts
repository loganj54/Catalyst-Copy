// ============================================================================
// SEARCH PROBLEM WALKTHROUGHS EDGE FUNCTION
// ============================================================================
// Specialized function for finding problem-solving walkthrough videos
// Uses problem_solving_queries from the learning structure to find videos
// that demonstrate how to solve similar problems step-by-step
//
// FLOW:
// 1. Receive unit info with problem_solving_queries
// 2. Search YouTube for problem walkthrough videos
// 3. Analyze transcripts to verify problem-solving content
// 4. Store results with is_problem_walkthrough=true flag
//
// INPUT: { blueprint_id, unit_id, topic, problem_solving_queries[] }
// OUTPUT: Array of problem walkthrough videos
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  createSupabaseClient, 
  createSupabaseClientWithAuth,
} from '../_shared/supabase-client.ts';
import { 
  generateEmbedding, 
  createTopicEmbeddingText,
  createRichSignatureText,
  formatVectorForPostgres,
} from '../_shared/embeddings.ts';
import { 
  fetchTranscript, 
  extractVideoId,
  truncateTranscript,
} from '../_shared/transcript.ts';
import { 
  analyzeTranscript, 
  analyzeMetadata,
  type ContentAnalysis,
} from '../_shared/content-analyzer.ts';
import { PROMPTS } from '../_shared/prompts.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
const SIMILARITY_THRESHOLD = 0.95; // 95% similarity required for cache hit
const MAX_SEARCH_RESULTS = 3;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SearchRequest {
  blueprint_id: string;
  unit_id: string;
  topic: string;
  description?: string;
  learning_objective?: string;
  problem_statement?: string; // The actual problem text from the homework
  problem_details?: {
    original_problem_id?: string;
    key_equations?: string[];
    common_mistakes?: string[];
    given_variables?: Array<{ symbol: string; value: string; unit?: string }>;
    unknown_variables?: Array<{ symbol: string; description: string }>;
  };
  problem_solving_queries: Array<{
    query: string;
    query_type: string;
    priority: number;
  }>;
}

interface ResourceResult {
  id?: string;
  url: string;
  title: string;
  description: string;
  platform: string;
  channel_name?: string;
  channel_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  topic_signature: string;
  concepts_covered: string[];
  difficulty_level: string;
  quality_score: number;
  similarity?: number;
  from_cache: boolean;
  query_type?: string;
  query_used?: string;
  transcript_analyzed?: boolean;
  transcript_source?: 'auto_generated' | 'manual' | 'metadata_only' | 'failed' | 'none';
  content_analysis?: ContentAnalysis;
  analysis_confidence?: number;
  resource_explanation?: string;
}

// ============================================================================
// SEARCH QUERY SIMPLIFICATION
// ============================================================================

/**
 * Simplify complex academic topics into searchable YouTube-friendly terms
 * Same logic as search-resources but optimized for problem-solving queries
 */
function simplifyTopicForSearch(topic: string): string {
  // Remove common academic modifiers that make searches too specific
  const wordsToRemove = [
    'calculations?', 'analysis', 'applications?', 'methods?', 'techniques?',
    'optimization', 'numerical', 'computational', 'advanced', 'detailed',
    'comprehensive', 'and', '&', 'using', 'with', 'for', 'in'
  ];
  
  let simplified = topic;
  
  // Remove problematic words
  const removePattern = new RegExp(`\\b(${wordsToRemove.join('|')})\\b`, 'gi');
  simplified = simplified.replace(removePattern, ' ');
  
  // Clean up multiple spaces
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  // If still too long (>6 words), take first 4 words
  const words = simplified.split(' ');
  if (words.length > 6) {
    simplified = words.slice(0, 4).join(' ');
  }
  
  // Common term replacements for better searchability
  const replacements: Record<string, string> = {
    'spectral radiance': 'blackbody radiation',
    'spectral fractions': 'blackbody radiation',
    "planck's distribution": "planck's law",
    'navier-stokes': 'navier stokes',
    'finite element': 'FEA',
    'computational fluid dynamics': 'CFD',
    'effectiveness-ntu': 'NTU method',
  };
  
  // Apply replacements (case-insensitive)
  for (const [complex, simple] of Object.entries(replacements)) {
    const regex = new RegExp(complex, 'gi');
    simplified = simplified.replace(regex, simple);
  }
  
  return simplified;
}

// ============================================================================
// YOUTUBE SEARCH FOR PROBLEM WALKTHROUGHS
// ============================================================================

async function searchYouTubeForWalkthroughs(
  topic: string,
  problemSolvingQueries: Array<{ query: string; query_type: string; priority: number }>,
  description?: string,
  problemStatement?: string,
  problemDetails?: {
    key_equations?: string[];
    common_mistakes?: string[];
    given_variables?: Array<{ symbol: string; value: string; unit?: string }>;
    unknown_variables?: Array<{ symbol: string; description: string }>;
  }
): Promise<ResourceResult[]> {
  if (!YOUTUBE_API_KEY) {
    console.log('[search-problem-walkthroughs] No YouTube API key available');
    return [];
  }

  const results: ResourceResult[] = [];
  const seenVideoIds = new Set<string>();

  // Build search queries with priority:
  // 1. Exact problem-based queries (if we have problem statement)
  // 2. AI-generated problem_solving_queries
  // 3. Enhanced queries with equations/context
  
  const queriesToTry: string[] = [];
  
  // PRIORITY 1: Create queries from the actual problem statement
  if (problemStatement && problemStatement.length > 20) {
    console.log('[search-problem-walkthroughs] Creating queries from problem statement');
    
    // Extract key numerical values and conditions from problem statement
    const numbers = problemStatement.match(/\d+\.?\d*/g) || [];
    const units = problemStatement.match(/\b(kg|m|s|N|J|W|°C|K|Pa|mol|A|V|Ω|Hz|rad)\b/g) || [];
    
    // Create a concise search string from the problem (first 100 chars + key numbers)
    const problemSnippet = problemStatement
      .substring(0, 100)
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Build queries that include problem specifics
    if (problemDetails?.given_variables && problemDetails.given_variables.length > 0) {
      const givenValues = problemDetails.given_variables
        .slice(0, 2) // Use first 2 given values
        .map(v => `${v.symbol}=${v.value}${v.unit || ''}`)
        .join(' ');
      
      queriesToTry.push(`${topic} problem given ${givenValues} youtube`);
    }
    
    if (problemDetails?.unknown_variables && problemDetails.unknown_variables.length > 0) {
      const unknownDesc = problemDetails.unknown_variables[0].description;
      queriesToTry.push(`find ${unknownDesc} ${topic} example youtube`);
    }
    
    // Add a query with key numbers from the problem
    if (numbers.length >= 2) {
      const keyNumbers = numbers.slice(0, 3).join(' ');
      queriesToTry.push(`${topic} problem ${keyNumbers} example solved youtube`);
    }
  }
  
  // PRIORITY 2: Use AI-generated problem_solving_queries (with simplification)
  const aiQueries = problemSolvingQueries
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 2)
    .map(q => {
      let query = q.query;
      
      // Simplify the query if it's too complex
      const simplified = simplifyTopicForSearch(query);
      
      // Enhance with problem context if available
      const hasProblemKeywords = /example|problem|solve|calculation|walkthrough|step by step|homework/i.test(simplified);
      if (!hasProblemKeywords && problemDetails?.key_equations && problemDetails.key_equations.length > 0) {
        const mainEquation = problemDetails.key_equations[0];
        query = `${simplified} ${mainEquation} example problem`;
      } else {
        query = simplified;
      }
      
      return query;
    });
  
  queriesToTry.push(...aiQueries);
  
  // PRIORITY 3: Fallback simplified queries based on topic
  if (queriesToTry.length < 5) {
    const simplifiedTopic = simplifyTopicForSearch(topic);
    queriesToTry.push(`${simplifiedTopic} example problem solved youtube`);
    queriesToTry.push(`${simplifiedTopic} homework problem walkthrough youtube`);
  }
  
  // Take top 5 queries to search
  const finalQueries = queriesToTry.slice(0, 5);

  console.log('[search-problem-walkthroughs] Searching YouTube with queries:', finalQueries);

  for (const query of finalQueries) {
    if (results.length >= MAX_SEARCH_RESULTS) break;

    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('maxResults', '8'); // Get more results to filter
      searchUrl.searchParams.set('relevanceLanguage', 'en');
      searchUrl.searchParams.set('safeSearch', 'strict');
      searchUrl.searchParams.set('videoCategoryId', '27'); // Education category
      searchUrl.searchParams.set('order', 'relevance'); // Prioritize relevance over recency
      searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

      console.log(`[search-problem-walkthroughs] YouTube search: "${query}"`);
      
      const response = await fetch(searchUrl.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[search-problem-walkthroughs] YouTube API error:', response.status, errorText);
        continue;
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        console.log(`[search-problem-walkthroughs] Found ${data.items.length} YouTube results`);
        
        for (const item of data.items) {
          if (results.length >= MAX_SEARCH_RESULTS) break;
          
          const videoId = item.id?.videoId;
          if (!videoId || seenVideoIds.has(videoId)) continue;
          
          const snippet = item.snippet || {};
          const title = snippet.title || 'YouTube Video';
          const description = snippet.description || '';
          
          // Filter: Prioritize videos that look like problem walkthroughs
          // Check title and description for problem-solving indicators
          const combinedText = `${title} ${description}`.toLowerCase();
          const problemSolvingScore = calculateProblemSolvingScore(combinedText);
          
          // Only include videos with a decent problem-solving score (> 0.3)
          if (problemSolvingScore < 0.3) {
            console.log(`[search-problem-walkthroughs] Skipping low-score video (${problemSolvingScore.toFixed(2)}): ${title}`);
            continue;
          }
          
          seenVideoIds.add(videoId);
          
          results.push({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: title,
            description: description.substring(0, 500),
            platform: 'YouTube',
            channel_name: snippet.channelTitle || null,
            channel_url: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : null,
            thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            duration_seconds: null,
            topic_signature: `Problem walkthrough video about ${topic}: ${title}. ${description.substring(0, 200)}`,
            concepts_covered: [topic],
            difficulty_level: 'intermediate',
            quality_score: problemSolvingScore,
            from_cache: false,
            query_used: query,
          });
          
          console.log(`[search-problem-walkthroughs] Added video (score: ${problemSolvingScore.toFixed(2)}): ${title}`);
        }
      }
    } catch (error) {
      console.error(`[search-problem-walkthroughs] Error searching YouTube:`, error);
    }
  }

  // Sort by quality score (problem-solving relevance)
  results.sort((a, b) => b.quality_score - a.quality_score);

  console.log(`[search-problem-walkthroughs] Found ${results.length} walkthrough videos`);
  return results;
}

/**
 * Calculate a score (0-1) indicating how likely a video is a problem walkthrough
 * based on keywords in title and description
 */
function calculateProblemSolvingScore(text: string): number {
  let score = 0.0;
  
  // Strong problem-solving indicators (+0.3 each)
  const strongKeywords = [
    'example problem',
    'worked example',
    'sample problem',
    'practice problem',
    'homework problem',
    'step by step',
    'walkthrough',
    'how to solve',
    'solution',
    'solving'
  ];
  
  // Medium indicators (+0.2 each)
  const mediumKeywords = [
    'example',
    'problem',
    'calculation',
    'calculate',
    'solve',
    'find the',
    'determine',
    'given'
  ];
  
  // Negative indicators (-0.3 each) - theory-only videos
  const negativeKeywords = [
    'introduction to',
    'basics of',
    'what is',
    'definition',
    'theory',
    'explained',
    'understanding',
    'concept'
  ];
  
  // Check for strong keywords
  for (const keyword of strongKeywords) {
    if (text.includes(keyword)) {
      score += 0.3;
    }
  }
  
  // Check for medium keywords (max 2 to avoid over-counting)
  let mediumCount = 0;
  for (const keyword of mediumKeywords) {
    if (text.includes(keyword) && mediumCount < 2) {
      score += 0.2;
      mediumCount++;
    }
  }
  
  // Check for negative keywords
  for (const keyword of negativeKeywords) {
    if (text.includes(keyword)) {
      score -= 0.3;
    }
  }
  
  // Clamp score between 0 and 1
  return Math.max(0.0, Math.min(1.0, score));
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const supabase = createSupabaseClient();

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const body: SearchRequest = await req.json();
    const { blueprint_id, unit_id, topic, description, learning_objective, problem_statement, problem_solving_queries, problem_details } = body;

    console.log(`[search-problem-walkthroughs] Starting search for unit: ${unit_id}`);
    console.log(`[search-problem-walkthroughs] Topic: ${topic}`);
    console.log(`[search-problem-walkthroughs] Problem solving queries: ${problem_solving_queries?.length || 0}`);
    console.log(`[search-problem-walkthroughs] Has problem statement: ${!!problem_statement}`);

    if (!problem_solving_queries || problem_solving_queries.length === 0) {
      throw new Error('No problem_solving_queries provided. This endpoint requires problem-solving queries.');
    }

    // Get authenticated client
    const authClient = createSupabaseClientWithAuth(authHeader);
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Could not verify user');
    }

    // Search YouTube for problem walkthrough videos
    console.log('[search-problem-walkthroughs] Searching YouTube for walkthrough videos...');
    const resources = await searchYouTubeForWalkthroughs(
      topic, 
      problem_solving_queries,
      description,
      problem_statement,
      problem_details
    );

    if (resources.length === 0) {
      console.log('[search-problem-walkthroughs] No walkthrough videos found');
      return new Response(
        JSON.stringify({ 
          success: true,
          resources: [],
          message: 'No problem walkthrough videos found. Try different search terms.',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Analyze transcripts for problem-solving content
    console.log('[search-problem-walkthroughs] Analyzing transcripts...');
    const analyzedResources: ResourceResult[] = [];
    
    for (const resource of resources) {
      try {
        const videoId = extractVideoId(resource.url);
        if (!videoId) {
          console.log(`[search-problem-walkthroughs] Could not extract video ID from: ${resource.url}`);
          analyzedResources.push(resource);
          continue;
        }

        // Fetch transcript
        const transcriptResult = await fetchTranscript(videoId);
        
        if (transcriptResult.success && transcriptResult.transcript) {
          // Analyze transcript for problem-solving content
          const truncated = truncateTranscript(transcriptResult.transcript, 8000);
          const analysis = await analyzeTranscript(
            truncated,
            topic,
            description || '',
            learning_objective || ''
          );
          
          analyzedResources.push({
            ...resource,
            transcript_analyzed: true,
            transcript_source: transcriptResult.source,
            content_analysis: analysis,
            analysis_confidence: analysis.relevance_score,
          });
          
          console.log(`[search-problem-walkthroughs] Analyzed: ${resource.title} (confidence: ${analysis.relevance_score})`);
        } else {
          // Fallback to metadata analysis
          const analysis = await analyzeMetadata(
            resource.title,
            resource.description,
            topic,
            description || '',
            learning_objective || ''
          );
          
          analyzedResources.push({
            ...resource,
            transcript_analyzed: false,
            transcript_source: 'metadata_only',
            content_analysis: analysis,
            analysis_confidence: analysis.relevance_score,
          });
          
          console.log(`[search-problem-walkthroughs] Metadata only: ${resource.title}`);
        }
      } catch (error) {
        console.error(`[search-problem-walkthroughs] Error analyzing resource:`, error);
        analyzedResources.push(resource);
      }
    }

    // Sort by analysis confidence
    analyzedResources.sort((a, b) => (b.analysis_confidence || 0) - (a.analysis_confidence || 0));

    // Generate contextual explanations for the resources
    console.log('[search-problem-walkthroughs] Generating resource explanations...');
    try {
      const explanationResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024, // Reduced from 2048 to avoid rate limits
          temperature: 0.4,
          system: PROMPTS.resourceExplanation.system,
          messages: [{
            role: 'user',
            content: PROMPTS.resourceExplanation.user(
              topic,
              description,
              learning_objective,
              analyzedResources.map(r => ({
                url: r.url,
                title: r.title,
                channel_name: r.channel_name,
                description: r.description,
                concepts_covered: r.content_analysis?.concepts_taught || r.concepts_covered,
                difficulty_level: r.difficulty_level,
              }))
            ),
          }],
        }),
      });

      if (explanationResponse.ok) {
        const explanationData = await explanationResponse.json();
        const explanationText = explanationData.content?.[0]?.text;
        
        if (explanationText) {
          const explanations = JSON.parse(explanationText);
          
          // Match explanations to resources by URL
          for (const resource of analyzedResources) {
            const explanation = explanations.explanations?.find((e: any) => e.url === resource.url);
            if (explanation) {
              resource.resource_explanation = explanation.explanation;
            }
          }
        }
      }
    } catch (error) {
      console.error('[search-problem-walkthroughs] Error generating explanations:', error);
    }

    // Store resources in database with is_problem_walkthrough=true
    console.log('[search-problem-walkthroughs] Storing resources in database...');
    
    for (const resource of analyzedResources) {
      try {
        // Generate embedding for the resource
        const embeddingText = createRichSignatureText(
          resource.title,
          resource.description,
          resource.content_analysis?.concepts_taught || resource.concepts_covered,
          resource.difficulty_level
        );
        
        const embedding = await generateEmbedding(embeddingText);
        const embeddingVector = formatVectorForPostgres(embedding);

        // Store in curated_resources
        const { data: curatedResource, error: curatedError } = await supabase
          .from('curated_resources')
          .upsert({
            url: resource.url,
            title: resource.title,
            description: resource.description,
            platform: resource.platform,
            channel_name: resource.channel_name,
            channel_url: resource.channel_url,
            thumbnail_url: resource.thumbnail_url,
            duration_seconds: resource.duration_seconds,
            topic_signature: resource.topic_signature,
            concepts_covered: resource.concepts_covered,
            difficulty_level: resource.difficulty_level,
            quality_score: resource.quality_score,
            embedding: embeddingVector,
            transcript_analyzed: resource.transcript_analyzed,
            transcript_source: resource.transcript_source,
            content_analysis: resource.content_analysis,
          }, {
            onConflict: 'url',
          })
          .select()
          .single();

        if (curatedError) {
          console.error('[search-problem-walkthroughs] Error storing curated resource:', curatedError);
          continue;
        }

        // Link to blueprint with is_problem_walkthrough=true
        const { error: linkError } = await supabase
          .from('blueprint_topic_resources')
          .insert({
            blueprint_id,
            unit_id,
            resource_id: curatedResource.id,
            relevance_score: resource.analysis_confidence || resource.quality_score,
            from_cache: resource.from_cache,
            resource_explanation: resource.resource_explanation,
            is_problem_walkthrough: true, // Mark as problem walkthrough
          });

        if (linkError) {
          console.error('[search-problem-walkthroughs] Error linking resource:', linkError);
        }
      } catch (error) {
        console.error('[search-problem-walkthroughs] Error storing resource:', error);
      }
    }

    console.log('[search-problem-walkthroughs] Complete!');

    return new Response(
      JSON.stringify({ 
        success: true,
        resources: analyzedResources,
        search_metadata: {
          queries_used: problem_solving_queries.map(q => q.query),
          search_method: 'youtube_api',
          total_results: analyzedResources.length,
        },
        analysis_metadata: {
          transcript_count: analyzedResources.filter(r => r.transcript_analyzed).length,
          metadata_only_count: analyzedResources.filter(r => !r.transcript_analyzed).length,
          average_confidence: analyzedResources.reduce((sum, r) => sum + (r.analysis_confidence || 0), 0) / analyzedResources.length,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[search-problem-walkthroughs] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || 'Unknown error occurred',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

