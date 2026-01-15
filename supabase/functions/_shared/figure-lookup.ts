// ============================================================================
// FIGURE LOOKUP HELPER
// ============================================================================
// Search database first, then fetch from internet if needed.
// - Images: Wikimedia Commons (downloaded and stored)
// - Links: Apify Google Search (URL cached)
// ============================================================================

import { searchWikimediaFigures, downloadAndStoreFigure } from './figure-sourcing.ts';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Normalize search_terms to always be an array (AI sometimes returns a string)
 */
function normalizeSearchTerms(searchTerms: string[] | string | undefined): string[] {
    if (!searchTerms) return [];
    if (typeof searchTerms === 'string') return [searchTerms];
    if (Array.isArray(searchTerms)) return searchTerms;
    return [];
}

export interface FigureSuggestion {
    name: string;
    figure_category: 'image' | 'link';
    figure_type: 'diagram' | 'chart' | 'graph' | 'table' | 'illustration';
    description: string;
    search_terms: string[];
}

export interface CachedFigure {
    id: string;
    name: string;
    description: string;
    figure_category: 'image' | 'link';
    figure_type: string;
    file_url?: string;
    thumbnail_url?: string;
    external_url?: string;
    source_website?: string;
    source?: string;
    license?: string;
    original_url?: string;
    from_cache: boolean;
}

interface GoogleSearchResult {
    url: string;
    title: string;
    description: string;
    displayedUrl: string;
}

// ============================================================================
// ENVIRONMENT
// ============================================================================

const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
const APIFY_GOOGLE_SEARCH_ACTOR = 'nFJndFXA5zjCTuudP'; // Google Search Scraper

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Find or fetch a figure - main entry point
 * 1. Search database by name (text match, return single best result)
 * 2. If not found, fetch from internet based on category
 * 3. Cache and return
 */
export async function findOrFetchFigure(
    supabase: any,
    suggestion: FigureSuggestion,
    subjectArea: string
): Promise<CachedFigure | null> {
    console.log(`[figure-lookup] Looking for: ${suggestion.name} (${suggestion.figure_category})`);

    // 1. Search database first (simple text match)
    const cached = await searchFigureByName(supabase, suggestion.name);
    if (cached) {
        console.log(`[figure-lookup] ✅ Cache hit: ${suggestion.name}`);
        await incrementUsage(supabase, cached.id);
        return { ...cached, from_cache: true };
    }

    console.log(`[figure-lookup] Cache miss, fetching from internet...`);

    // 2. Fetch based on category
    if (suggestion.figure_category === 'image') {
        return await fetchImageFromWikimedia(supabase, suggestion, subjectArea);
    } else {
        return await fetchLinkFromGoogle(supabase, suggestion, subjectArea);
    }
}

// ============================================================================
// DATABASE SEARCH
// ============================================================================

/**
 * Search database by figure name (simple text matching, no vectors)
 * Returns single best match or null
 */
async function searchFigureByName(
    supabase: any,
    name: string
): Promise<CachedFigure | null> {

    // Try exact match first (case-insensitive)
    const { data: exact, error: exactError } = await supabase
        .from('curated_figures')
        .select('*')
        .ilike('name', name)
        .limit(1)
        .maybeSingle();

    if (exactError) {
        console.error('[figure-lookup] DB error (exact match):', exactError);
    }

    if (exact) {
        console.log(`[figure-lookup] Found exact match: ${exact.name}`);
        return mapToFigure(exact);
    }

    // Try partial match (name contains search term)
    const { data: partial, error: partialError } = await supabase
        .from('curated_figures')
        .select('*')
        .ilike('name', `%${name}%`)
        .order('times_used', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (partialError) {
        console.error('[figure-lookup] DB error (partial match):', partialError);
    }

    if (partial) {
        console.log(`[figure-lookup] Found partial match: ${partial.name}`);
        return mapToFigure(partial);
    }

    // Try searching by significant keywords from the name
    const nameParts = name.toLowerCase()
        .split(/\s+/)
        .filter(p => p.length > 3 && !['the', 'and', 'for', 'with'].includes(p));

    for (const part of nameParts) {
        const { data: byPart } = await supabase
            .from('curated_figures')
            .select('*')
            .ilike('name', `%${part}%`)
            .order('times_used', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (byPart) {
            console.log(`[figure-lookup] Found by keyword "${part}": ${byPart.name}`);
            return mapToFigure(byPart);
        }
    }

    return null;
}

/**
 * Map database row to CachedFigure type
 */
function mapToFigure(row: any): CachedFigure {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        figure_category: row.figure_category || 'image',
        figure_type: row.figure_type,
        file_url: row.file_url,
        thumbnail_url: row.thumbnail_url,
        external_url: row.external_url,
        source_website: row.source_website,
        source: row.source,
        license: row.license,
        original_url: row.original_url,
        from_cache: true
    };
}

// ============================================================================
// IMAGE FETCHING (WIKIMEDIA)
// ============================================================================

/**
 * Fetch image from Wikimedia Commons
 * Uses existing figure-sourcing.ts functionality
 */
async function fetchImageFromWikimedia(
    supabase: any,
    suggestion: FigureSuggestion,
    subjectArea: string
): Promise<CachedFigure | null> {
    console.log(`[figure-lookup] Searching Wikimedia for: ${suggestion.name}`);

    try {
        // Normalize search_terms to array (AI sometimes returns string)
        const searchTermsArray = normalizeSearchTerms(suggestion.search_terms);

        // Use existing Wikimedia search
        const results = await searchWikimediaFigures(
            searchTermsArray,
            suggestion.figure_type,
            1  // Only get best result
        );

        if (results.length === 0) {
            console.log(`[figure-lookup] No Wikimedia results for: ${suggestion.name}`);
            return null;
        }

        const result = results[0];

        // Download and store image
        const filename = suggestion.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);

        const storage = await downloadAndStoreFigure(
            result.imageUrl,
            filename,
            subjectArea,
            supabase
        );

        if (!storage) {
            console.log(`[figure-lookup] Failed to store image: ${suggestion.name}`);
            return null;
        }

        // Insert into database
        const searchTermsForDb = normalizeSearchTerms(suggestion.search_terms);
        const { data, error } = await supabase
            .from('curated_figures')
            .insert({
                name: suggestion.name,
                description: suggestion.description,
                figure_category: 'image',
                figure_type: suggestion.figure_type,
                file_url: storage.fileUrl,
                thumbnail_url: storage.thumbnailUrl,
                subject_area: subjectArea,
                search_terms: searchTermsForDb.map(t => t.toLowerCase()),
                source: 'Wikimedia Commons',
                license: result.license,
                original_url: result.pageUrl,
                times_used: 1
            })
            .select()
            .single();

        if (error) {
            // Check for duplicate - if so, fetch the existing one
            if (error.code === '23505') {
                console.log('[figure-lookup] Figure already exists, fetching...');
                return await searchFigureByName(supabase, suggestion.name);
            }
            console.error('[figure-lookup] Insert error:', error);
            return null;
        }

        console.log(`[figure-lookup] ✅ Cached new image: ${suggestion.name}`);

        return {
            id: data.id,
            name: data.name,
            description: data.description,
            figure_category: 'image',
            figure_type: data.figure_type,
            file_url: data.file_url,
            thumbnail_url: data.thumbnail_url,
            source: 'Wikimedia Commons',
            license: data.license,
            original_url: data.original_url,
            from_cache: false
        };
    } catch (error) {
        console.error('[figure-lookup] Wikimedia search error:', error);
        return null;
    }
}

// ============================================================================
// EXTERNAL LINK FETCHING (APIFY GOOGLE SEARCH)
// ============================================================================

/**
 * Search Google using Apify and get the best URL for property tables, etc.
 */
async function fetchLinkFromGoogle(
    supabase: any,
    suggestion: FigureSuggestion,
    subjectArea: string
): Promise<CachedFigure | null> {

    if (!APIFY_API_TOKEN) {
        console.error('[figure-lookup] APIFY_API_TOKEN not configured');
        return null;
    }

    // Normalize search_terms to array (AI sometimes returns string)
    const searchTermsArray = normalizeSearchTerms(suggestion.search_terms);
    const firstSearchTerm = searchTermsArray[0] || suggestion.name;

    // Build search query targeting reliable engineering sources
    const searchQuery = `${firstSearchTerm} ${subjectArea} ` +
        `site:engineeringtoolbox.com OR site:wikipedia.org OR ` +
        `site:hyperphysics.phy-astr.gsu.edu OR site:nist.gov`;

    console.log(`[figure-lookup] Google search query: ${searchQuery}`);

    try {
        // Call Apify Google Search Scraper
        const result = await searchGoogleWithApify(searchQuery);

        if (!result) {
            console.log(`[figure-lookup] No Google results for: ${suggestion.name}`);
            return null;
        }

        // Validate URL is accessible
        const isValid = await validateUrl(result.url);
        if (!isValid) {
            console.log(`[figure-lookup] URL not accessible: ${result.url}`);
            return null;
        }

        // Extract source website name
        const sourceWebsite = extractSourceWebsite(result.url);

        // Insert into database
        const searchTermsForDb = normalizeSearchTerms(suggestion.search_terms);
        const { data, error } = await supabase
            .from('curated_figures')
            .insert({
                name: suggestion.name,
                description: suggestion.description || result.description,
                figure_category: 'link',
                figure_type: suggestion.figure_type,
                external_url: result.url,
                source_website: sourceWebsite,
                subject_area: subjectArea,
                search_terms: searchTermsForDb.map(t => t.toLowerCase()),
                source: 'Google Search',
                times_used: 1
            })
            .select()
            .single();

        if (error) {
            // Check for duplicate
            if (error.code === '23505') {
                console.log('[figure-lookup] Figure already exists, fetching...');
                return await searchFigureByName(supabase, suggestion.name);
            }
            console.error('[figure-lookup] Insert error:', error);
            return null;
        }

        console.log(`[figure-lookup] ✅ Cached new link: ${suggestion.name} → ${sourceWebsite}`);

        return {
            id: data.id,
            name: data.name,
            description: data.description,
            figure_category: 'link',
            figure_type: data.figure_type,
            external_url: data.external_url,
            source_website: data.source_website,
            source: 'Google Search',
            from_cache: false
        };

    } catch (error) {
        console.error('[figure-lookup] Google search error:', error);
        return null;
    }
}

/**
 * Call Apify Google Search Scraper
 * Uses the same pattern as YouTube search in load-resources-database
 */
async function searchGoogleWithApify(query: string): Promise<GoogleSearchResult | null> {
    console.log(`[Apify] Searching Google for: "${query}"`);

    // Input format for Google Search Scraper (nFJndFXA5zjCTuudP)
    const inputPayload = {
        queries: query,
        countryCode: 'us',
        languageCode: 'en',
        maxPagesPerQuery: 1,  // Only need first page
        resultsPerPage: 5,    // Get top 5 results
        mobileResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
    };

    console.log(`[Apify] Input payload:`, JSON.stringify(inputPayload, null, 2));

    // Start the actor run
    const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${APIFY_GOOGLE_SEARCH_ACTOR}/runs?token=${APIFY_API_TOKEN}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputPayload),
        }
    );

    if (!runResponse.ok) {
        const errorText = await runResponse.text();
        throw new Error(`Apify run failed: ${runResponse.status} - ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    console.log(`[Apify] Run started: ${runId}, Dataset: ${datasetId}`);

    // Wait for completion (poll with timeout)
    let attempts = 0;
    const maxAttempts = 45; // 45 seconds max (Google search is usually fast)
    let status = 'RUNNING';

    while (status === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await fetch(
            `https://api.apify.com/v2/acts/${APIFY_GOOGLE_SEARCH_ACTOR}/runs/${runId}?token=${APIFY_API_TOKEN}`
        );
        const statusData = await statusResponse.json();
        status = statusData.data.status;
        attempts++;

        if (attempts % 5 === 0) {
            console.log(`[Apify] Status: ${status} (attempt ${attempts}/${maxAttempts})`);
        }
    }

    if (status !== 'SUCCEEDED') {
        console.error(`[Apify] Run did not succeed: ${status}`);
        return null;
    }

    // Get results from dataset
    const resultsResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
    );

    if (!resultsResponse.ok) {
        throw new Error(`Failed to fetch results: ${resultsResponse.status}`);
    }

    const results = await resultsResponse.json();
    console.log(`[Apify] Got ${results.length} result pages`);

    // Extract first organic result
    if (results.length > 0 && results[0].organicResults?.length > 0) {
        const organic = results[0].organicResults[0];
        console.log(`[Apify] Best result: ${organic.title} - ${organic.url}`);

        return {
            url: organic.url,
            title: organic.title,
            description: organic.description || '',
            displayedUrl: organic.displayedUrl || organic.url,
        };
    }

    console.log('[Apify] No organic results found');
    return null;
}

/**
 * Validate that a URL is accessible
 */
async function validateUrl(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CatalystEdu/1.0)' },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Extract human-readable website name from URL
 */
function extractSourceWebsite(url: string): string {
    try {
        const hostname = new URL(url).hostname.replace('www.', '');

        // Map common domains to nice names
        const domainNames: Record<string, string> = {
            'engineeringtoolbox.com': 'Engineering Toolbox',
            'wikipedia.org': 'Wikipedia',
            'en.wikipedia.org': 'Wikipedia',
            'hyperphysics.phy-astr.gsu.edu': 'HyperPhysics',
            'nist.gov': 'NIST',
            'webbook.nist.gov': 'NIST WebBook',
            'mathworld.wolfram.com': 'Wolfram MathWorld',
            'khanacademy.org': 'Khan Academy',
        };

        if (domainNames[hostname]) {
            return domainNames[hostname];
        }

        // Try to make a nice name from the domain
        return hostname
            .split('.')[0]
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    } catch {
        return 'External Resource';
    }
}

/**
 * Increment usage counter for a figure
 */
async function incrementUsage(supabase: any, figureId: string): Promise<void> {
    try {
        await supabase.rpc('increment_figure_usage', { figure_uuid: figureId });
    } catch (error) {
        console.error('[figure-lookup] Failed to increment usage:', error);
    }
}

// ============================================================================
// BATCH PROCESSING FOR STRUCTURE GENERATION
// ============================================================================

/**
 * Process all suggested figures from a learning unit
 * Called from generate-structure-legacy after AI generates suggestions
 */
export async function processSuggestedFigures(
    supabase: any,
    blueprintId: string,
    unitId: string,
    suggestedFigures: FigureSuggestion[],
    subjectArea: string
): Promise<CachedFigure[]> {
    if (!suggestedFigures || suggestedFigures.length === 0) {
        return [];
    }

    console.log(`[figure-lookup] Processing ${suggestedFigures.length} suggested figures for unit ${unitId}`);

    const results: CachedFigure[] = [];

    for (let i = 0; i < suggestedFigures.length; i++) {
        const suggestion = suggestedFigures[i];

        // Default to 'image' if category not specified
        if (!suggestion.figure_category) {
            suggestion.figure_category = 'image';
        }

        try {
            const figure = await findOrFetchFigure(supabase, suggestion, subjectArea);

            if (figure) {
                // Link to blueprint unit
                const { error: linkError } = await supabase
                    .from('blueprint_unit_figures')
                    .upsert({
                        blueprint_id: blueprintId,
                        unit_id: unitId,
                        figure_id: figure.id,
                        display_index: i + 1,
                        from_cache: figure.from_cache,
                        relevance_explanation: suggestion.description
                    }, {
                        onConflict: 'blueprint_id,unit_id,figure_id'
                    });

                if (linkError) {
                    console.error(`[figure-lookup] Failed to link figure ${figure.name}:`, linkError);
                }

                results.push(figure);
            }
        } catch (error) {
            console.error(`[figure-lookup] Error processing ${suggestion.name}:`, error);
        }
    }

    console.log(`[figure-lookup] Successfully processed ${results.length}/${suggestedFigures.length} figures`);
    return results;
}
