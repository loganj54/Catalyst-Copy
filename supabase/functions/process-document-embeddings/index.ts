// ============================================================================
// PROCESS DOCUMENT EMBEDDINGS EDGE FUNCTION
// ============================================================================
// Chunks large PDFs, generates embeddings, and stores in Pinecone for RAG
// 
// KEY FEATURES:
// - Extracts text from PDFs using Claude vision
// - Splits text into overlapping chunks (800 words, 100 word overlap)
// - Generates embeddings for each chunk using OpenAI
// - Stores chunks in Pinecone for semantic search
// - Enables RAG-based document analysis and chat
//
// USAGE: Call this for PDFs > 5MB before blueprint generation
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
    createSupabaseClient,
    createSupabaseClientWithAuth,
} from '../_shared/supabase-client.ts';
import { generateEmbeddings } from '../_shared/embeddings.ts';
import { upsertVectors, deleteVectors, PineconeVector } from '../_shared/pinecone-client.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHUNK_SIZE_WORDS = 800;        // Target words per chunk
const CHUNK_OVERLAP_WORDS = 100;     // Overlap between chunks for context
const MAX_CHUNKS_PER_BATCH = 20;     // Max chunks to embed at once
const PINECONE_NAMESPACE = 'documents'; // Namespace for document chunks

// ============================================================================
// INTERFACES
// ============================================================================

interface ProcessRequest {
    document_id: string;      // class_documents.id
    file_url?: string;        // Optional if extracted_text provided
    extracted_text?: string;  // Pre-extracted text from client
    user_id: string;
    class_id?: string;
    force_reprocess?: boolean; // If true, delete existing and reprocess
}

interface TextChunk {
    index: number;
    text: string;
    wordCount: number;
    pageHint?: string;        // Approximate page reference
}

interface ProcessingResult {
    success: boolean;
    document_id: string;
    chunk_count: number;
    total_tokens: number;
    processing_time_ms: number;
    pinecone_namespace: string;
}

// ============================================================================
// TEXT CHUNKING FUNCTIONS
// ============================================================================

/**
 * Split text into overlapping chunks for embedding
 */
function chunkText(text: string, chunkSizeWords: number = CHUNK_SIZE_WORDS, overlapWords: number = CHUNK_OVERLAP_WORDS): TextChunk[] {
    // Normalize whitespace and split into words
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const words = cleanText.split(' ');

    const chunks: TextChunk[] = [];
    let currentIndex = 0;
    let chunkNumber = 0;

    while (currentIndex < words.length) {
        // Get chunk words
        const chunkWords = words.slice(currentIndex, currentIndex + chunkSizeWords);
        const chunkText = chunkWords.join(' ');

        // Only add if we have meaningful content
        if (chunkText.trim().length > 50) {
            chunks.push({
                index: chunkNumber,
                text: chunkText,
                wordCount: chunkWords.length,
                pageHint: `chunk ${chunkNumber + 1}`,
            });
            chunkNumber++;
        }

        // Move forward by (chunkSize - overlap) words
        currentIndex += chunkSizeWords - overlapWords;

        // Safety: prevent infinite loop on very short texts
        if (chunkSizeWords <= overlapWords) {
            currentIndex += 1;
        }
    }

    console.log(`[chunking] Split ${words.length} words into ${chunks.length} chunks`);

    return chunks;
}

/**
 * Extract text from PDF using Claude Vision
 * This sends the PDF to Claude and asks it to extract all text content
 */
async function extractTextFromPdf(pdfBase64: string, filename: string): Promise<string> {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    console.log(`[extract] Sending PDF to Claude for text extraction...`);
    console.log(`[extract] PDF size: ${(pdfBase64.length / 1024 / 1024 * 0.75).toFixed(2)} MB (estimated)`);

    // Use Claude to extract text from PDF
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'pdfs-2024-09-25',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 16384,
            temperature: 0,
            system: `You are a document text extractor. Extract ALL text content from this PDF document.

RULES:
1. Extract text in reading order (left to right, top to bottom)
2. Preserve paragraph breaks with double newlines
3. Include headers, bullet points, equations (as plain text), and all visible text
4. For figures/diagrams, briefly note "[Figure: description]" but focus on text
5. Include page numbers if visible, formatted as "--- Page N ---"
6. Do NOT summarize or interpret - just extract the raw text
7. Keep the original structure and formatting as much as possible`,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'document',
                            source: {
                                type: 'base64',
                                media_type: 'application/pdf',
                                data: pdfBase64,
                            },
                            cache_control: { type: 'ephemeral' },
                        },
                        {
                            type: 'text',
                            text: `Extract ALL text content from this document "${filename}". Include everything readable - headers, paragraphs, equations, labels, captions. Output only the extracted text, nothing else.`,
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[extract] Claude API error:', response.status, errorText);
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.content?.find((block: any) => block.type === 'text');

    if (!textContent) {
        throw new Error('No text content returned from Claude');
    }

    console.log(`[extract] Extracted ${textContent.text.length} characters`);
    console.log(`[extract] Tokens used: ${data.usage?.input_tokens || 0} input, ${data.usage?.output_tokens || 0} output`);

    return textContent.text;
}

/**
 * Fetch PDF from Supabase Storage and convert to base64
 */
async function fetchPdfAsBase64(fileUrl: string): Promise<string> {
    console.log(`[fetch] Downloading PDF from: ${fileUrl}`);

    const response = await fetch(fileUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    console.log(`[fetch] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    return base64;
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

async function processDocument(
    document_id: string,
    file_url: string | undefined, // Can be undefined if we have text
    extracted_text: string | undefined, // Can be undefined if we have file
    user_id: string,
    class_id?: string
): Promise<ProcessingResult> {
    const startTime = Date.now();
    let totalTokens = 0;

    console.log(`[process] Starting document processing for: ${document_id}`);

    let textToProcess = extracted_text;

    // If no text provided, we must fetch and extract from PDF
    if (!textToProcess) {
        if (!file_url) {
            throw new Error('Either file_url or extracted_text must be provided');
        }
        console.log('[process] No extracted text provided, fetching PDF...');

        // 1. Fetch PDF
        const pdfBase64 = await fetchPdfAsBase64(file_url);

        // 2. Extract text using Claude
        textToProcess = await extractTextFromPdf(pdfBase64, document_id);
    } else {
        console.log(`[process] Using pre-extracted text (${textToProcess.length} chars)`);
    }

    // 3. Chunk the text
    const chunks = chunkText(textToProcess);

    if (chunks.length === 0) {
        throw new Error('No text content could be extracted from document');
    }

    console.log(`[process] Created ${chunks.length} chunks`);

    // 4. Generate embeddings in batches
    const allVectors: PineconeVector[] = [];

    for (let i = 0; i < chunks.length; i += MAX_CHUNKS_PER_BATCH) {
        const batch = chunks.slice(i, i + MAX_CHUNKS_PER_BATCH);
        const batchTexts = batch.map(c => c.text);

        console.log(`[process] Generating embeddings for batch ${Math.floor(i / MAX_CHUNKS_PER_BATCH) + 1}/${Math.ceil(chunks.length / MAX_CHUNKS_PER_BATCH)}`);

        const embeddings = await generateEmbeddings(batchTexts);

        // Create Pinecone vectors with metadata
        for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j];
            const embedding = embeddings[j];

            totalTokens += embedding.tokens_used;

            allVectors.push({
                id: `${document_id}-chunk-${chunk.index}`,
                values: embedding.embedding,
                metadata: {
                    document_id: document_id,
                    chunk_index: chunk.index,
                    total_chunks: chunks.length,
                    text_content: chunk.text.substring(0, 1000), // Store first 1000 chars for display
                    word_count: chunk.wordCount,
                    user_id: user_id,
                    class_id: class_id || null,
                    page_hint: chunk.pageHint,
                    created_at: new Date().toISOString(),
                },
            });
        }
    }

    // 5. Upsert to Pinecone
    console.log(`[process] Upserting ${allVectors.length} vectors to Pinecone...`);

    // Upsert in batches of 100 (Pinecone limit)
    for (let i = 0; i < allVectors.length; i += 100) {
        const batch = allVectors.slice(i, i + 100);
        await upsertVectors(batch, PINECONE_NAMESPACE);
    }

    const processingTime = Date.now() - startTime;

    console.log(`[process] Complete! ${chunks.length} chunks in ${processingTime}ms`);

    return {
        success: true,
        document_id: document_id,
        chunk_count: chunks.length,
        total_tokens: totalTokens,
        processing_time_ms: processingTime,
        pinecone_namespace: PINECONE_NAMESPACE,
    };
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    try {
        // Verify authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        const body: ProcessRequest = await req.json();
        const { document_id, file_url, extracted_text, user_id, class_id, force_reprocess } = body;

        if (!document_id || (!file_url && !extracted_text) || !user_id) {
            throw new Error('Missing required fields: document_id, user_id, and either file_url or extracted_text');
        }

        console.log(`[process-document-embeddings] Processing document: ${document_id}`);
        console.log(`[process-document-embeddings] Force reprocess: ${force_reprocess || false}`);
        console.log(`[process-document-embeddings] Has extracted text: ${!!extracted_text}`);

        const supabase = createSupabaseClient();

        // Check if already processed
        if (!force_reprocess) {
            // Query Pinecone to see if chunks exist
            // For now, we'll just proceed - can add check later
        }

        // If forcing reprocess, delete existing vectors
        if (force_reprocess) {
            console.log('[process-document-embeddings] Deleting existing vectors...');
            try {
                // Generate IDs data object documents might have
                const existingIds = Array.from({ length: 200 }, (_, i) => `${document_id}-chunk-${i}`);
                await deleteVectors(existingIds, PINECONE_NAMESPACE);
            } catch (deleteError) {
                console.log('[process-document-embeddings] No existing vectors to delete');
            }
        }

        // Process the document
        const result = await processDocument(document_id, file_url, extracted_text, user_id, class_id);

        // Store processing record in Supabase (optional - for tracking)
        try {
            await supabase.from('document_processing').upsert({
                document_id: document_id,
                status: 'completed',
                chunk_count: result.chunk_count,
                total_tokens: result.total_tokens,
                processing_time_ms: result.processing_time_ms,
                pinecone_namespace: result.pinecone_namespace,
                completed_at: new Date().toISOString(),
            });
        } catch (dbError) {
            console.log('[process-document-embeddings] Could not save processing record (table may not exist)');
        }

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('[process-document-embeddings] Error:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: (error as any)?.message || 'Unknown error occurred',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});
