// ============================================================================
// GENERATE-VIDEO-QUERIES
// ============================================================================
// Uses Claude Haiku 4.5 to generate 5 context-aware search queries
// based on the highlighted term and solution context.
// 
// Step 1 of video search flow - generates queries only (no target profile)
// Target resource profile is generated later in find-videos-sandbox
// after user selects a specific query.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaude } from '../_shared/supabase-client.ts';

// ============================================================================
// TYPES
// ============================================================================

interface GenerateVideoQueriesRequest {
    term: string;                    // The highlighted word (e.g., "Nusselt number")
    context?: string;                // Unit topic / section context
    solutionContext?: string;        // The full solution walkthrough text
}

interface GenerateVideoQueriesResponse {
    success: boolean;
    queries?: string[];              // 5 AI-generated search queries
    error?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    console.log('='.repeat(80));
    console.log('[generate-video-queries] Request received');
    console.log('='.repeat(80));

    try {
        // Parse request
        const body: GenerateVideoQueriesRequest = await req.json();
        const { term, context, solutionContext } = body;

        console.log(`[generate-video-queries] Term: "${term}"`);
        console.log(`[generate-video-queries] Context: ${context || 'none'}`);
        console.log(`[generate-video-queries] Has solution context: ${!!solutionContext}`);

        // Validate required fields
        if (!term) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required field: term'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ========================================================================
        // GENERATE 5 CONTEXTUAL SEARCH QUERIES
        // ========================================================================

        const systemPrompt = `You are an expert educational content curator who helps students find the perfect tutorial videos. Your job is to generate YouTube search queries that will help students who are confused about a specific term while working through a problem.

You understand that students have different needs:
- Some need the basics ("what is X?")
- Some need to visualize abstract concepts
- Some need to see the math worked out step-by-step
- Some need to understand how concepts connect to each other
- Some need real-world applications to make it click

Generate search queries that a real student would actually type into YouTube.`;

        let userPrompt: string;

        if (solutionContext) {
            userPrompt = `A student is working through this problem/solution and is confused about "${term}":

PROBLEM/SOLUTION CONTEXT:
${solutionContext.substring(0, 3000)}${solutionContext.length > 3000 ? '...' : ''}

${context ? `TOPIC AREA: ${context}` : ''}

Ask yourself: "What could someone be missing or wondering about from this solution walkthrough with respect to ${term}?"

Generate EXACTLY 5 YouTube search queries:
1. The first query MUST be: "What is ${term}?"
2. The other 4 should be highly contextual and relevant to what the student might be confused about, based on how "${term}" appears in this specific problem.

IMPORTANT GUIDELINES:
- Do NOT force queries into rigid categories
- Generate queries that naturally arise from the problem context
- Consider: visualizations, equations, connections to other concepts, derivations, applications
- If "${term}" is a simple concept like "diameter", don't hallucinate complex connections - keep it relevant to how it's used in the problem
- Make queries specific enough to find good educational content

Return ONLY a JSON array of 5 strings, no explanation:
["query 1", "query 2", "query 3", "query 4", "query 5"]`;
        } else {
            userPrompt = `A student is confused about "${term}" ${context ? `in the context of ${context}` : ''}.

Ask yourself: "What could someone commonly misunderstand or wonder about regarding ${term}?"

Generate EXACTLY 5 YouTube search queries:
1. The first query MUST be: "What is ${term}?"
2. The other 4 should cover different learning needs - visualizations, math explanations, connections to related concepts, applications, etc.

Return ONLY a JSON array of 5 strings, no explanation:
["query 1", "query 2", "query 3", "query 4", "query 5"]`;
        }

        console.log('[generate-video-queries] Calling Claude to generate queries...');

        const result = await callClaude(systemPrompt, userPrompt, {
            temperature: 0.7,  // Some creativity for varied queries
            maxTokens: 500
        });

        console.log('[generate-video-queries] Claude response received');

        // Parse the JSON array from Claude's response
        let queries: string[];
        try {
            // Clean the response - sometimes Claude adds markdown code blocks
            let cleanedContent = result.content.trim();
            if (cleanedContent.startsWith('```json')) {
                cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedContent.startsWith('```')) {
                cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            queries = JSON.parse(cleanedContent);

            if (!Array.isArray(queries) || queries.length !== 5) {
                throw new Error('Expected exactly 5 queries');
            }
        } catch (parseError) {
            console.error('[generate-video-queries] Failed to parse Claude response:', result.content);

            // Fallback: generate basic queries
            queries = [
                `What is ${term}?`,
                `${term} explained simply`,
                `${term} visualization`,
                `How does ${term} work?`,
                `${term} examples`
            ];
            console.log('[generate-video-queries] Using fallback queries');
        }

        console.log('[generate-video-queries] Generated queries:');
        queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

        const response: GenerateVideoQueriesResponse = {
            success: true,
            queries
        };

        return new Response(
            JSON.stringify(response),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[generate-video-queries] Fatal error:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
