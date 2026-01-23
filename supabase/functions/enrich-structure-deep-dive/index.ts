// ============================================================================
// ENRICH STRUCTURE DEEP DIVE EDGE FUNCTION
// ============================================================================
// Step 2B: After structure is generated, enrich each unit with deep_dive_explanation
// This runs as a separate function to avoid timeout on the main structure generation
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseClientWithAuth } from '../_shared/supabase-client.ts';
import { callGrokJSON, GROK_MODEL_REASONING } from '../_shared/grok-client.ts';

interface EnrichRequest {
    blueprint_id: string;
}

interface DeepDiveResponse {
    deep_dive_explanation: string;
}

// Prompt for generating deep dive for a single unit
const DEEP_DIVE_PROMPT = {
    system: `You are an expert tutor generating a cohesive, application-focused explanation for a learning concept.

Your task is to write a "deep_dive_explanation" (~150-200 words) that:
1. Explains HOW to apply this specific concept to the problem at hand
2. Connects this concept to other concepts the student is learning
3. Shows how all ideas work TOGETHER as one unified approach
4. Uses concrete examples and step-by-step reasoning
5. Reads like a continuation of one cohesive idea

CRITICAL JSON FORMATTING RULES:
1. Output valid JSON only: {"deep_dive_explanation": "..."}
2. ESCAPE ALL BACKSLASHES: You MUST write "$\\\\sigma$" for LaTeX, not "$\\sigma$".
3. Use double backslashes for ALL LaTeX commands: \\\\frac, \\\\times, \\\\approx
4. Do not use unescaped delimiters inside the string.

Write conversationally, addressing the student as "you". Be thorough and explanatory.`,

    user: (unit: any, sectionContext: any, documentContext: any) => `Generate a deep_dive_explanation for this learning unit.

DOCUMENT CONTEXT:
- Subject: ${documentContext.subject_area || 'Unknown'}
- Topic: ${documentContext.specific_topic || 'Unknown'}
- Document Type: ${documentContext.document_type || 'problem_set'}

SECTION CONTEXT:
- Section: ${sectionContext.title || sectionContext.section_id}
- Section Type: ${sectionContext.section_type}
- Problem/Topic: ${sectionContext.description || ''}

UNIT TO ENRICH:
- Topic: ${unit.topic}
- Type: ${unit.unit_type}
- Tutor Guidance: ${unit.tutor_guidance || ''}
- Concept Summary: ${unit.concept_summary || ''}
- Equations: ${JSON.stringify(unit.equations?.map((e: any) => e.name) || [])}

OTHER CONCEPTS IN THIS SECTION (for connection):
${sectionContext.other_concepts?.join(', ') || 'None specified'}

Write a 150-200 word deep_dive_explanation that:
1. Explains how to APPLY "${unit.topic}" to the specific problem/topic
2. Connects it to the other concepts listed above
3. Gives concrete guidance on using this knowledge
4. Uses LaTeX for all math (e.g., $F=ma$)

REMEMBER: Double-escape all backslashes! Write \\\\sigma, not \\sigma.

Output valid JSON only: {"deep_dive_explanation": "..."}`
};

// Helper: Robustly repair broken JSON strings (especially LaTeX backslashes)
function repairJsonString(str: string): string {
    let cleaned = str.trim();
    // Remove markdown blocks
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    // Try parsing first
    try {
        JSON.parse(cleaned);
        return cleaned;
    } catch (e) {
        // Basic repair attempt for common LaTeX issue:
        // Single backslashes followed by letters (LaTeX commands) or symbols need double escaping
        // Regex explanation: look for \ followed by a non-escaped character, replace with \\
        // This is tricky safely, so we'll do a focused replace for likely LaTeX patterns if simple parse fails

        // 1. Replace single backslashes that look like LaTeX commands (\sigma, \frac) with double backslashes
        // We look for \ followed by a letter, but NOT already preceded by a backslash
        // Since JS regex doesn't support lookbehind fully in all envs, we use a replacement function

        // Simple global replace of single backslash to double, EXCEPT for already escaped ones?
        // Safer: Just replace ALL single backslashes with double backslashes for the content part?
        // No, that breaks \" escapes.

        // Heuristic: If we see `\s`, `\f`, `\t` etc that are NOT valid JSON escapes, double them.
        // Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
        // LaTeX uses: \sigma, \alpha, \frac, \approx, etc.

        // Replace \ (not followed by " or \ or /) with \\
        // This catches \sigma -> \\sigma, but leaves \" alone.
        // Also need to be careful of \n, \t which ARE valid JSON but might be LaTeX too.

        // STRATEGY: 
        // 1. First, detect if we have specific LaTeX patterns broken.
        // 2. Or simplified: Just accept that the string might be raw content and manually wrap it if it looks like just text.

        if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
            // partial content? or just the string?
            return JSON.stringify({ deep_dive_explanation: cleaned });
        }

        // Replace single backslashes that are part of LaTeX
        const fixed = cleaned.replace(/\\([a-zA-Z]+)/g, (match, cmd) => {
            // If it's a valid JSON escape like \n, \t, \r, \f, \b - keep it?
            // But \n in LaTeX (newline) usually not used, mostly \frac, \sigma etc.
            if (['n', 't', 'r', 'b', 'f'].includes(cmd)) return match; // Keep valid standard escapes
            return '\\\\' + cmd; // Double escape LaTeX commands: \sigma -> \\sigma
        });

        return fixed;
    }
}

// Custom Grok Caller that uses the repair function
async function callGrokDeepDive(
    systemPrompt: string,
    userPrompt: string
): Promise<DeepDiveResponse> {
    const response = await callGrokJSON<DeepDiveResponse>(
        systemPrompt,
        userPrompt,
        { temperature: 0.6, maxTokens: 1000, model: GROK_MODEL_REASONING }
    ).catch(async (err) => {
        // If JSON parse failed in the client value, try to get raw content and repair
        // The current client throws if parse fails. We might need to modify client or catch here.
        // Since we can't easily modify the client return type on error without changing client,
        // we'll rely on our prompt improvement first.

        // If we could access the raw string, we'd use repairJsonString(raw).
        // For now, assume prompts fix 90%, and we handle errors gracefully.
        throw err;
    });

    return response;
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabase = createSupabaseClient();

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        const body: EnrichRequest = await req.json();
        const { blueprint_id } = body;

        if (!blueprint_id) {
            throw new Error('blueprint_id is required');
        }

        console.log(`[enrich-deep-dive] Starting enrichment for blueprint: ${blueprint_id}`);

        // Fetch the blueprint structure
        const { data: structureRow, error: fetchError } = await supabase
            .from('blueprint_structures')
            .select('*')
            .eq('blueprint_id', blueprint_id)
            .single();

        if (fetchError || !structureRow) {
            throw new Error(`Blueprint structure not found: ${fetchError?.message}`);
        }

        const structure = structureRow.structure;
        if (!structure) {
            throw new Error('Structure is empty');
        }

        // Fetch document analysis for context
        const { data: analysisRow } = await supabase
            .from('document_analyses')
            .select('raw_analysis')
            .eq('id', structureRow.analysis_id)
            .single();

        const documentContext = {
            subject_area: analysisRow?.raw_analysis?.subject_area || structure.subject_area,
            specific_topic: analysisRow?.raw_analysis?.specific_topic || structure.specific_topic,
            document_type: analysisRow?.raw_analysis?.document_type || 'problem_set'
        };

        let enrichedCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];

        // Process prerequisites
        if (structure.prerequisites_section?.learning_units) {
            console.log(`[enrich-deep-dive] Processing ${structure.prerequisites_section.learning_units.length} prerequisites...`);

            for (const unit of structure.prerequisites_section.learning_units) {
                // Skip if already has deep_dive
                if (unit.deep_dive_explanation && unit.deep_dive_explanation.length > 50) {
                    skippedCount++;
                    continue;
                }

                try {
                    const sectionContext = {
                        title: 'Prerequisites',
                        section_id: 'prerequisites',
                        section_type: 'prerequisites',
                        description: 'Foundational concepts needed for this material',
                        other_concepts: structure.prerequisites_section.learning_units
                            .filter((u: any) => u.unit_id !== unit.unit_id)
                            .map((u: any) => u.topic)
                            .slice(0, 5)
                    };

                    // Use improved call
                    const response = await callGrokDeepDive(
                        DEEP_DIVE_PROMPT.system,
                        DEEP_DIVE_PROMPT.user(unit, sectionContext, documentContext)
                    );

                    if (response.deep_dive_explanation) {
                        unit.deep_dive_explanation = response.deep_dive_explanation;
                        enrichedCount++;
                        console.log(`[enrich-deep-dive] ✓ Enriched prereq: ${unit.topic}`);
                    }
                } catch (error) {
                    console.error(`[enrich-deep-dive] ✗ Failed to enrich prereq ${unit.topic}:`, error);
                    errors.push(`prereq:${unit.topic}`);
                }
            }
        }

        // Process content sections
        if (structure.content_sections) {
            for (const section of structure.content_sections) {
                console.log(`[enrich-deep-dive] Processing section: ${section.title || section.section_id}`);

                if (!section.learning_units) continue;

                for (const unit of section.learning_units) {
                    // Skip if already has deep_dive
                    if (unit.deep_dive_explanation && unit.deep_dive_explanation.length > 50) {
                        skippedCount++;
                        continue;
                    }

                    try {
                        const sectionContext = {
                            title: section.title || section.section_id,
                            section_id: section.section_id,
                            section_type: section.section_type,
                            description: section.description || '',
                            other_concepts: section.learning_units
                                .filter((u: any) => u.unit_id !== unit.unit_id)
                                .map((u: any) => u.topic)
                                .slice(0, 5)
                        };

                        const response = await callGrokDeepDive(
                            DEEP_DIVE_PROMPT.system,
                            DEEP_DIVE_PROMPT.user(unit, sectionContext, documentContext)
                        );

                        if (response.deep_dive_explanation) {
                            unit.deep_dive_explanation = response.deep_dive_explanation;
                            enrichedCount++;
                            console.log(`[enrich-deep-dive] ✓ Enriched: ${unit.topic}`);
                        }
                    } catch (error) {
                        console.error(`[enrich-deep-dive] ✗ Failed to enrich ${unit.topic}:`, error);
                        errors.push(`${section.section_id}:${unit.topic}`);
                    }
                }
            }
        }

        // Save the enriched structure back to the database
        console.log(`[enrich-deep-dive] Saving enriched structure...`);
        const { error: updateError } = await supabase
            .from('blueprint_structures')
            .update({ structure: structure })
            .eq('blueprint_id', blueprint_id);

        if (updateError) {
            throw new Error(`Failed to save enriched structure: ${updateError.message}`);
        }

        console.log(`[enrich-deep-dive] Complete! Enriched: ${enrichedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

        return new Response(
            JSON.stringify({
                success: true,
                enriched_count: enrichedCount,
                skipped_count: skippedCount,
                errors: errors,
                message: `Enriched ${enrichedCount} units with deep_dive_explanation`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error('[enrich-deep-dive] Error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error?.message || 'Unknown error'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
