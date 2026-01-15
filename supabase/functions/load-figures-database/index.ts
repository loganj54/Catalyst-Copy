// ============================================================================
// LOAD FIGURES DATABASE EDGE FUNCTION
// ============================================================================
// Searches the curated_figures database for figures matching a unit's topic
// and links them to the blueprint via blueprint_unit_figures.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ============================================================================
// TYPES
// ============================================================================

interface RequestBody {
    blueprint_id: string;
    unit_id: string;
    topic: string;
    description?: string;
    subject_area?: string;
}

interface FoundFigure {
    id: string;
    name: string;
    description: string;
    figure_category: 'image' | 'link';
    figure_type: string;
    file_url?: string;
    thumbnail_url?: string;
    external_url?: string;
    source_website?: string;
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
        const { blueprint_id, unit_id, topic, description, subject_area } = body;

        console.log('='.repeat(80));
        console.log('[load-figures-database] Searching database for figures');
        console.log(`  - Blueprint ID: ${blueprint_id}`);
        console.log(`  - Unit ID: ${unit_id}`);
        console.log(`  - Topic: ${topic}`);
        console.log('='.repeat(80));

        // Validate required fields
        if (!blueprint_id || !unit_id || !topic) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'blueprint_id, unit_id, and topic are required'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Build search terms from topic and description
        const searchText = `${topic} ${description || ''}`.toLowerCase();
        const searchWords = searchText
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['this', 'that', 'with', 'from', 'have', 'been', 'will', 'when', 'what'].includes(word));

        console.log(`[load-figures-database] Search words: ${searchWords.join(', ')}`);

        // Search for matching figures in the database
        const foundFigures: FoundFigure[] = [];

        // Strategy 1: Exact topic name match
        const { data: exactMatches, error: exactError } = await supabase
            .from('curated_figures')
            .select('*')
            .ilike('name', `%${topic}%`)
            .order('times_used', { ascending: false })
            .limit(3);

        if (exactError) {
            console.error('[load-figures-database] Exact match error:', exactError);
        } else if (exactMatches && exactMatches.length > 0) {
            console.log(`[load-figures-database] Found ${exactMatches.length} exact matches`);
            for (const match of exactMatches) {
                foundFigures.push({
                    id: match.id,
                    name: match.name,
                    description: match.description,
                    figure_category: match.figure_category || 'image',
                    figure_type: match.figure_type,
                    file_url: match.file_url,
                    thumbnail_url: match.thumbnail_url,
                    external_url: match.external_url,
                    source_website: match.source_website
                });
            }
        }

        // Strategy 2: Subject area + keyword matches (if not enough results)
        if (foundFigures.length < 3 && subject_area) {
            for (const word of searchWords.slice(0, 5)) {
                const { data: keywordMatches } = await supabase
                    .from('curated_figures')
                    .select('*')
                    .eq('subject_area', subject_area)
                    .ilike('name', `%${word}%`)
                    .order('times_used', { ascending: false })
                    .limit(2);

                if (keywordMatches) {
                    for (const match of keywordMatches) {
                        // Avoid duplicates
                        if (!foundFigures.find(f => f.id === match.id)) {
                            foundFigures.push({
                                id: match.id,
                                name: match.name,
                                description: match.description,
                                figure_category: match.figure_category || 'image',
                                figure_type: match.figure_type,
                                file_url: match.file_url,
                                thumbnail_url: match.thumbnail_url,
                                external_url: match.external_url,
                                source_website: match.source_website
                            });
                        }
                    }
                }

                if (foundFigures.length >= 5) break;
            }
        }

        // Strategy 3: Search in search_terms array
        if (foundFigures.length < 3) {
            for (const word of searchWords.slice(0, 3)) {
                const { data: tagMatches } = await supabase
                    .from('curated_figures')
                    .select('*')
                    .contains('search_terms', [word.toLowerCase()])
                    .order('times_used', { ascending: false })
                    .limit(2);

                if (tagMatches) {
                    for (const match of tagMatches) {
                        if (!foundFigures.find(f => f.id === match.id)) {
                            foundFigures.push({
                                id: match.id,
                                name: match.name,
                                description: match.description,
                                figure_category: match.figure_category || 'image',
                                figure_type: match.figure_type,
                                file_url: match.file_url,
                                thumbnail_url: match.thumbnail_url,
                                external_url: match.external_url,
                                source_website: match.source_website
                            });
                        }
                    }
                }

                if (foundFigures.length >= 5) break;
            }
        }

        console.log(`[load-figures-database] Total figures found: ${foundFigures.length}`);

        // Link found figures to the blueprint unit
        let linkedCount = 0;
        for (let i = 0; i < foundFigures.length; i++) {
            const figure = foundFigures[i];

            const { error: linkError } = await supabase
                .from('blueprint_unit_figures')
                .upsert({
                    blueprint_id: blueprint_id,
                    unit_id: unit_id,
                    figure_id: figure.id,
                    display_index: i + 1,
                    from_cache: true,
                    relevance_explanation: `Matched from database for topic: ${topic}`
                }, {
                    onConflict: 'blueprint_id,unit_id,figure_id'
                });

            if (linkError) {
                console.error(`[load-figures-database] Failed to link ${figure.name}:`, linkError);
            } else {
                linkedCount++;

                // Increment usage counter
                await supabase.rpc('increment_figure_usage', { figure_uuid: figure.id });
                console.log(`[load-figures-database] ✓ Linked: ${figure.name}`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('[load-figures-database] Complete!');
        console.log(`  - Found: ${foundFigures.length}`);
        console.log(`  - Linked: ${linkedCount}`);
        console.log('='.repeat(80));

        return new Response(
            JSON.stringify({
                success: true,
                summary: {
                    found: foundFigures.length,
                    linked: linkedCount
                },
                figures: foundFigures
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[load-figures-database] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
