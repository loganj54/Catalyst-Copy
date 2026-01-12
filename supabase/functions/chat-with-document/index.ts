// =====================================
// CHAT WITH DOCUMENT EDGE FUNCTION
// =====================================
// Performs RAG (Retrieval Augmented Generation) on the uploaded document.
//
// LOGIC:
// 1. Embeds the user's latest message (using OpenAI).
// 2. Searches `document_chunks` for relevant context.
// 3. Feeds context + chat history to LLM (using Grok).
// 4. Streams response back to client.
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
            throw new Error("Missing OPENAI_API_KEY for embeddings");
        }

        // Client for Embeddings (OpenAI)
        const embeddingClient = new OpenAI({
            apiKey: openaiApiKey,
        });

        // Client for Chat (xAI / Grok)
        // Prefer XAI_API_KEY, fallback to CHAT_API_KEY, then OPENAI_API_KEY
        const chatApiKey = Deno.env.get("XAI_API_KEY") || Deno.env.get("CHAT_API_KEY") || openaiApiKey;
        const chatBaseUrl = Deno.env.get("CHAT_BASE_URL") || "https://api.x.ai/v1";
        const chatModel = Deno.env.get("CHAT_MODEL") || "grok-4-1-fast-non-reasoning";

        const chatClient = new OpenAI({
            apiKey: chatApiKey,
            baseURL: chatBaseUrl,
        });

        // 3. Parse Request
        const { document_id, messages, current_message, class_id, include_class_context = true } = await req.json();

        if (!document_id || !messages) {
            throw new Error("Missing document_id or messages");
        }

        // Use the last message as the query if current_message isn't explicitly passed
        const query = current_message || messages[messages.length - 1].content;

        console.log(`[chat-with-document] Model: ${chatModel}, Query: "${query.substring(0, 50)}..."`);
        console.log(`[chat-with-document] Document ID: ${document_id}, Class ID: ${class_id || 'N/A'}`);

        // 4. Generate Embedding for the Query (OpenAI)
        const embeddingResponse = await embeddingClient.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
            encoding_format: "float",
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // 5. Retrieve Relevant Chunks via RPC
        const supabase = createSupabaseClient();
        let allChunks: any[] = [];
        const seenChunkIds = new Set();

        // --- A. Search Active Document (Primary Context) ---

        // First, check if any chunks exist for this document
        const { count: totalChunks } = await supabase
            .from("document_chunks")
            .select("*", { count: "exact", head: true })
            .eq("document_id", document_id);

        console.log(`[chat-with-document] Total chunks in DB for document ${document_id}: ${totalChunks || 0}`);

        // Try RPC first for semantic search
        const { data: docChunks, error: searchError } = await supabase
            .rpc("match_document_chunks", {
                query_embedding: queryEmbedding,
                match_threshold: 0.2, // Lowered further for better recall
                match_count: 5,
                filter_document_id: document_id,
            });

        if (searchError) {
            console.error("[chat-with-document] Vector search RPC error:", searchError.message);
            // Don't error out, try fallback
        }

        if (docChunks) {
            docChunks.forEach((chunk: any) => {
                if (!seenChunkIds.has(chunk.id || chunk.content)) { // Use content as backup key
                    allChunks.push({
                        ...chunk,
                        source: "Current Document", // Label for standard chunks
                        priority: "high"
                    });
                    seenChunkIds.add(chunk.id || chunk.content);
                }
            });
        }

        // Fallback: If RPC failed OR returned empty but chunks exist, get them directly
        if (allChunks.length === 0 && totalChunks && totalChunks > 0) {
            console.log("[chat-with-document] RPC returned empty, falling back to direct chunk retrieval...");
            const { data: directChunks, error: directError } = await supabase
                .from("document_chunks")
                .select("id, content")
                .eq("document_id", document_id)
                .order("chunk_index", { ascending: true })
                .limit(5);

            if (directError) {
                console.error("[chat-with-document] Direct chunk retrieval error:", directError);
            } else if (directChunks) {
                directChunks.forEach((chunk: any) => {
                    allChunks.push({
                        ...chunk,
                        source: "Current Document",
                        priority: "high"
                    });
                    seenChunkIds.add(chunk.id || chunk.content);
                });
                console.log(`[chat-with-document] Direct retrieval got ${allChunks.length} chunks`);
            }
        }

        // --- B. Search Class Documents (Secondary Context) ---
        if (class_id && include_class_context) {
            console.log(`[chat-with-document] Searching class documents for class ${class_id}...`);
            const { data: classChunks, error: classSearchError } = await supabase
                .rpc("match_class_document_chunks", {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.25, // Slightly higher threshold for broad search to reduce noise
                    match_count: 5,
                    p_class_id: class_id
                });

            if (classSearchError) {
                console.error("[chat-with-document] Class search RPC error:", classSearchError.message);
            } else if (classChunks) {
                console.log(`[chat-with-document] Found ${classChunks.length} class chunks`);
                classChunks.forEach((chunk: any) => {
                    // Deduplicate: avoid adding chunks we already have from the active document
                    // Note: match_class_document_chunks returns document_id, check against active document_id?
                    // Or just check content duplication.
                    // The RPC returns { document_id, document_name, content, similarity }

                    // Optimization: If it's the same document as active, we might have it already.
                    // But match_class returns document_name which is valuable.

                    const isSameDoc = chunk.document_id === document_id;

                    // Allow it even if same doc if we haven't seen this specific content, 
                    // OR if we want to upgrade the metadata (have name now).
                    // For simplicity, just add if content unique.

                    if (!seenChunkIds.has(chunk.content)) { // using content for dedupe across different queries
                        allChunks.push({
                            ...chunk,
                            source: chunk.document_name || "Class Document",
                            priority: isSameDoc ? "high" : "medium"
                        });
                        seenChunkIds.add(chunk.content);
                    }
                });
            }
        }

        console.log(`[chat-with-document] Final context has ${allChunks.length} chunks`);

        // 6. Construct Context String
        // Sort by priority/similarity if needed, but they are roughly ordered by retrieval.
        // We present them clearly labeled.
        const contextString = allChunks.map((c, i) =>
            `--- SOURCE: ${c.source} ---\n${c.content}`
        ).join("\n\n");

        // 7. Update System Message
        const baseSystemPrompt = `You are an expert AI tutor and assistant running on the Grok 4.1 model. 
    You are analyzing specific documents provided by the user. 
    Use the provided CONTEXT to answer the user's question accurately.
    
    IMPORTANT:
    - The CONTEXT may come from multiple documents (Lecture Notes, Homeworks, etc.).
    - ALWAYS cite the source when using information (e.g., "According to Lecture 3 Notes...").
    - If the context doesn't contain the answer, say "I couldn't find that specific information in the documents, but..." and then use your general knowledge.
    - Be concise, helpful, and educational.
    - Format your response in Markdown.`;

        const instructions = contextString
            ? `${baseSystemPrompt}\n\nRELEVANT DOCUMENT CONTEXT:\n${contextString}`
            : `${baseSystemPrompt}\n\n(No relevant document context found for this specific query)`;

        // Construct message array
        const messagesForLLM = [
            { role: "system", content: instructions },
            ...messages.filter(m => m.role !== "system").slice(-10)
        ];

        // 8. Call LLM with Streaming (Grok)
        const stream = await chatClient.chat.completions.create({
            model: chatModel,
            messages: messagesForLLM,
            stream: true,
            temperature: 0.3,
        });

        // 9. Return Stream
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        controller.enqueue(encoder.encode(content));
                    }
                }
                controller.close();
            },
        });

        return new Response(readable, {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error) {
        console.error("Error in chat-with-document:", error);

        // Return JSON error with CORS headers so client can read it
        return new Response(
            JSON.stringify({ error: error.message || "Internal Server Error" }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500
            }
        );
    }
});
