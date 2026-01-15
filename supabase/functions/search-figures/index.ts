// ============================================================================
// SEARCH FIGURES EDGE FUNCTION
// ============================================================================
// Searches for figures from internet sources (Wikimedia, Google) and stores
// them in the curated_figures database. Called manually via button click.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { findOrFetchFigure, FigureSuggestion } from '../_shared/figure-lookup.ts';

// ============================================================================
// TYPES
// ============================================================================

interface RequestBody {
    blueprint_id: string;
    // Can process all figures from the structure, or specific ones
    figure_suggestions?: FigureSuggestion[];
    subject_area?: string;
}

interface FigureResult {
    name: string;
    success: boolean;
    figure_id?: string;
    from_cache?: boolean;
    error?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body: RequestBody = await req.json();
        const { blueprint_id, figure_suggestions, subject_area } = body;

        console.log('='.repeat(80));
        console.log('[search-figures] Starting figure search');
        console.log(`  - Blueprint ID: ${blueprint_id}`);
        console.log(`  - Subject Area: ${subject_area || 'unknown'}`);
        console.log('='.repeat(80));

        // Validate required fields
        if (!blueprint_id) {
            return new Response(
                JSON.stringify({ success: false, error: 'blueprint_id is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get figure suggestions - either from request or from blueprint structure
        let suggestions: Array<{ unit_id: string; suggestion: FigureSuggestion }> = [];

        if (figure_suggestions && figure_suggestions.length > 0) {
            // Use provided suggestions
            suggestions = figure_suggestions.map(s => ({
                unit_id: 'manual',
                suggestion: s
            }));
        } else {
            // Fetch from blueprint structure
            const { data: structureData, error: structureError } = await supabase
                .from('blueprint_structures')
                .select('structure')
                .eq('blueprint_id', blueprint_id)
                .single();

            if (structureError || !structureData) {
                console.error('[search-figures] Failed to fetch structure:', structureError);
                return new Response(
                    JSON.stringify({ success: false, error: 'Blueprint structure not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const structure = structureData.structure;

            // Extract all suggested_figures from the structure
            const collectFigures = (units: any[]) => {
                for (const unit of units || []) {
                    if (unit.suggested_figures && unit.suggested_figures.length > 0) {
                        for (const fig of unit.suggested_figures) {
                            // Normalize search_terms to array
                            const searchTerms = Array.isArray(fig.search_terms)
                                ? fig.search_terms
                                : (fig.search_terms ? [fig.search_terms] : [fig.name]);

                            suggestions.push({
                                unit_id: unit.unit_id,
                                suggestion: {
                                    name: fig.name,
                                    figure_category: fig.figure_category || 'image',
                                    figure_type: fig.figure_type || 'diagram',
                                    description: fig.description || '',
                                    search_terms: searchTerms
                                }
                            });
                        }
                    }
                }
            };

            // Collect from prerequisites
            if (structure.prerequisites_section?.learning_units) {
                collectFigures(structure.prerequisites_section.learning_units);
            }

            // Collect from content sections
            for (const section of structure.content_sections || []) {
                collectFigures(section.learning_units);
            }
        }

        console.log(`[search-figures] Found ${suggestions.length} figures to search`);

        if (suggestions.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No figures found in blueprint structure',
                    results: []
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Determine subject area
        const effectiveSubjectArea = subject_area || 'general';

        // Process each figure
        const results: FigureResult[] = [];

        for (const { unit_id, suggestion } of suggestions) {
            console.log(`[search-figures] Processing: ${suggestion.name} (${suggestion.figure_category})`);

            try {
                const figure = await findOrFetchFigure(supabase, suggestion, effectiveSubjectArea);

                if (figure) {
                    // Link figure to blueprint unit
                    const { error: linkError } = await supabase
                        .from('blueprint_unit_figures')
                        .upsert({
                            blueprint_id: blueprint_id,
                            unit_id: unit_id,
                            figure_id: figure.id,
                            display_index: 1,
                            from_cache: figure.from_cache,
                            relevance_explanation: suggestion.description
                        }, {
                            onConflict: 'blueprint_id,unit_id,figure_id'
                        });

                    if (linkError) {
                        console.error(`[search-figures] Failed to link ${suggestion.name}:`, linkError);
                    }

                    results.push({
                        name: suggestion.name,
                        success: true,
                        figure_id: figure.id,
                        from_cache: figure.from_cache
                    });

                    const cacheStatus = figure.from_cache ? 'from cache' : 'newly fetched';
                    console.log(`[search-figures] ✓ ${suggestion.name} (${cacheStatus})`);
                } else {
                    results.push({
                        name: suggestion.name,
                        success: false,
                        error: 'Could not find or fetch figure'
                    });
                    console.log(`[search-figures] ✗ ${suggestion.name} - not found`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    name: suggestion.name,
                    success: false,
                    error: errorMessage
                });
                console.error(`[search-figures] Error processing ${suggestion.name}:`, error);
            }
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        const cached = results.filter(r => r.from_cache).length;
        const newlyFetched = successful - cached;
        const failed = results.filter(r => !r.success).length;

        console.log('\n' + '='.repeat(80));
        console.log('[search-figures] Complete!');
        console.log(`  - Total: ${results.length}`);
        console.log(`  - Successful: ${successful} (${cached} cached, ${newlyFetched} new)`);
        console.log(`  - Failed: ${failed}`);
        console.log('='.repeat(80));

        return new Response(
            JSON.stringify({
                success: true,
                summary: {
                    total: results.length,
                    successful,
                    cached,
                    newlyFetched,
                    failed
                },
                results
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[search-figures] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
