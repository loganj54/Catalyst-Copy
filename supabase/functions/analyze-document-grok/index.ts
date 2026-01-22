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
  arrayBufferToBase64,
  PdfDocument,
  ImageDocument,
} from '../_shared/supabase-client.ts';
import {
  callGrokJSON,
  callGrokWithImage,
  uploadFileToGrok,
  callGrokWithFile,
  GROK_MODEL_REASONING,
  GROK_MODEL_VISION
} from '../_shared/grok-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';
import { generateEmbedding, generateEmbedding1536 } from '../_shared/embeddings.ts';
import { queryVectors } from '../_shared/pinecone-client.ts';

// RAG processing threshold - files larger than this use RAG
const RAG_THRESHOLD_MB = 5;

interface AnalyzeRequest {
  blueprint_id: string;
  force_reanalyze?: boolean;
  analysis_mode?: 'full' | 'chunk' | 'merge';
  file_url?: string;
  partial_analyses?: AnalysisResult[];
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

// ============================================================================
// RAG HELPER FUNCTIONS FOR LARGE PDF PROCESSING
// ============================================================================

const PINECONE_NAMESPACE = 'documents';

/**
 * Call the process-document-embeddings function to chunk and embed a document
 */
async function processDocumentForRag(
  documentId: string,
  fileUrl: string,
  userId: string,
  classId: string | null,
  authHeader: string
): Promise<{ success: boolean; chunk_count?: number; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  console.log('[RAG] Processing document for RAG:', documentId);

  const response = await fetch(`${supabaseUrl}/functions/v1/process-document-embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_id: documentId,
      file_url: fileUrl,
      user_id: userId,
      class_id: classId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[RAG] Processing failed:', errorText);
    return { success: false, error: errorText };
  }

  const result = await response.json();
  console.log('[RAG] Processing complete:', result.chunk_count, 'chunks');

  return { success: true, chunk_count: result.chunk_count };
}

/**
 * Query Pinecone for relevant document chunks
 */
async function queryDocumentChunks(
  documentId: string,
  queryTexts: string[],
  topK: number = 20
): Promise<string[]> {
  console.log('[RAG] Querying for relevant chunks with', queryTexts.length, 'queries');

  const allChunks: Map<string, { text: string; score: number }> = new Map();

  for (const queryText of queryTexts) {
    try {
      const { embedding } = await generateEmbedding(queryText);

      const results = await queryVectors(
        embedding,
        Math.ceil(topK / queryTexts.length),
        { document_id: { $eq: documentId } },
        PINECONE_NAMESPACE,
        true
      );

      for (const match of results.matches || []) {
        const chunkId = match.id;
        const text = match.metadata?.text_content || '';
        const score = match.score || 0;

        // Keep highest scoring version of each chunk
        if (!allChunks.has(chunkId) || allChunks.get(chunkId)!.score < score) {
          allChunks.set(chunkId, { text, score });
        }
      }
    } catch (queryError) {
      console.log('[RAG] Query error:', queryError);
    }
  }

  // Sort by score and return texts
  const sortedChunks = Array.from(allChunks.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topK)
    .map(([_, chunk]) => chunk.text);

  console.log('[RAG] Retrieved', sortedChunks.length, 'unique chunks');

  return sortedChunks;
}

/**
 * Analyze document using RAG (chunks) instead of full PDF
 */
async function analyzeFromChunks(
  chunks: string[],
  textContent: string | null,
  taskType: string
): Promise<AnalysisResult> {
  console.log('[RAG] Analyzing from', chunks.length, 'chunks');

  // Combine chunks into a single text for analysis
  const chunkedContent = chunks.join('\n\n---\n\n');

  const prompt = `${PROMPTS.documentAnalysis.user('', taskType)}

DOCUMENT CONTENT (extracted from PDF, may be partial):
${chunkedContent}

${textContent ? `\nADDITIONAL CONTEXT: ${textContent}` : ''}

Analyze this content and provide the structured analysis.`;

  const analysis = await callGrokJSON<AnalysisResult>(
    PROMPTS.documentAnalysis.system,
    prompt,
    { temperature: 0.3, maxTokens: 12288, model: GROK_MODEL_REASONING }
  );

  console.log('[RAG] Analysis complete:', analysis.sections?.length || 0, 'sections');

  return analysis;
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
    const analysisMode = body.analysis_mode || 'full';
    const singleFileUrl = body.file_url;
    const partialAnalyses = body.partial_analyses || [];

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

    // Check for pre-extracted PDF text from client-side extraction (for large PDFs)
    const preExtractedPdfText = blueprint.content?.extractedPdfText || null;

    console.log('[analyze-document] Content sources:');
    console.log('  - Text content length:', textContent?.length || 0);
    console.log('  - File URL:', fileUrl || '(none)');
    console.log('  - File name:', fileName);
    console.log('  - Pre-extracted PDF text:', preExtractedPdfText ? `${preExtractedPdfText.length} chars (client-side extraction)` : '(none)');

    if (!textContent && !fileUrl && !preExtractedPdfText && analysisMode !== 'merge') {
      throw new Error('No content to analyze - please provide a document or text');
    }

    // Shared state variables
    let analysis: AnalysisResult | null = null;
    let extractedText = textContent || '';
    let sourceType: 'pdf' | 'text' | 'both' = textContent ? 'text' : 'pdf';
    let pdfDocument: PdfDocument | null = null;

    // =========================================================================
    // MODE: CHUNK ANALYSIS (Single Part)
    // =========================================================================
    if (analysisMode === 'chunk') {
      if (!singleFileUrl) throw new Error('Missing file_url for chunk mode');
      console.log(`[analyze-document] MODE: CHUNK - Processing ${singleFileUrl}`);

      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const { buffer, contentType } = await downloadSupabaseFile(singleFileUrl, serviceKey);

      if (!contentType.includes('application/pdf')) {
        return new Response(JSON.stringify({
          success: true,
          analysis: { document_type: 'unknown', sections: [], prerequisites: [] } as any,
          message: 'Text chunk processed (skipped)'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const pdfBase64 = arrayBufferToBase64(buffer);
      const pdfDocPart = {
        base64Data: pdfBase64,
        mediaType: 'application/pdf',
        filename: `Chunk_Analysis.pdf`,
      } as PdfDocument;

      if (pdfDocPart.mediaType === 'application/pdf') {
        throw new Error("Grok 4.1 does not support PDF Vision analysis. Please use the 'Analyze (Legacy)' button for PDF documents, or provide text content.");
      }

      const chunkAnalysis = await callGrokWithImage<AnalysisResult>(
        PROMPTS.documentAnalysis.system,
        PROMPTS.documentAnalysis.user("This is a single part of a larger document. Analyze it independently.", blueprint.task_type),
        pdfDocPart,
        { temperature: 0.3, maxTokens: 16384, model: GROK_MODEL_VISION }
      );

      return new Response(JSON.stringify({
        success: true,
        analysis: chunkAnalysis,
        mode: 'chunk'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // =========================================================================
    // MODE: MERGE RESULTS
    // =========================================================================
    if (analysisMode === 'merge') {
      if (!partialAnalyses || partialAnalyses.length === 0) throw new Error('No analyses to merge');
      console.log(`[analyze-document] MODE: MERGE - Merging ${partialAnalyses.length} results`);

      const first = partialAnalyses[0];
      const allSections = partialAnalyses.flatMap(a => a.sections || []);
      const allPrereqs = [...new Set(partialAnalyses.flatMap(a => a.prerequisites || []))];
      const totalTime = partialAnalyses.reduce((sum, a) => sum + (a.study_recommendations?.total_time_minutes || 0), 0);

      analysis = {
        ...first,
        sections: allSections,
        prerequisites: allPrereqs,
        study_recommendations: {
          ...(first.study_recommendations || {}),
          total_time_minutes: totalTime
        }
      };
      sourceType = 'pdf';
    }

    // =========================================================================
    // STEP 0: Check for SEMANTIC MATCH (Copy-Paste Duplicate Check)
    // =========================================================================
    // If the user pasted text (or we have text content) but didn't select a document,
    // check if this content matches an existing document chunk.

    if (!blueprint.document_id && !forceReanalyze && (extractedText && extractedText.length > 50)) {
      console.log('[analyze-document] Checking for semantic match (copy-paste detection)...');

      try {
        // Generate embedding for the input text (1536 dim for document_chunks)
        const { embedding } = await generateEmbedding1536(extractedText);

        // Search for matching chunks across ALL user documents
        const { data: matches, error: matchError } = await supabase.rpc('find_matching_document_chunk', {
          query_embedding: embedding,
          match_threshold: 0.99, // Very strict - must be virtually identical
          match_count: 1,
          p_user_id: blueprint.user_id
        });

        if (matchError) {
          console.error('[analyze-document] Semantic match error:', matchError);
        } else if (matches && matches.length > 0) {
          const match = matches[0];
          console.log(`[analyze-document] ✅ Found semantic match! Similarity: ${match.similarity.toFixed(4)}`);
          console.log(`[analyze-document] Linked to existing document: ${match.document_id}`);

          // Set the document_id to the matched document
          // This will cause Step 1 & 2 to find and reuse the existing analysis!
          blueprint.document_id = match.document_id;

          // Update the blueprint immediately so we don't lose this link
          await supabase
            .from('blueprints')
            .update({ document_id: match.document_id })
            .eq('id', blueprint_id);
        } else {
          console.log('[analyze-document] No semantic match found.');
        }
      } catch (err) {
        console.error('[analyze-document] Error detection semantic match:', err);
        // Continue gracefully - don't block analysis if cache check fails
      }
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
    // Prepare content for analysis (variables declared at top scope)

    // Check if we have pre-extracted PDF text from client-side extraction
    // This is used for large PDFs (>5MB) that were processed in the browser
    if (analysisMode === 'full' && preExtractedPdfText && preExtractedPdfText.length > 0) {
      console.log('[analyze-document] Using pre-extracted PDF text from client (client-side extraction)');
      console.log(`[analyze-document] Pre-extracted text length: ${preExtractedPdfText.length} characters`);

      // Use the pre-extracted text as the main content
      extractedText = textContent
        ? `${textContent}\n\n--- DOCUMENT CONTENT ---\n${preExtractedPdfText}`
        : preExtractedPdfText;
      sourceType = textContent ? 'both' : 'pdf';

      // No need to fetch the PDF - text is already extracted!
      console.log('[analyze-document] Skipping PDF download (text already extracted client-side)');

    } else if (analysisMode === 'full' && (fileUrl || blueprint.file_metadata?.file_urls)) {
      // Handle file fetching (single or multi-part)
      const fileUrls = blueprint.file_metadata?.file_urls || (fileUrl ? [fileUrl] : []);
      console.log(`[analyze-document] Processing ${fileUrls.length} file parts...`);

      const partialAnalyses: AnalysisResult[] = [];
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // Loop through all parts sequentially
      for (let i = 0; i < fileUrls.length; i++) {
        const url = fileUrls[i];
        const partNum = i + 1;
        const totalParts = fileUrls.length;

        console.log(`[analyze-document] --- Processing Part ${partNum}/${totalParts} ---`);

        try {
          // Download part
          const { buffer, contentType } = await downloadSupabaseFile(url, serviceKey);

          if (contentType.includes('application/pdf')) {
            console.log('[analyze-document] PDF Part detected');
            const pdfBase64 = arrayBufferToBase64(buffer);

            // Check size of this part
            const estimatedOriginalSize = (pdfBase64.length * 3) / 4;
            if (estimatedOriginalSize > 32 * 1024 * 1024) {
              console.warn(`[analyze-document] Part ${partNum} is > 32MB! Analysis might fail.`);
            }

            const pdfDocPart = {
              base64Data: pdfBase64,
              mediaType: 'application/pdf',
              filename: `Part_${partNum}_of_${totalParts}.pdf`,
            } as PdfDocument;

            // Update context for this part
            const partContext = totalParts > 1
              ? `(Part ${partNum} of ${totalParts} of the document)`
              : '';

            const userPrompt = totalParts > 1
              ? `This is Part ${partNum} of ${totalParts} of the document. Analyze this section. We will combine your analysis with others.`
              : '';

            console.log(`[analyze-document] Calling (Uploaded) File Analysis for Part ${partNum}...`);

            // NEW: Upload PDF to Grok Files API first
            let analysisResult;
            try {
              const uploadedFile = await uploadFileToGrok(buffer, `Part_${partNum}_of_${totalParts}.pdf`, 'application/pdf');

              analysisResult = await callGrokWithFile<AnalysisResult>(
                PROMPTS.documentAnalysis.system,
                PROMPTS.documentAnalysis.user(userPrompt, blueprint.task_type),
                uploadedFile.id,
                { temperature: 0.3, maxTokens: 16384, model: GROK_MODEL_REASONING }
              );

              console.log(`[analyze-document] File Analysis Success for Part ${partNum}`);
            } catch (err) {
              console.error(`[analyze-document] Grok File Analysis Failed:`, err);
              throw new Error(`Grok File Analysis failed: ${err.message}. Please use Legacy Analysis for PDFs.`);
            }

            const partAnalysis = analysisResult;

            partialAnalyses.push(partAnalysis);
            console.log(`[analyze-document] Part ${partNum} analysis complete.`);

          } else if (contentType.includes('image/')) {
            // Handle image files (PNG, JPEG, GIF, WEBP)
            console.log(`[analyze-document] Image Part detected: ${contentType}`);
            const imageBase64 = arrayBufferToBase64(buffer);

            // Determine the correct media type for Claude
            let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
            if (contentType.includes('jpeg') || contentType.includes('jpg')) {
              mediaType = 'image/jpeg';
            } else if (contentType.includes('gif')) {
              mediaType = 'image/gif';
            } else if (contentType.includes('webp')) {
              mediaType = 'image/webp';
            }

            const imageDoc = {
              base64Data: imageBase64,
              mediaType: mediaType,
              filename: `Image_${partNum}_of_${totalParts}`,
            } as ImageDocument;

            const userPrompt = `Analyze this image. It appears to be a screenshot or photo of educational material such as homework problems, lecture notes, or textbook content. Extract all visible text, equations, diagrams, and their meanings.`;

            console.log(`[analyze-document] Calling Claude for Image Part ${partNum}...`);

            const partAnalysis = await callGrokWithImage<AnalysisResult>(
              PROMPTS.documentAnalysis.system,
              PROMPTS.documentAnalysis.user(userPrompt, blueprint.task_type),
              imageDoc,
              { temperature: 0.3, maxTokens: 16384, model: GROK_MODEL_VISION }
            );

            partialAnalyses.push(partAnalysis);
            console.log(`[analyze-document] Image Part ${partNum} analysis complete.`);

          } else {
            // Handle text files (rare for chunks but possible if single file)
            const text = new TextDecoder().decode(buffer);
            // Simple fallback for text
            extractedText = text;
            // ... skipping full text logic for simplicity in this refactor
            // If we have text files, usually they are small enough for single pass
            // This branch is mainly for the single text file case fallback
          }

        } catch (partError) {
          console.error(`[analyze-document] Failed to process part ${partNum}:`, partError);
          // Don't fail the whole batch if one part fails? OR throw?
          // For now, if Part 1 fails, we probably fail.
          throw partError;
        }
      }

      // MERGE RESULTS
      if (partialAnalyses.length === 0) {
        throw new Error('No analysis results produced.');
      }

      if (partialAnalyses.length === 1) {
        // Single part - use directly
        analysis = partialAnalyses[0];
      } else {
        console.log('[analyze-document] Merging analysis results...');
        // Simple merge strategy
        const first = partialAnalyses[0];

        // Combine sections
        const allSections = partialAnalyses.flatMap(a => a.sections || []);
        // Re-number/deduplicate sections if needed? Claude usually behaves well.

        // Combine prerequisites
        const allPrereqs = [...new Set(partialAnalyses.flatMap(a => a.prerequisites || []))];

        // Combine key concepts (dedup)
        // Note: AnalysisResult might not have key_concepts at top level, check interface
        // Assuming it matches the structure in sections

        // Calculate total time
        const totalTime = partialAnalyses.reduce((sum, a) => sum + (a.study_recommendations?.total_time_minutes || 0), 0);

        analysis = {
          ...first,
          sections: allSections,
          prerequisites: allPrereqs,
          study_recommendations: {
            ...(first.study_recommendations || {}),
            total_time_minutes: totalTime
          }
        };
      }

      sourceType = 'pdf'; // Assumed
    }

    console.log('[analyze-document] Final Analysis complete:');
    console.log('  - Document type:', analysis?.document_type);
    console.log('  - Sections found:', analysis?.sections?.length || 0);

    // Call Claude for analysis IF NOT DONE YET
    if (!analysis) {
      // Ensure we have something to analyze
      if (!pdfDocument && (!extractedText || extractedText.trim().length === 0)) {
        throw new Error('No content available for analysis');
      }

      console.log('[analyze-document] Calling Claude for analysis (Single Pass)...');
      console.log('  - Text content length:', extractedText?.length || 0);

      // If we have text, use text analysis (Reasoning model)
      if (extractedText && extractedText.length > 50) {
        analysis = await callGrokJSON<AnalysisResult>(
          PROMPTS.documentAnalysis.system,
          PROMPTS.documentAnalysis.user(extractedText, blueprint.task_type),
          { temperature: 0.3, maxTokens: 12288, model: GROK_MODEL_REASONING }
        );
      } else {
        // Fallback to Vision if only PDF/Image provided
        if (pdfDocument && pdfDocument.mediaType === 'application/pdf') {
          throw new Error("Grok 4.1 does not support PDF Vision analysis. Please use the 'Analyze (Legacy)' button for PDF documents.");
        }

        analysis = await callGrokWithImage<AnalysisResult>(
          PROMPTS.documentAnalysis.system,
          PROMPTS.documentAnalysis.user('', blueprint.task_type),
          pdfDocument!, // Must exist if extractedText is null/empty per check above
          { temperature: 0.3, maxTokens: 12288, model: GROK_MODEL_VISION }
        );
      }
    }

    // Calculate total estimated time
    const totalTimeMinutes = analysis?.study_recommendations?.total_time_minutes ||
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
      model_used: 'grok-4.1',
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
    // Also update task_type with formatted document type to replace "Auto-detect"
    const docTypeMap: Record<string, string> = {
      'problem_set': 'Problem Set',
      'lecture': 'Lecture Notes',
      'textbook': 'Textbook Chapter',
      'study_guide': 'Study Guide',
      'hybrid': 'Mixed Content'
    };

    const formattedTaskType = docTypeMap[analysis.document_type] || 'General Document';

    const blueprintUpdate: any = {
      generation_status: 'analyzed',
      document_id: documentId,
      task_type: formattedTaskType,
      goal_type: `Analyze ${formattedTaskType}` // Also update goal to be specific
    };

    await supabase
      .from('blueprints')
      .update(blueprintUpdate)
      .eq('id', blueprint_id);

    console.log('[analyze-document] Blueprint updated status to analyzed');

    // Also update class_documents with the document_type for filtering
    if (documentId && analysis.document_type) {
      await supabase
        .from('class_documents')
        .update({ document_type: analysis.document_type })
        .eq('id', documentId);
      console.log(`[analyze-document] Updated class_documents.document_type: ${analysis.document_type}`);
    }
    // =========================================================================
    // STEP 5: Trigger RAG Embeddings (Background)
    // =========================================================================
    // We start the embedding process now so the "Chat with Document" feature 
    // is ready by the time the user finishes reviewing the blueprint.
    // We do NOT await this - it runs in the background.
    if (preExtractedPdfText || (sourceType === 'pdf' && fileUrl)) {
      console.log('[analyze-document] Triggering background embedding generation for Chat...');
      const authHeader = req.headers.get('Authorization')!;

      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-document-embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_id: documentId,
          file_url: fileUrl,
          extracted_text: preExtractedPdfText, // Send the text directly if we have it!
          user_id: blueprint.user_id,
          class_id: blueprint.class_id
        })
      }).catch(err => console.error('[analyze-document] Background embedding trigger failed:', err));
    }

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

// ============================================================================
// Helper: Download File from Supabase Storage
// ============================================================================
async function downloadSupabaseFile(fileUrl: string, serviceKey: string): Promise<{ buffer: ArrayBuffer, contentType: string }> {
  console.log(`[download] Fetching file: ${fileUrl}`);

  // 1. Try generic fetch (works for public URLs)
  let response = await fetch(fileUrl);

  // 2. If 400/403/401, try authenticated fetch assuming it's a Supabase Storage URL
  if (!response.ok) {
    console.log(`[download] Public fetch failed (${response.status}), trying authenticated...`);

    // Regex to extract bucket and path from standard Supabase Storage URLs
    // https://PROJECT.supabase.co/storage/v1/object/public/BUCKET/PATH/TO/FILE
    const match = fileUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^\/]+)\/(.+)$/);
    if (match) {
      const bucket = match[1];
      const path = match[2]; // This might be URL encoded or not

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      // Decode first to ensure we don't double encode
      const decodedPath = decodeURIComponent(path);
      const encodedPath = decodedPath.split('/').map(p => encodeURIComponent(p)).join('/');

      const authUrl = `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${encodedPath}`;
      console.log(`[download] Trying authenticated URL: ${authUrl}`);

      response = await fetch(authUrl, {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        }
      });
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  return { buffer, contentType };
}
