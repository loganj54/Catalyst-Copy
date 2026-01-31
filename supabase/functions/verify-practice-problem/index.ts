import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseClientWithAuth } from '../_shared/supabase-client.ts';
import { generateEmbedding } from '../_shared/embeddings.ts';
import { upsertVectors, queryVectors } from '../_shared/pinecone-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';

const PINECONE_NAMESPACE = 'practice_problems';
const SIMILARITY_THRESHOLD = 0.97;

interface RequestBody {
    topic: string;
    original_problem: string;
    unit_id: string;
    blueprint_id: string;
    context?: {
        learning_objective?: string;
        unit_type?: string;
        description?: string;
    };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const body: RequestBody = await req.json();
        const { topic, original_problem, unit_id, blueprint_id, context } = body;

        const supabaseAuth = createSupabaseClientWithAuth(authHeader);
        const supabaseService = createSupabaseClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) throw new Error('Could not verify user');

        // Helper to clean and parse JSON from model output
        const parseModelJson = (content: string, modelName: string) => {
            try {
                // First try standard parsing after basic cleanup
                const cleanStr = content.trim();
                return JSON.parse(cleanStr);
            } catch (e1) {
                try {
                    // Try to find JSON block regex
                    const jsonMatch = content.match(/```json\s*({[\s\S]*?})\s*```/) ||
                        content.match(/{[\s\S]*}/);

                    if (jsonMatch) {
                        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
                    }
                    throw new Error('No JSON found in response');
                } catch (e2) {
                    console.error(`[verify-practice-problem] ${modelName} JSON parse error. Raw content:`, content);
                    throw e2;
                }
            }
        };

        // 1. Check Cache (Pinecone)
        const searchText = `${topic}: ${original_problem || 'practice problem'}`;
        const { embedding } = await generateEmbedding(searchText);

        // Use initial embedding for cache storage too, unless we regenerate it later
        const embeddingForCache = embedding;

        // Query Pinecone
        const pineconeResults = await queryVectors(embedding, 1, undefined, PINECONE_NAMESPACE, true);
        if (pineconeResults.matches?.[0]?.score >= SIMILARITY_THRESHOLD) {
            const bestMatch = pineconeResults.matches[0];
            if (bestMatch.metadata?.supabase_id) {
                // ... fetch from Supabase (same as before) ...
                const { data: cachedProblem } = await supabaseService
                    .from('practice_problems_cache')
                    .select('*')
                    .eq('id', bestMatch.metadata.supabase_id)
                    .single();

                if (cachedProblem) {
                    console.log(`[verify-practice-problem] ✅ Cache HIT!`);
                    // Update usage and link
                    await supabaseService
                        .from('practice_problems_cache')
                        .update({
                            times_used: (cachedProblem.times_used || 0) + 1,
                            last_used_at: new Date().toISOString()
                        })
                        .eq('id', cachedProblem.id);

                    await supabaseAuth
                        .from('blueprint_practice_problems')
                        .insert({
                            blueprint_id,
                            unit_id,
                            cached_problem_id: cachedProblem.id
                        });

                    return new Response(JSON.stringify({
                        success: true,
                        from_cache: true,
                        verified: true,
                        problem: {
                            problem_name: cachedProblem.problem_name || 'Practice Problem',
                            practice_problem: cachedProblem.problem_statement,
                            given_values: cachedProblem.given_values,
                            hints: cachedProblem.hints,
                            solution_steps: cachedProblem.solution_steps,
                            final_answer: cachedProblem.final_answer
                        }
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            }
        }

        // 2. Generation & Verification Loop
        console.log(`[verify-practice-problem] Cache MISS - generating new problem...`);
        const grokApiKey = Deno.env.get('XAI_API_KEY');
        const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        const googleApiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');

        let attempts = 0;
        const MAX_ATTEMPTS = 2;
        let isVerified = false;
        let finalProblem: any = null;
        let finalVerificationData: any = null;
        let lastGrokResult: any = null;

        while (attempts < MAX_ATTEMPTS && !isVerified) {
            attempts++;
            console.log(`[verify-practice-problem] Attempt ${attempts}/${MAX_ATTEMPTS}...`);

            // A. Generate with Grok
            const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${grokApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'grok-4-1-fast-non-reasoning',
                    messages: [
                        { role: 'system', content: PROMPTS.verifiedPracticeProblemGeneration.system },
                        { role: 'user', content: PROMPTS.verifiedPracticeProblemGeneration.user(topic, original_problem || '', context || {}) }
                    ],
                    temperature: 0.7 + (attempts * 0.1),
                    response_format: { type: 'json_object' }
                })
            });

            if (!grokRes.ok) continue;
            const grokJson = await grokRes.json();
            let grokResult;
            try { grokResult = parseModelJson(grokJson.choices[0].message.content, 'Grok'); } catch { continue; }

            lastGrokResult = grokResult;

            const problemStatement = grokResult.practice_problem;
            const grokAnswer = grokResult.final_answer;
            console.log(`[verify-practice-problem] Grok Answer: ${grokAnswer}`);

            // B. Parallel Verification (Sonnet 4.5, GPT-4o, Gemini 1.5 Pro, Opus 3)
            const verifiers = [];

            // 1. Sonnet 4.5
            if (anthropicApiKey) {
                verifiers.push((async () => {
                    try {
                        const res = await fetch('https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: { 'x-api-key': anthropicApiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: 'claude-sonnet-4-5',
                                max_tokens: 256,
                                messages: [{ role: 'user', content: PROMPTS.answerOnlyVerification.user(problemStatement) }],
                                system: PROMPTS.answerOnlyVerification.system
                            })
                        });
                        const data = await res.json();
                        const parsed = parseModelJson(data.content[0].text, 'Sonnet');
                        return { model: 'sonnet', answer: parsed.final_answer };
                    } catch (e) { console.warn('Sonnet failed', e); return { model: 'sonnet', answer: null }; }
                })());
            }

            // 2. GPT-4o
            if (openaiApiKey) {
                verifiers.push((async () => {
                    try {
                        const res = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: 'gpt-4o',
                                max_tokens: 256,
                                messages: [
                                    { role: 'system', content: PROMPTS.answerOnlyVerification.system },
                                    { role: 'user', content: PROMPTS.answerOnlyVerification.user(problemStatement) }
                                ],
                                response_format: { type: 'json_object' }
                            })
                        });
                        const data = await res.json();
                        const parsed = parseModelJson(data.choices[0].message.content, 'GPT');
                        return { model: 'gpt', answer: parsed.final_answer };
                    } catch (e) { console.warn('GPT failed', e); return { model: 'gpt', answer: null }; }
                })());
            }

            // 3. Gemini 1.5 Pro
            if (googleApiKey) {
                verifiers.push((async () => {
                    try {
                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: PROMPTS.answerOnlyVerification.system + "\n\n" + PROMPTS.answerOnlyVerification.user(problemStatement) }] }],
                                generationConfig: { responseMimeType: "application/json" }
                            })
                        });
                        const data = await res.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (!text) return { model: 'gemini', answer: null };
                        const parsed = parseModelJson(text, 'Gemini');
                        return { model: 'gemini', answer: parsed.final_answer };
                    } catch (e) { console.warn('Gemini failed', e); return { model: 'gemini', answer: null }; }
                })());
            }

            // 4. Claude 3 Opus
            if (anthropicApiKey) {
                verifiers.push((async () => {
                    try {
                        const res = await fetch('https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: { 'x-api-key': anthropicApiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: 'claude-opus-4-5',
                                max_tokens: 256,
                                messages: [{ role: 'user', content: PROMPTS.answerOnlyVerification.user(problemStatement) }],
                                system: PROMPTS.answerOnlyVerification.system
                            })
                        });
                        const data = await res.json();
                        const parsed = parseModelJson(data.content[0].text, 'Opus');
                        return { model: 'opus', answer: parsed.final_answer };
                    } catch (e) { console.warn('Opus failed', e); return { model: 'opus', answer: null }; }
                })());
            }

            const verifiedResults = await Promise.all(verifiers);

            const answersMap: Record<string, string | null> = { 'grok': grokAnswer };
            verifiedResults.forEach(r => answersMap[r.model] = r.answer);

            console.log('Verifiers results:', JSON.stringify(answersMap, null, 2));

            // C. Judge (Sonnet 4.5)
            // Decide consensus using LLM instead of regex
            if (anthropicApiKey) {
                try {
                    const judgeRes = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: { 'x-api-key': anthropicApiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'claude-sonnet-4-5',
                            max_tokens: 2048,
                            messages: [{ role: 'user', content: PROMPTS.verificationJudge.user(problemStatement, answersMap) }],
                            system: PROMPTS.verificationJudge.system
                        })
                    });
                    const judgeData = await judgeRes.json();
                    const judgeParsed = parseModelJson(judgeData.content[0].text, 'Judge');

                    console.log('Judge decision:', judgeParsed);

                    if (judgeParsed.consensus_found) {
                        isVerified = true;
                        finalProblem = grokResult;
                        finalVerificationData = {
                            models_agreed: judgeParsed.models_agreed,
                            verified_answer: judgeParsed.verified_answer,
                            all_answers: answersMap
                        };
                    }
                } catch (e) {
                    console.error('Judge failed', e);
                }
            }
        } // end while

        // 3. Cache and Return
        if (isVerified && finalProblem) {
            // Store in Supabase
            const { data: cached } = await supabaseService
                .from('practice_problems_cache')
                .insert({
                    problem_name: finalProblem.problem_name || 'Practice Problem',
                    problem_statement: finalProblem.practice_problem,
                    context: context || {},
                    given_values: finalProblem.given_values,
                    hints: finalProblem.hints,
                    solution_steps: finalProblem.solution_steps,
                    final_answer: finalProblem.final_answer, // Grok's detailed answer text
                    verification_status: 'verified',
                    models_agreed: finalVerificationData.models_agreed,
                    grok_answer: finalVerificationData.all_answers.grok,
                    sonnet_answer: finalVerificationData.all_answers.sonnet,
                    gpt_answer: finalVerificationData.all_answers.gpt
                    // Add gemini/opus columns if needed? For now just store standard ones or extend JSON
                })
                .select()
                .single();

            if (cached) {
                await upsertVectors([{
                    id: `practice-${cached.id}`,
                    values: embeddingForCache,
                    metadata: {
                        supabase_id: cached.id,
                        topic,
                        problem_preview: finalProblem.practice_problem.substring(0, 200)
                    }
                }], PINECONE_NAMESPACE);

                await supabaseAuth.from('blueprint_practice_problems').insert({
                    blueprint_id, unit_id, cached_problem_id: cached.id
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            from_cache: false,
            verified: isVerified,
            problem: finalProblem || lastGrokResult || {}, // Fallback to last grok result if unverified
            verification: finalVerificationData || { status: 'failed_verification' }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('Func Error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
    }
});
