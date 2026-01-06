// ============================================================================
// ANALYZE DOCUMENT EDGE FUNCTION
// ============================================================================
// Step 1 of 3: Deeply analyzes uploaded PDFs or pasted text using Claude Haiku
// 
// KEY FEATURES:
// - Uses Claude's VISION capabilities to read PDFs directly (sees figures, diagrams, equations!)
// - Analyzes EACH PROBLEM SEPARATELY for problem sets
// - Extracts structured learning metadata without duplication
// - Links analysis to DOCUMENT (not blueprint) for reuse across blueprints
// - Checks if document already has an analysis before re-analyzing
//
// LIMITS: PDFs up to 32MB, up to 100 pages
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  createSupabaseClient, 
  createSupabaseClientWithAuth, 
  callClaudeJSON,
  callClaudeWithPDFAndText,
  arrayBufferToBase64,
  PdfDocument,
} from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';

interface AnalyzeRequest {
  blueprint_id: string;
  force_reanalyze?: boolean; // If true, re-analyze even if analysis exists
}

// Content classification - determines if document is problems, lecture, or hybrid
interface ContentClassification {
  primary_type: 'problem_set' | 'lecture' | 'hybrid' | 'textbook' | 'study_guide';
  has_assigned_problems: boolean;
  has_instructional_content: boolean;
  problem_ratio: number; // 0.0 to 1.0 - what % is problems vs instruction
  classification_confidence: number; // 0.0 to 1.0
  reasoning: string;
  inferred_student_goal: string; // What the student likely needs to do
}

// Section can be either a Problem or a Topic depending on document type
interface Section {
  section_id: string; // "Problem 1" or "Topic 1"
  section_type: 'problem' | 'topic';
  
  // FOR PROBLEMS (section_type: "problem"):
  problem_statement?: string;
  figure_description?: string | null;
  given_variables?: Array<{
    symbol: string;
    description: string;
    value: string;
    unit: string;
  }>;
  unknown_variables?: Array<{
    symbol: string;
    description: string;
  }>;
  assumptions?: string[];
  solving_approach?: string[];
  
  // FOR TOPICS (section_type: "topic"):
  topic_summary?: string;
  key_concepts?: string[];
  learning_objectives?: string[];
  
  // COMMON FIELDS FOR BOTH:
  concepts_tested: string[];
  equations_needed: string[];
  difficulty: number; // 1-10
  estimated_minutes: number;
  common_mistakes: string[];
}

// Clean analysis result - supports both problems and topics
interface AnalysisResult {
  document_type: 'problem_set' | 'lecture' | 'hybrid' | 'textbook' | 'study_guide';
  subject_area: string;
  specific_topic: string;
  course_level: 'introductory' | 'intermediate' | 'advanced' | 'graduate';
  
  // Content classification - determines how to handle the document
  content_classification: ContentClassification;
  
  // Sections can be Problems OR Topics depending on document type
  sections: Section[];
  
  // Legacy support: map sections to problems for backward compatibility
  problems?: Section[];
  
  // Prerequisites needed before attempting the material
  prerequisites: Array<{
    concept: string;
    category: 'math' | 'physics' | 'chemistry' | 'engineering' | 'other';
    why_needed: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }>;
  
  // Master equation list
  key_equations: Array<{
    name: string;
    formula?: string;
    latex?: string;
    variables: Record<string, string>;
    when_to_use: string;
  }>;
  
  // Study recommendations
  study_recommendations: {
    total_time_minutes: number;
    suggested_order: string[];
    focus_areas: string[];
    tips: string[];
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  let blueprint_id: string | null = null;
  const supabase = createSupabaseClient();

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const body: AnalyzeRequest = await req.json();
    blueprint_id = body.blueprint_id;
    const forceReanalyze = body.force_reanalyze || false;

    if (!blueprint_id) {
      throw new Error('Missing required field: blueprint_id');
    }

    console.log(`[analyze-document] Starting analysis for blueprint: ${blueprint_id}`);
    console.log(`[analyze-document] Force re-analyze: ${forceReanalyze}`);

    // Verify user owns this blueprint
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

    console.log('[analyze-document] Blueprint found:', blueprint.title || blueprint.id);

    // Get file info from blueprint
    const fileUrl = blueprint.file_metadata?.url || blueprint.content?.fileUpload?.url;
    const fileName = blueprint.file_metadata?.name || blueprint.content?.fileUpload?.name || 'uploaded-document';
    const textContent = blueprint.description || blueprint.content?.textInput || '';

    console.log('[analyze-document] Content sources:');
    console.log('  - Text content length:', textContent?.length || 0);
    console.log('  - File URL:', fileUrl || '(none)');
    console.log('  - File name:', fileName);

    if (!textContent && !fileUrl) {
      throw new Error('No content to analyze - please provide a document or text');
    }

    // =========================================================================
    // STEP 1: Find or identify the class_document record
    // =========================================================================
    let documentId: string | null = blueprint.document_id || null;
    let classDocument: any = null;

    // If blueprint already has a document_id, use it
    if (documentId) {
      console.log(`[analyze-document] Blueprint has document_id: ${documentId}`);
      const { data: doc } = await supabase
        .from('class_documents')
        .select('*')
        .eq('id', documentId)
        .single();
      classDocument = doc;
    }

    // If no document_id on blueprint, try to find the class_document by matching
    if (!classDocument && blueprint.class_id && fileName && fileName !== 'uploaded-document') {
      console.log(`[analyze-document] Searching for document by filename: ${fileName}`);
      const { data: docs } = await supabase
        .from('class_documents')
        .select('*')
        .eq('class_id', blueprint.class_id)
        .eq('user_id', blueprint.user_id)
        .eq('name', fileName)
        .limit(1);

      if (docs && docs.length > 0) {
        classDocument = docs[0];
        documentId = classDocument.id;
        console.log(`[analyze-document] Found class_document: ${documentId}`);
        
        // Update blueprint with the document_id for future reference
        await supabase
          .from('blueprints')
          .update({ document_id: documentId })
          .eq('id', blueprint_id);
        console.log(`[analyze-document] Updated blueprint with document_id`);
      }
    }

    // =========================================================================
    // STEP 2: Check if analysis already exists for this document
    // =========================================================================
    let existingAnalysis: any = null;

    if (documentId && !forceReanalyze) {
      console.log(`[analyze-document] Checking for existing analysis for document: ${documentId}`);
      const { data: existing } = await supabase
        .from('document_analyses')
        .select('*')
        .eq('document_id', documentId)
        .maybeSingle();

      if (existing) {
        existingAnalysis = existing;
        console.log(`[analyze-document] Found existing analysis: ${(existing as any).id}`);
      }
    }

    // If we found an existing analysis and not forcing re-analyze, return it
    if (existingAnalysis && !forceReanalyze) {
      console.log('[analyze-document] Using existing analysis (document already analyzed)');
      
      // Update blueprint status
      await supabase
        .from('blueprints')
        .update({ 
          generation_status: 'analyzed',
          document_id: documentId,
        })
        .eq('id', blueprint_id);

      return new Response(
        JSON.stringify({ 
          success: true,
          step: 'analyze',
          status: 'analysis_complete',
          analysis_id: existingAnalysis.id,
          analysis: existingAnalysis.raw_analysis,
          document_id: documentId,
          reused_existing: true,
          message: 'Document was already analyzed. Using existing analysis. You can now run Step 2 (Generate Structure).',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // =========================================================================
    // STEP 3: Perform the analysis (no existing analysis or force re-analyze)
    // =========================================================================
    
    // Update status to analyzing
    await supabase
      .from('blueprints')
      .update({ 
        generation_status: 'analyzing',
        generation_started_at: new Date().toISOString(),
        generation_error: null,
      })
      .eq('id', blueprint_id);

    // If forcing re-analyze, delete existing analysis for this document
    if (forceReanalyze && documentId) {
      console.log('[analyze-document] Deleting existing analysis for re-analyze...');
      await supabase
        .from('document_analyses')
        .delete()
        .eq('document_id', documentId);
    }

    // Prepare content for analysis
    let extractedText = textContent || '';
    let sourceType: 'pdf' | 'text' | 'both' = textContent ? 'text' : 'pdf';
    let pdfDocument: PdfDocument | null = null;
    
    // If there's a file, fetch it
    if (fileUrl) {
      console.log('[analyze-document] Fetching file content from:', fileUrl);
      
      try {
        // Try to fetch the file - could be public URL or signed URL
        let fileResponse: Response;
        
        // First, try direct fetch (works for public buckets)
        fileResponse = await fetch(fileUrl);
        
        // If direct fetch fails, try using Supabase storage API
        if (!fileResponse.ok) {
          console.log('[analyze-document] Direct fetch failed (status:', fileResponse.status, '), trying Supabase storage...');
          
          // Extract bucket and path from URL
          let bucketName: string | null = null;
          let filePath: string | null = null;
          
          const publicPrefix = '/storage/v1/object/public/';
          let prefixIndex = fileUrl.indexOf(publicPrefix);
          let prefixLength = publicPrefix.length;
          
          if (prefixIndex === -1) {
            const privatePrefix = '/storage/v1/object/';
            prefixIndex = fileUrl.indexOf(privatePrefix);
            prefixLength = privatePrefix.length;
          }
          
          if (prefixIndex !== -1) {
            const afterPrefix = fileUrl.substring(prefixIndex + prefixLength);
            const firstSlashIndex = afterPrefix.indexOf('/');
            
            if (firstSlashIndex !== -1) {
              const bucketNameEncoded = afterPrefix.substring(0, firstSlashIndex);
              const filePathEncoded = afterPrefix.substring(firstSlashIndex + 1);
              
              bucketName = decodeURIComponent(bucketNameEncoded);
              filePath = decodeURIComponent(filePathEncoded);
            }
          }
          
          if (bucketName && filePath) {
            console.log('[analyze-document] Parsed URL - bucket:', bucketName, 'path:', filePath);

            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            
            const encodedBucket = encodeURIComponent(bucketName);
            const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            const authenticatedUrl = `${supabaseUrl}/storage/v1/object/authenticated/${encodedBucket}/${encodedPath}`;
            
            console.log('[analyze-document] Trying authenticated download:', authenticatedUrl);
            
            fileResponse = await fetch(authenticatedUrl, {
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'apikey': serviceKey,
              }
            });
            
            if (!fileResponse.ok) {
              console.log('[analyze-document] Authenticated download failed:', fileResponse.status);
              
              const directUrl = `${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`;
              console.log('[analyze-document] Trying direct object URL:', directUrl);
              
              fileResponse = await fetch(directUrl, {
                headers: {
                  'Authorization': `Bearer ${serviceKey}`,
                  'apikey': serviceKey,
                }
              });
              
              if (!fileResponse.ok) {
                console.error('[analyze-document] Direct URL also failed:', fileResponse.status);
                const errorBody = await fileResponse.text();
                console.error('[analyze-document] Error body:', errorBody);
                throw new Error(`Failed to download file. Status: ${fileResponse.status}. The bucket "${bucketName}" may need proper access policies.`);
              }
            }
            
            console.log('[analyze-document] Successfully downloaded file via REST API');
          } else {
            console.error('[analyze-document] Could not parse URL format:', fileUrl);
            throw new Error(`Failed to fetch file: ${fileResponse.statusText}. URL format not recognized.`);
          }
        }
        
        const contentType = fileResponse.headers.get('content-type') || '';
        console.log('[analyze-document] File content type:', contentType);
        
        if (contentType.includes('application/pdf')) {
          console.log('[analyze-document] PDF detected - will use Claude vision to read it');
          
          const pdfArrayBuffer = await fileResponse.arrayBuffer();
          const pdfBase64 = arrayBufferToBase64(pdfArrayBuffer);
          
          console.log('[analyze-document] PDF converted to base64, size:', pdfBase64.length, 'chars');
          
          const estimatedOriginalSize = (pdfBase64.length * 3) / 4;
          if (estimatedOriginalSize > 32 * 1024 * 1024) {
            throw new Error('PDF is too large. Maximum file size is 32MB.');
          }
          
          pdfDocument = {
            base64Data: pdfBase64,
            mediaType: 'application/pdf',
            filename: fileName,
          };
          
          extractedText = textContent 
            ? `${textContent}\n\n[Original document was a PDF: ${fileName} - analyzed with AI vision]`
            : `[PDF: ${fileName} - analyzed with AI vision]`;
            
          sourceType = textContent ? 'both' : 'pdf';
          
        } else if (contentType.includes('text/')) {
          const fileText = await fileResponse.text();
          extractedText = textContent 
            ? `${textContent}\n\n---FILE CONTENT---\n${fileText}`
            : fileText;
          sourceType = textContent ? 'both' : 'text';
        } else {
          try {
            const fileText = await fileResponse.text();
            if (fileText && fileText.length > 0 && fileText.length < 100000) {
              extractedText = textContent 
                ? `${textContent}\n\n---FILE CONTENT---\n${fileText}`
                : fileText;
              sourceType = textContent ? 'both' : 'text';
            }
          } catch (textError) {
            console.log('[analyze-document] Could not read file as text:', textError);
          }
        }
      } catch (fetchError) {
        console.error('[analyze-document] File fetch error:', fetchError);
        if (!textContent) {
          throw new Error(`Failed to fetch file content: ${fetchError.message}`);
        }
      }
    }

    // Ensure we have something to analyze
    if (!pdfDocument && (!extractedText || extractedText.trim().length === 0)) {
      throw new Error('No content available for analysis');
    }

    console.log('[analyze-document] Ready to analyze:');
    console.log('  - Has PDF document:', !!pdfDocument);
    console.log('  - Text content length:', extractedText?.length || 0);
    console.log('  - Source type:', sourceType);

    // Call Claude for analysis
    console.log('[analyze-document] Calling Claude for analysis...');
    
    const analysis = await callClaudeWithPDFAndText<AnalysisResult>(
      PROMPTS.documentAnalysis.system,
      PROMPTS.documentAnalysis.user('', blueprint.task_type),
      pdfDocument,
      textContent || null,
      { temperature: 0.3, maxTokens: 12288 } // Increased from 8192 - need enough for complete JSON
    );

    console.log('[analyze-document] Analysis complete:');
    console.log('  - Document type:', analysis.document_type);
    console.log('  - Content classification:', analysis.content_classification?.primary_type || 'unknown');
    console.log('  - Sections found:', analysis.sections?.length || 0);
    console.log('  - Problems:', analysis.sections?.filter(s => s.section_type === 'problem').length || 0);
    console.log('  - Topics:', analysis.sections?.filter(s => s.section_type === 'topic').length || 0);
    console.log('  - Prerequisites found:', analysis.prerequisites?.length || 0);
    console.log('  - Course level:', analysis.course_level);
    console.log('  - Inferred goal:', analysis.content_classification?.inferred_student_goal || 'Master this material');

    // Calculate total estimated time
    const totalTimeMinutes = analysis.study_recommendations?.total_time_minutes || 
      analysis.sections?.reduce((sum, s) => sum + (s.estimated_minutes || 0), 0) || 60;

    // Map course_level to difficulty_level
    const difficultyMap: Record<string, string> = {
      'introductory': 'beginner',
      'intermediate': 'intermediate', 
      'advanced': 'advanced',
      'graduate': 'expert'
    };

    // =========================================================================
    // STEP 4: Store the analysis linked to DOCUMENT (not blueprint)
    // =========================================================================
    const insertData = {
      // Link to document (primary) and blueprint (for backwards compat)
      document_id: documentId,
      blueprint_id: blueprint_id,
      user_id: blueprint.user_id,
      class_id: blueprint.class_id || null,
      // Derived fields
      topics: [],
      prerequisites: analysis.prerequisites || [],
      problem_types: [],
      difficulty_level: difficultyMap[analysis.course_level] || 'intermediate',
      estimated_study_time_minutes: totalTimeMinutes,
      // The actual analysis
      raw_analysis: analysis,
      extracted_text: extractedText,
      source_filename: fileName,
      source_type: sourceType,
      model_used: 'claude-haiku-4-5',
    };

    console.log('[analyze-document] Storing analysis in database...');
    console.log('  - document_id:', documentId);
    console.log('  - blueprint_id:', blueprint_id);
    
    const { data: newAnalysis, error: insertError } = await supabase
      .from('document_analyses')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[analyze-document] Database insert error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('[analyze-document] Analysis saved with ID:', newAnalysis?.id);

    // =========================================================================
    // STEP 5: Generate blueprint name - SKIPPED/REMOVED
    // =========================================================================
    // User requested removal of auto-naming feature to avoid rate limits.
    // Users should name their own blueprints.
    console.log('[analyze-document] Auto-naming skipped (feature removed).');

    // Update blueprint with document_id and status
    const blueprintUpdate: any = {
      generation_status: 'analyzed',
      document_id: documentId,
    };

    await supabase
      .from('blueprints')
      .update(blueprintUpdate)
      .eq('id', blueprint_id);

    console.log('[analyze-document] Blueprint updated status to analyzed');
    console.log('[analyze-document] Complete!');

    return new Response(
      JSON.stringify({ 
        success: true,
        step: 'analyze',
        status: 'analysis_complete',
        analysis_id: newAnalysis?.id,
        analysis: analysis,
        document_id: documentId,
        reused_existing: false,
        message: 'Document analysis complete. You can now run Step 2 (Generate Structure).',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[analyze-document] Error:', error);

    // Update blueprint with error status
    if (blueprint_id) {
      try {
        await supabase
          .from('blueprints')
          .update({ 
            generation_status: 'failed',
            generation_error: error?.message || 'Analysis failed',
          })
          .eq('id', blueprint_id);
      } catch (updateError) {
        console.error('[analyze-document] Failed to update error status:', updateError);
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
