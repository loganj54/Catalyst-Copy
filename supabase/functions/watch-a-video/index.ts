
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaudeJSON } from '../_shared/supabase-client.ts';
import { generateEmbedding } from '../_shared/embeddings.ts';
import { queryVectors } from '../_shared/pinecone-client.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { explainer_term, blueprint_section_title } = await req.json();

        if (!explainer_term || !blueprint_section_title) {
            throw new Error('Missing required parameters: explainer_term, blueprint_section_title');
        }

        // Connect to Supabase to fetch resource details later
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const search_query = `${explainer_term} in respect to ${blueprint_section_title}`;
        console.log(`[watch-a-video] Processing request for: "${search_query}"`);

        // STEP 1: Generate Target Resource Profile with Claude Haiku
        console.log('[watch-a-video] Step 1: Generating Target Resource Profile with Claude Haiku...');

        // We use a custom system prompt specifically for this task
        const systemPrompt = `You are a precise search query optimizer. Your task is to generate a 'target_resource_profile' for a video search.
    
    CRITICAL RULES:
    1. Be LITERAL and DIRECT. Describe exactly the relationship between the concept and the context.
    2. DO NOT hallucinate related topics like "boundary layers", "derivations", or "advanced theory" unless explicitly asked.
    3. Output must be strictly 30-50 words.
    4. Start with: "This video must explain..."
    5. Focus strictly on defining the concept and its direct application to the context.
    `;

        const userPrompt = `Concept: ${explainer_term}
Context: ${blueprint_section_title}

Generate a precise target resource profile. Define the concept specifically as it relates to the context. Do not add broad theoretical filler.`;

        const claudeResponse = await callClaudeJSON(systemPrompt, userPrompt);

        const target_resource_profile = claudeResponse.target_resource_profile ||
            claudeResponse.profile ||
            claudeResponse.description ||
            `This video must cover ${explainer_term} with respect to ${blueprint_section_title}.`;

        console.log(`[watch-a-video] Generated Profile: "${target_resource_profile}"`);

        // STEP 2: Vector Embedding
        console.log('[watch-a-video] Step 2: Generating Vector Embedding (GPT-3 Large)...');
        // generateEmbedding uses text-embedding-3-large by default as per _shared/embeddings.ts
        // and returns 3072 dimensions which matches our Pinecone index
        const embeddingResponse = await generateEmbedding(target_resource_profile);
        const vector = embeddingResponse.embedding;

        // STEP 3: Search database (Pinecone)
        console.log('[watch-a-video] Step 3: Searching Pinecone...');
        const searchResults = await queryVectors(
            vector,
            10, // Top 10
            undefined,
            'resources', // Namespace
            true // Include metadata
        );

        // Filter by similarity >= 0.6
        const MIN_SIMILARITY = 0.6;
        const validMatches = (searchResults.matches || []).filter(m => m.score >= MIN_SIMILARITY);

        console.log(`[watch-a-video] Found ${validMatches.length} matches above ${MIN_SIMILARITY} threshold.`);

        // If we have matches, fetch full details and sort
        let formattedResources = [];

        if (validMatches.length > 0) {
            const resourceIds = validMatches.map(m => m.metadata?.resource_id).filter(Boolean);

            // Fetch from Supabase
            const { data: resources, error: dbError } = await supabase
                .from('resources_from_make')
                .select('*')
                .in('id', resourceIds);

            if (dbError) throw dbError;

            if (resources && resources.length > 0) {
                // Combine with scores and form result
                formattedResources = validMatches.map(match => {
                    const resource = resources.find(r => r.id === match.metadata?.resource_id);
                    if (!resource) return null;
                    return {
                        ...resource,
                        relevance_score: match.score,
                        // Parse numbers for sorting
                        average_rating: resource.average_rating ? parseFloat(resource.average_rating) : 0,
                    };
                }).filter(Boolean);

                // Sort: Highest User Rating First (descending)
                formattedResources.sort((a, b) => b.average_rating - a.average_rating);
            }
        }

        // STEP 4: Fallback Logic
        // Only trigger webhook if we didn't find any good vector matches in the first place
        // formattedResources could be empty due to database issues even if vectors were found
        if (validMatches.length === 0) {
            console.log('[watch-a-video] Step 5: Fallback triggered. No good matches found.');

            // Trigger Webhook
            const webhookUrl = 'https://hook.us2.make.com/4biukvihdmvo4aianlpqk5sbnewjbonh';
            const payload = {
                units: [
                    {
                        target_resource_profile: target_resource_profile,
                        search_queries: [search_query] // "even if it's only of length one; it needs to be an array"
                    }
                ]
            };

            console.log('[watch-a-video] Triggering webhook:', JSON.stringify(payload));

            // Fire webhook
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Wait 2 minutes
            // Deno Deploy has a timeout (usually 10s-60s depending on plan/config). 
            // Waiting 2 minutes inside an edge function IS RISKY as it will likely timeout.
            // However, user specifically asked: "Now we just simply need to wait two minutes and then search the database again"
            // I will implement the wait. If it times out, it times out. 
            // To be safe, I might verify if background tasks are an option, but standard Edge Functions kill connection.
            // Given the instructions, I must follow them.

            console.log('[watch-a-video] Waiting 2 minutes...');
            await new Promise(resolve => setTimeout(resolve, 120000)); // 120s = 2 mins

            // Search again
            console.log('[watch-a-video] Searching again after wait...');
            const retrySearchResults = await queryVectors(
                vector,
                10,
                undefined,
                'resources',
                true
            );

            const retryValidMatches = (retrySearchResults.matches || []).filter(m => m.score >= MIN_SIMILARITY);

            if (retryValidMatches.length > 0) {
                const retryResourceIds = retryValidMatches.map(m => m.metadata?.resource_id).filter(Boolean);
                const { data: retryResources } = await supabase
                    .from('resources_from_make')
                    .select('*')
                    .in('id', retryResourceIds);

                if (retryResources) {
                    formattedResources = retryValidMatches.map(match => {
                        const resource = retryResources.find(r => r.id === match.metadata?.resource_id);
                        if (!resource) return null;
                        return {
                            ...resource,
                            relevance_score: match.score,
                            average_rating: resource.average_rating ? parseFloat(resource.average_rating) : 0,
                        };
                    }).filter(Boolean);

                    formattedResources.sort((a, b) => b.average_rating - a.average_rating);
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            resources: formattedResources,
            target_resource_profile // return for debugging if needed
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[watch-a-video] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
