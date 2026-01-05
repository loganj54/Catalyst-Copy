// ============================================================================
// STORE ANALYSIS ATOMIC FUNCTION
// ============================================================================
// Stores document analysis in document_analyses table
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { StoreAnalysisInput, StoreAnalysisOutput, FunctionError } from '../_shared/types.ts';

/**
 * Main handler - stores analysis
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const input: StoreAnalysisInput = await req.json();
    
    if (!input.analysis) {
      return errorResponse({
        error: 'analysis is required',
        code: 'INVALID_INPUT',
        details: { field: 'analysis' },
      });
    }

    if (!input.user_id || input.user_id.trim().length === 0) {
      return errorResponse({
        error: 'user_id is required',
        code: 'INVALID_INPUT',
        details: { field: 'user_id' },
      });
    }

    // document_id is optional - if not provided, we'll use blueprint_id as fallback
    if (!input.document_id && !input.blueprint_id) {
      return errorResponse({
        error: 'Either document_id or blueprint_id is required',
        code: 'INVALID_INPUT',
        details: { fields: ['document_id', 'blueprint_id'] },
      });
    }

    console.log('[store-analysis] Storing analysis...');
    console.log('  - Document ID:', input.document_id || '(none - using blueprint_id)');
    console.log('  - Blueprint ID:', input.blueprint_id || '(none)');
    console.log('  - User ID:', input.user_id);

    const { analysis } = input;

    // Calculate derived fields
    const totalTimeMinutes = analysis.study_recommendations?.total_time_minutes || 
      analysis.sections?.reduce((sum: number, s: any) => sum + (s.estimated_minutes || 0), 0) || 60;

    // Map course_level to difficulty_level
    const difficultyMap: Record<string, string> = {
      'introductory': 'beginner',
      'intermediate': 'intermediate',
      'advanced': 'advanced',
      'graduate': 'expert',
    };
    const difficultyLevel = difficultyMap[analysis.course_level] || 'intermediate';

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Build insert data
    const insertData: any = {
      document_id: input.document_id || null,
      user_id: input.user_id,
      blueprint_id: input.blueprint_id || null,
      class_id: input.class_id || null,
      // Derived fields
      topics: [],
      prerequisites: analysis.prerequisites || [],
      problem_types: [],
      difficulty_level: difficultyLevel,
      estimated_study_time_minutes: totalTimeMinutes,
      // The actual analysis
      raw_analysis: analysis,
      source_filename: input.source_filename || null,
      source_type: input.source_type || 'text',
      model_used: 'claude-haiku-4-5',
    };

    // Insert analysis
    const { data: newAnalysis, error: insertError } = await supabase
      .from('document_analyses')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      console.error('[store-analysis] Database error:', insertError);
      
      // Check if duplicate
      if (insertError.code === '23505') {
        return errorResponse({
          error: 'Analysis for this document already exists',
          code: 'DUPLICATE_ENTRY',
          details: insertError,
        });
      }

      return errorResponse({
        error: `Database error: ${insertError.message}`,
        code: 'DATABASE_ERROR',
        details: insertError,
      });
    }

    const analysisId = newAnalysis?.id;

    console.log('[store-analysis] Analysis stored successfully');
    console.log('  - Analysis ID:', analysisId);

    const output: StoreAnalysisOutput = {
      analysis_id: analysisId,
      metadata: {
        stored_at: new Date().toISOString(),
      },
    };

    return new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[store-analysis] Error:', error);
    
    return errorResponse({
      error: error.message || 'Internal error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Helper to create error response
 */
function errorResponse(error: FunctionError): Response {
  return new Response(
    JSON.stringify(error),
    {
      status: error.code === 'INVALID_INPUT' ? 400 : error.code === 'DUPLICATE_ENTRY' ? 409 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Wrap handler with self-healing
serve(withSelfHealing('store-analysis', handler));

