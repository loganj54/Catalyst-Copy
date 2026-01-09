// =====================================
// PROCESS DOCUMENT EMBEDDINGS EDGE FUNCTION
// =====================================
// Triggered CLIENT-SIDE after successful analysis OR when "Enable Chat" is clicked.
//
// LOGIC:
// 1. Accepts `document_id`
// 2. Checks if chunks already exist (idempotency)
// 3. Fetches `extracted_text` from `document_analyses`
// 4. Chunks the text (RecursiveCharacterTextSplitter logic)
// 5. Generates embeddings via OpenAI
// 6. Inserts into `document_chunks`
// =====================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { OpenAI } from "https://esm.sh/openai@4.0.0";

const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

// Simple recursive character splitter implementation (simplified for Deno)
function splitText(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
    if (!text || text.length === 0) return [];

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;

        // If not at the end of the text, try to find a nice breaking point
        if (endIndex < text.length) {
            // Look for paragraph breaks, then newlines, then spaces
            const lookbackWindow = Math.min(400, chunkSize * 0.2); // Look back 20% or 400 chars
            const textWindow = text.substring(endIndex - lookbackWindow, endIndex);

            const lastParagraph = textWindow.lastIndexOf('\n\n');
            const lastNewline = textWindow.lastIndexOf('\n');
            const lastPeriod = textWindow.lastIndexOf('. ');
            const lastSpace = textWindow.lastIndexOf(' ');

            if (lastParagraph !== -1) {
                endIndex = endIndex - lookbackWindow + lastParagraph + 2;
            } else if (lastNewline !== -1) {
                endIndex = endIndex - lookbackWindow + lastNewline + 1;
            } else if (lastPeriod !== -1) {
                endIndex = endIndex - lookbackWindow + lastPeriod + 1;
            } else if (lastSpace !== -1) {
                endIndex = endIndex - lookbackWindow + lastSpace;
            }
        } else {
            endIndex = text.length;
        }

        // Safety check - if we didn't advance, force advance
        if (endIndex <= startIndex) {
            endIndex = Math.min(startIndex + chunkSize, text.length);
        }

        const chunk = text.substring(startIndex, endIndex).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        // Move forward, backing up by overlap amount (unless we hit end)
        startIndex = endIndex;
        if (startIndex < text.length) {
            startIndex = Math.max(0, startIndex - overlap);
        }
    }

    return chunks;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders, status: 204 });
    }

    try {
        // Accept both document_id and optional extracted_text parameter
        const { document_id, extracted_text: providedText } = await req.json();
        if (!document_id) {
            throw new Error("Missing document_id");
        }

        console.log(`[process-embeddings] Processing document: ${document_id}`);
        console.log(`[process-embeddings] Text provided directly: ${providedText ? 'Yes' : 'No'}`);

        const supabase = createSupabaseClient();

        // 1. Check if chunks already exist
        const { count, error: countError } = await supabase
            .from("document_chunks")
            .select("*", { count: "exact", head: true })
            .eq("document_id", document_id);

        if (countError) throw countError;

        if (count && count > 0) {
            console.log(`[process-embeddings] Embeddings already exist (${count} chunks)`);
            return new Response(
                JSON.stringify({ success: true, message: "Embeddings already exist", count }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Get text - either from parameter or from database
        let text = providedText;

        if (!text) {
            console.log(`[process-embeddings] No text provided, fetching from database...`);

            // Try by document_id first
            const { data: analysis, error: analysisError } = await supabase
                .from("document_analyses")
                .select("id, extracted_text, raw_analysis")
                .eq("document_id", document_id)
                .maybeSingle();

            console.log(`[process-embeddings] Query by document_id result:`, {
                found: !!analysis,
                hasExtractedText: !!analysis?.extracted_text,
                extractedTextLength: analysis?.extracted_text?.length || 0,
                hasRawAnalysis: !!analysis?.raw_analysis,
                error: analysisError?.message
            });

            if (analysis?.extracted_text) {
                text = analysis.extracted_text;
                console.log(`[process-embeddings] Found text in document_analyses by document_id`);
            } else if (analysis?.raw_analysis) {
                // Fallback: stringify the raw_analysis as text
                text = JSON.stringify(analysis.raw_analysis, null, 2);
                console.log(`[process-embeddings] Using stringified raw_analysis as fallback`);
            }
        }

        // Fallback: Try to get blueprint_id from request and query by that
        if (!text) {
            console.log(`[process-embeddings] Trying to find blueprint for document...`);
            const { data: blueprint } = await supabase
                .from("blueprints")
                .select("id")
                .eq("document_id", document_id)
                .maybeSingle();

            if (blueprint?.id) {
                console.log(`[process-embeddings] Found blueprint ${blueprint.id}, querying analysis by blueprint_id...`);
                const { data: bpAnalysis, error: bpError } = await supabase
                    .from("document_analyses")
                    .select("id, extracted_text, raw_analysis")
                    .eq("blueprint_id", blueprint.id)
                    .maybeSingle();

                console.log(`[process-embeddings] Query by blueprint_id result:`, {
                    found: !!bpAnalysis,
                    analysisId: bpAnalysis?.id,
                    hasExtractedText: !!bpAnalysis?.extracted_text,
                    extractedTextLength: bpAnalysis?.extracted_text?.length || 0,
                    hasRawAnalysis: !!bpAnalysis?.raw_analysis,
                    error: bpError?.message
                });

                if (bpAnalysis?.extracted_text) {
                    text = bpAnalysis.extracted_text;
                    console.log(`[process-embeddings] Found text via blueprint_id fallback`);
                } else if (bpAnalysis?.raw_analysis) {
                    // Fallback: stringify the raw_analysis as text
                    text = JSON.stringify(bpAnalysis.raw_analysis, null, 2);
                    console.log(`[process-embeddings] Using stringified raw_analysis from blueprint fallback`);
                }
            } else {
                console.log(`[process-embeddings] No blueprint found for document_id ${document_id}`);
            }
        }

        if (!text) {
            console.error(`[process-embeddings] FATAL: No text available for document ${document_id}`);
            console.error(`[process-embeddings] This means: no extracted_text AND no raw_analysis in document_analyses table`);
            throw new Error("No extracted text found. Please run document analysis first from the Blueprint page (click Analyze Step).");
        }

        console.log(`[process-embeddings] Text length: ${text.length} characters`);

        // 3. Split content into logical chunks
        // Target ~500-800 tokens. 1 token ~= 4 chars typically.
        // 2000-3000 chars is decent chunk size.
        const chunks = splitText(text, 2500, 300);
        console.log(`Document split into ${chunks.length} chunks`);

        // 4. Generate Embeddings (batch if needed)
        // OpenAI limit is usually 2048 dimensions or batch size issues.
        // text-embedding-3-small is cheap. We can batch send.
        // We'll process in batches of 20 to be safe.

        const BATCH_SIZE = 20;
        let savedChunksCount = 0;

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);

            console.log(`Generating embeddings for batch ${i / BATCH_SIZE + 1}...`);

            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: batch,
                encoding_format: "float",
            });

            const rowsToInsert = batch.map((chunkContent, idx) => ({
                document_id,
                content: chunkContent,
                chunk_index: i + idx,
                embedding: embeddingResponse.data[idx].embedding,
                token_count: Math.ceil(chunkContent.length / 4) // Rough estimate
            }));

            // 5. Insert into DB
            const { error: insertError } = await supabase
                .from("document_chunks")
                .insert(rowsToInsert);

            if (insertError) {
                console.error("Error inserting chunks:", insertError);
                throw insertError;
            }

            savedChunksCount += rowsToInsert.length;
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Successfully generated embeddings",
                chunks_count: savedChunksCount
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error processing document embeddings:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
