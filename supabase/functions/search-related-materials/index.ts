// =====================================
// SEARCH RELATED MATERIALS EDGE FUNCTION
// =====================================
// Searches for relevant content across class documents to provide
// related study materials for a specific topic.
// =====================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { OpenAI } from "https://esm.sh/openai@4.0.0";

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders, status: 204 });
    }

    try {
        // 2. Initialize Clients
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) {
            throw new Error("Missing OPENAI_API_KEY");
        }

        const openai = new OpenAI({
            apiKey: openaiApiKey,
        });

        // 3. Parse Request
        const { query, class_id, exclude_document_id, match_count = 5, document_types = null } = await req.json();

        if (!query || !class_id) {
            throw new Error("Missing required parameters: query, class_id");
        }

        console.log(`[search-related] Query: "${query.substring(0, 50)}...", Class: ${class_id}`);

        // 4. Generate Embedding
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
            encoding_format: "float",
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // 5. Search Database via RPC
        const supabase = createSupabaseClient();

        let chunks: any[] = [];

        // Try with document_types filter first (new schema)
        const { data: filteredChunks, error: filterError } = await supabase
            .rpc("match_class_document_chunks", {
                query_embedding: queryEmbedding,
                match_threshold: 0.25,
                match_count: match_count + 5,
                p_class_id: class_id,
                p_document_types: document_types
            });

        if (filterError) {
            // Fallback: try without document_types (old schema compatibility)
            console.log("[search-related] Trying fallback without document_types filter...");
            const { data: allChunks, error: fallbackError } = await supabase
                .rpc("match_class_document_chunks", {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.25,
                    match_count: match_count + 5,
                    p_class_id: class_id
                });

            if (fallbackError) {
                console.error("[search-related] RPC Error:", fallbackError);
                throw fallbackError;
            }
            chunks = allChunks || [];
        } else {
            chunks = filteredChunks || [];
        }

        // 6. Process and Filter Results
        // Filter out the excluded document if provided
        // Deduplicate by content or fuzzy match if necessary

        if (exclude_document_id) {
            chunks = chunks.filter((chunk: any) => chunk.document_id !== exclude_document_id);
        }

        // Limit to requested count
        const finalChunks = chunks.slice(0, match_count);

        // Enhance with helpful metadata if possible (e.g. presigned URLs? No, frontend handles that)
        // Just return the data.

        return new Response(
            JSON.stringify({
                success: true,
                matches: finalChunks
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error in search-related-materials:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
