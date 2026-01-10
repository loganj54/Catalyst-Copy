import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { OpenAI } from "https://esm.sh/openai@4.0.0";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders, status: 204 });
    }

    try {
        const { message, thread_id } = await req.json();

        if (!message || !thread_id) {
            throw new Error("Missing message or thread_id");
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        const openai = new OpenAI({ apiKey });

        // Generate a title
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fast and cheap
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that generates a short, concise title (max 4-5 words) for a chat conversation based on the user's first message. Do not use quotes. Just return the title."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            max_tokens: 20
        });

        const title = response.choices[0].message.content?.trim() || "New Conversation";

        // Update the thread in Supabase
        const supabase = createSupabaseClient();
        const { error } = await supabase
            .from('chat_threads')
            .update({ title: title })
            .eq('id', thread_id);

        if (error) throw error;

        return new Response(
            JSON.stringify({ title }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error generating title:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
