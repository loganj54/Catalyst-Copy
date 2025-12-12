// ============================================================================
// GENERATE BLUEPRINT EDGE FUNCTION (ALL-IN-ONE)
// ============================================================================
// This function handles everything: document analysis, resource searching,
// and blueprint compilation - all in one function to avoid auth issues.
// Supports step-by-step execution for debugging via the 'step' parameter.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseClientWithAuth } from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = 'gpt-4-turbo-preview';

interface GenerateRequest {
  blueprint_id: string;
  step?: 'analyze' | 'search' | 'compile' | 'all';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let blueprint_id: string | null = null;
  const supabase = createSupabaseClient();

  try {
    // Check for OpenAI API key first
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured. Run: supabase secrets set OPENAI_API_KEY=your-key');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const body: GenerateRequest = await req.json();
    blueprint_id = body.blueprint_id;
    const step = body.step || 'all'; // Default to 'all' for backwards compatibility

    if (!blueprint_id) {
      throw new Error('Missing required field: blueprint_id');
    }

    console.log(`Starting blueprint generation for: ${blueprint_id}, step: ${step}`);

    // Use auth client to verify user owns this blueprint
    const authClient = createSupabaseClientWithAuth(authHeader);
    const { data: blueprint, error: blueprintError } = await authClient
      .from('blueprints')
      .select('*')
      .eq('id', blueprint_id)
      .single();

    if (blueprintError || !blueprint) {
      console.error('Blueprint fetch error:', blueprintError);
      throw new Error('Blueprint not found or access denied');
    }

    console.log('Blueprint found:', blueprint.title || blueprint.id);

    // Verify the blueprint exists in the database using service role (in case of RLS issues)
    const { data: verifyBlueprint, error: verifyError } = await supabase
      .from('blueprints')
      .select('id')
      .eq('id', blueprint_id)
      .single();

    if (verifyError || !verifyBlueprint) {
      console.error('Blueprint verification failed:', verifyError);
      throw new Error('Blueprint not found in database. It may have been deleted.');
    }

    console.log('Blueprint verified in database');

    // For 'all' step only: Check if already generated
    if (step === 'all' && blueprint.generation_status === 'completed' && blueprint.generated_content) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          step: 'all',
          status: 'already_completed',
          content: blueprint.generated_content,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Variable to hold the analysis result across steps
    let analysisResult: any = null;

    // =========================================================================
    // STEP 1: Analyze Document
    // =========================================================================
    if (step === 'analyze' || step === 'all') {
      console.log('Step 1: Analyzing document...');
      
      // Delete any existing analysis for this blueprint (to allow retry)
      const { error: deleteError } = await supabase
        .from('document_analyses')
        .delete()
        .eq('blueprint_id', blueprint_id);
      
      if (deleteError) {
        console.log('No existing analysis to delete or delete failed:', deleteError);
      }

      // Update status to analyzing
      await supabase
        .from('blueprints')
        .update({ 
          generation_status: 'analyzing',
          generation_started_at: new Date().toISOString(),
          generation_error: null,
        })
        .eq('id', blueprint_id);

      // Get content to analyze
      const textContent = blueprint.description || blueprint.content?.textInput || '';
      const fileUrl = blueprint.file_metadata?.url || blueprint.content?.fileUpload?.url;

      console.log('=== CONTENT SOURCES ===');
      console.log('blueprint.description:', blueprint.description?.substring(0, 200) || '(empty)');
      console.log('blueprint.content?.textInput:', blueprint.content?.textInput?.substring(0, 200) || '(empty)');
      console.log('fileUrl:', fileUrl || '(none)');
      console.log('textContent extracted:', textContent?.substring(0, 200) || '(empty)');

      if (!textContent && !fileUrl) {
        throw new Error('No content to analyze - please provide a document or text');
      }

      // Prepare content for analysis
      let contentToAnalyze = textContent || '';
      
      if (fileUrl) {
        console.log('PDF URL found, will include in analysis prompt');
        contentToAnalyze = contentToAnalyze 
          ? `${contentToAnalyze}\n\n[Note: A PDF document was also uploaded: ${fileUrl}]`
          : `[A PDF document was uploaded: ${fileUrl}. Please analyze based on the context provided.]`;
      }

      console.log('=== FINAL CONTENT TO ANALYZE ===');
      console.log('Content length:', contentToAnalyze.length);
      console.log('Content preview:', contentToAnalyze.substring(0, 500));
      console.log('Task type:', blueprint.task_type);

      // Call OpenAI for analysis
      const analysis = await analyzeWithOpenAI(contentToAnalyze, blueprint.task_type);
      console.log('Analysis complete, problems found:', analysis.problems?.length || 0);

      // Calculate total estimated time
      const totalTimeMinutes = analysis.study_recommendations?.total_time_minutes || 
        analysis.problems?.reduce((sum: number, p: any) => sum + (p.estimated_minutes || 0), 0) || 60;

      // Map course_level to difficulty_level for backwards compatibility
      const difficultyMap: Record<string, string> = {
        'introductory': 'beginner',
        'intermediate': 'intermediate', 
        'advanced': 'advanced',
        'graduate': 'expert'
      };

      // Store the analysis in the database
      // IMPORTANT: raw_analysis is the source of truth - other fields are for querying only
      console.log('=== STORING ANALYSIS ===');
      console.log('Problems found:', analysis.problems?.length || 0);
      console.log('Prerequisites found:', analysis.prerequisites?.length || 0);
      
      const insertData = {
        blueprint_id,
        user_id: blueprint.user_id,
        topics: [], // Deprecated - use raw_analysis.problems
        prerequisites: analysis.prerequisites || [],
        problem_types: [], // Deprecated - problems are in raw_analysis.problems
        difficulty_level: difficultyMap[analysis.course_level] || 'intermediate',
        estimated_study_time_minutes: totalTimeMinutes,
        raw_analysis: analysis,
        source_type: fileUrl && textContent ? 'both' : (fileUrl ? 'pdf' : 'text'),
        model_used: OPENAI_MODEL,
      };
      
      console.log('Insert data:', JSON.stringify(insertData, null, 2));
      
      const { data: newAnalysis, error: insertError } = await supabase
        .from('document_analyses')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        console.error('Insert error details:', JSON.stringify(insertError));
        throw new Error(`Database error: ${insertError.message}`);
      }

      console.log('Analysis saved to database with id:', newAnalysis?.id);
      console.log('Saved analysis data:', JSON.stringify(newAnalysis, null, 2));

      // Store the analysis result for use in subsequent steps
      analysisResult = newAnalysis;

      // If only running analyze step, return here
      if (step === 'analyze') {
        console.log('=== RETURNING ANALYZE STEP RESULT ===');
        const result = { 
          success: true,
          step: 'analyze',
          status: 'analysis_complete',
          analysis: analysis,
          analysis_id: newAnalysis?.id,
          stored_analysis: newAnalysis,
          content_analyzed: {
            length: contentToAnalyze.length,
            preview: contentToAnalyze.substring(0, 200),
            had_text: !!textContent,
            had_file: !!fileUrl,
          },
          message: 'Document analysis complete. You can now run Step 2 (Search Resources).',
        };
        console.log('Result:', JSON.stringify(result, null, 2));
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // =========================================================================
    // STEP 2: Search for Resources
    // =========================================================================
    
    // For search/compile steps (NOT all - we already have it from above), we need to fetch existing analysis
    if (step === 'search' || step === 'compile') {
      // Fetch existing analysis
      console.log('Fetching existing analysis for step:', step);
      const { data: existingAnalysis, error: analysisError } = await supabase
        .from('document_analyses')
        .select('*')
        .eq('blueprint_id', blueprint_id)
        .single();

      if (analysisError) {
        console.error('Error fetching analysis:', analysisError);
      }

      if (!existingAnalysis) {
        throw new Error('No document analysis found. Please run Step 1 (Analyze Document) first.');
      }
      analysisResult = existingAnalysis;
      console.log('Using existing analysis:', analysisResult.id);
    }
    
    // Make sure we have an analysis result at this point
    if (!analysisResult && (step === 'search' || step === 'compile' || step === 'all')) {
      throw new Error('Analysis result is missing. This should not happen - please report this bug.');
    }

    let resources: any[] = [];
    
    if (step === 'search' || step === 'all') {
      console.log('Step 2: Searching for resources...');
      
      await supabase
        .from('blueprints')
        .update({ generation_status: 'searching' })
        .eq('id', blueprint_id);

      resources = await searchForResources(
        analysisResult.raw_analysis || analysisResult,
        blueprint.task_type
      );
      
      console.log('Resources found:', resources.length);

      // Cache the resources
      for (const resource of resources) {
        try {
          await supabase
            .from('curated_resources')
            .upsert({
              url: resource.url,
              title: resource.title,
              description: resource.description,
              resource_type: resource.resource_type || 'video',
              platform: resource.platform || 'other',
              topic_tags: resource.topic_tags || [],
              difficulty_level: resource.difficulty_level,
              quality_score: resource.quality_score || 0.5,
              quality_reasoning: resource.quality_reasoning,
              search_context: {
                task_type: blueprint.task_type,
                blueprint_id: blueprint_id,
              },
              usage_count: 1,
              last_used_at: new Date().toISOString(),
            }, {
              onConflict: 'url',
            });
        } catch (cacheErr) {
          console.log('Resource cache error (continuing):', cacheErr);
        }
      }

      // If only running search step, return here
      if (step === 'search') {
        return new Response(
          JSON.stringify({ 
            success: true,
            step: 'search',
            status: 'search_complete',
            resources_count: resources.length,
            resources: resources,
            message: 'Resource search complete. You can now run Step 3 (Compile Blueprint).',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // =========================================================================
    // STEP 3: Compile Final Blueprint
    // =========================================================================
    if (step === 'compile' || step === 'all') {
      console.log('Step 3: Compiling blueprint...');
      
      // If compile-only, we need to search for resources first
      if (step === 'compile') {
        console.log('Compile step: searching for resources...');
        resources = await searchForResources(
          analysisResult.raw_analysis || analysisResult,
          blueprint.task_type
        );
        console.log('Resources found for compile:', resources.length);
      }

      await supabase
        .from('blueprints')
        .update({ generation_status: 'generating' })
        .eq('id', blueprint_id);

      const compiledBlueprint = await compileBlueprint(
        analysisResult.raw_analysis || analysisResult,
        resources,
        blueprint.task_type
      );

      console.log('Blueprint compiled, sections:', compiledBlueprint.sections?.length || 0);

      // Save and complete
      await supabase
        .from('blueprints')
        .update({ 
          generation_status: 'completed',
          generation_completed_at: new Date().toISOString(),
          generated_content: compiledBlueprint,
        })
        .eq('id', blueprint_id);

      console.log('Blueprint generation complete!');

      return new Response(
        JSON.stringify({ 
          success: true,
          step: step,
          status: 'completed',
          content: compiledBlueprint,
          analysis: analysisResult.raw_analysis,
          resources_count: resources.length,
          message: 'Blueprint generation complete!',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Default response (shouldn't reach here)
    return new Response(
      JSON.stringify({ success: true, status: 'unknown_step' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in generate-blueprint:', error);
    console.error('Error message:', error?.message);

    // Try to update blueprint with error status
    if (blueprint_id) {
      try {
        await supabase
          .from('blueprints')
          .update({ 
            generation_status: 'failed',
            generation_error: error?.message || 'Unknown error',
          })
          .eq('id', blueprint_id);
      } catch (updateError) {
        console.error('Failed to update error status:', updateError);
      }
    }
    
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

// ============================================================================
// Analysis Function
// ============================================================================

async function analyzeWithOpenAI(content: string, taskType: string): Promise<any> {
  console.log('=== ANALYZE WITH OPENAI ===');
  console.log('Content length:', content?.length || 0);
  console.log('Content preview (first 500 chars):', content?.substring(0, 500));
  console.log('Task type:', taskType);
  
  // Check if we have actual content
  if (!content || content.trim().length === 0) {
    throw new Error('No content provided for analysis');
  }
  
  // Warn if content is just the PDF placeholder
  if (content.includes('[A PDF document was uploaded:') && content.length < 200) {
    console.warn('WARNING: Content appears to only be a PDF placeholder with no actual text content');
  }

  const userPrompt = PROMPTS.documentAnalysis.user(content, taskType);
  console.log('User prompt length:', userPrompt?.length || 0);
  console.log('User prompt preview:', userPrompt?.substring(0, 300));

  const requestBody = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: PROMPTS.documentAnalysis.system,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4096,
  };

  console.log('Making OpenAI API request...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  console.log('OpenAI response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('OpenAI response received');
  console.log('Choices count:', data.choices?.length);
  console.log('Usage:', JSON.stringify(data.usage));
  
  const analysisText = data.choices[0]?.message?.content;
  console.log('Analysis text length:', analysisText?.length || 0);
  console.log('Analysis text preview:', analysisText?.substring(0, 500));
  
  if (!analysisText) {
    console.error('No analysis text in response. Full response:', JSON.stringify(data));
    throw new Error('No analysis returned from OpenAI');
  }

  try {
    const parsed = JSON.parse(analysisText);
    console.log('Parsed analysis keys:', Object.keys(parsed));
    console.log('Topics count:', parsed.topics?.length || 0);
    console.log('Prerequisites count:', parsed.prerequisites?.length || 0);
    return parsed;
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Raw analysis text:', analysisText);
    throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}`);
  }
}

// ============================================================================
// Resource Search Function
// ============================================================================

async function searchForResources(analysis: any, taskType: string): Promise<any[]> {
  console.log('Calling OpenAI for resource search...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: PROMPTS.resourceSearch.system,
        },
        {
          role: 'user',
          content: PROMPTS.resourceSearch.user(analysis, taskType),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI resource search error:', response.status, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    console.log('No resources returned from OpenAI');
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    return parsed.resources || [];
  } catch (parseError) {
    console.error('Failed to parse resources JSON');
    return [];
  }
}

// ============================================================================
// Blueprint Compilation Function
// ============================================================================

async function compileBlueprint(analysis: any, resources: any[], taskType: string): Promise<any> {
  console.log('Calling OpenAI for blueprint compilation...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: PROMPTS.blueprintCompilation.system,
        },
        {
          role: 'user',
          content: PROMPTS.blueprintCompilation.user(analysis, resources, taskType),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI compilation error:', response.status, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No compiled blueprint returned');
  }

  return JSON.parse(content);
}
