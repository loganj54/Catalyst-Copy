// ============================================================================
// FIGURE SOURCING HELPER
// ============================================================================
// Utilities for finding, downloading, and caching figures from Wikimedia Commons
// ============================================================================

import { generateEmbedding } from './embeddings.ts';

// ============================================================================
// TYPES
// ============================================================================

interface WikimediaSearchResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  description: string;
  license: string;
  author: string;
  pageUrl: string;
}

interface CachedFigure {
  id: string;
  name: string;
  description: string;
  figure_type: string;
  file_url: string;
  thumbnail_url?: string;
  subject_area: string;
  source: string;
  license: string;
  original_url: string;
  from_cache: boolean;
}

// ============================================================================
// WIKIMEDIA COMMONS API INTEGRATION
// ============================================================================

/**
 * Search Wikimedia Commons for figures matching the search terms
 * Uses the MediaWiki API to find copyright-free images
 */
export async function searchWikimediaFigures(
  searchTerms: string[],
  figureType: string,
  maxResults: number = 3
): Promise<WikimediaSearchResult[]> {
  try {
    // Construct query with filetype filters to avoid PDFs and SVGs
    // filetype:bitmap (jpg, png, gif) ONLY
    const baseQuery = searchTerms.join(' ');
    const query = `${baseQuery} filetype:bitmap -filetype:pdf -filetype:audio -filetype:video -filetype:drawing`;

    console.log(`[figure-sourcing] Searching Wikimedia Commons for: ${query}`);

    // Use Wikimedia Commons API to search for images
    // API: https://commons.wikimedia.org/w/api.php
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('generator', 'search');
    searchUrl.searchParams.set('gsrsearch', query);
    searchUrl.searchParams.set('gsrnamespace', '6'); // File namespace
    searchUrl.searchParams.set('gsrlimit', maxResults.toString());
    searchUrl.searchParams.set('prop', 'imageinfo|info');
    searchUrl.searchParams.set('iiprop', 'url|extmetadata|size');
    searchUrl.searchParams.set('iiurlwidth', '800'); // Get 800px width version

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'CatalystEducation/1.0 (Educational platform; contact@catalyst.edu)',
      },
    });

    if (!response.ok) {
      console.error('[figure-sourcing] Wikimedia API error:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.query || !data.query.pages) {
      console.log('[figure-sourcing] No results found');
      return [];
    }

    const results: WikimediaSearchResult[] = [];

    for (const pageId in data.query.pages) {
      const page = data.query.pages[pageId];

      if (!page.imageinfo || page.imageinfo.length === 0) continue;

      const imageInfo = page.imageinfo[0];
      const metadata = imageInfo.extmetadata || {};

      // Determine file type
      const imageUrl = imageInfo.url || '';
      const fileExt = imageUrl.split('.').pop()?.toLowerCase() || '';

      // RESTRICT TO IMAGES ONLY
      // Explicitly skip PDFs and other non-image formats
      const nonImageExts = ['pdf', 'djvu', 'webm', 'ogv', 'mp4', 'ogg', 'mp3', 'wav', 'tif', 'tiff'];
      if (nonImageExts.includes(fileExt)) {
        console.log(`[figure-sourcing] Skipping ${page.title} - not an image: .${fileExt}`);
        continue;
      }

      // Extract license info
      const license = metadata.LicenseShortName?.value ||
        metadata.License?.value ||
        'Unknown';

      // Only include if it's a free license
      if (!isFreeLicense(license)) {
        console.log(`[figure-sourcing] Skipping ${page.title} - non-free license: ${license}`);
        continue;
      }

      results.push({
        title: page.title.replace('File:', ''),
        imageUrl: imageInfo.url,
        thumbnailUrl: imageInfo.thumburl || imageInfo.url,
        description: metadata.ImageDescription?.value ||
          metadata.ObjectName?.value ||
          page.title.replace('File:', '').replace(/\.(png|jpg|jpeg|gif|svg|pdf)/i, ''),
        license: license,
        author: metadata.Artist?.value || metadata.Author?.value || 'Unknown',
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      });
    }

    console.log(`[figure-sourcing] Found ${results.length} free-licensed results`);
    return results;

  } catch (error) {
    console.error('[figure-sourcing] Error searching Wikimedia:', error);
    return [];
  }
}

/**
 * Check if a license is free/libre (allowed for our use)
 */
function isFreeLicense(license: string): boolean {
  const freeLicenses = [
    'cc0',
    'cc-zero',
    'public domain',
    'cc-by',
    'cc-by-sa',
    'cc by',
    'cc by-sa',
    'gfdl',
    'pd',
    'pdm',
  ];

  const licenseLower = license.toLowerCase();
  return freeLicenses.some(free => licenseLower.includes(free));
}

// ============================================================================
// SUPABASE STORAGE INTEGRATION
// ============================================================================

/**
 * Download an image from a URL and store it in Supabase storage
 * STRICTLY images only
 */
export async function downloadAndStoreFigure(
  imageUrl: string,
  filename: string,
  subjectArea: string,
  supabase: any
): Promise<{ fileUrl: string; thumbnailUrl?: string } | null> {
  try {
    console.log(`[figure-sourcing] Downloading file from: ${imageUrl}`);

    // Download the file
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('[figure-sourcing] Failed to download file:', response.status);
      return null;
    }

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();

    // Determine file type
    const contentType = response.headers.get('content-type') || 'image/png';

    // STRICT CHECK: content type must be an image
    if (!contentType.startsWith('image/')) {
      console.log(`[figure-sourcing] Skipped non-image content type: ${contentType}`);
      return null;
    }

    // Check size limit: 3MB max for images
    const maxSize = 3 * 1024 * 1024;
    if (buffer.byteLength > maxSize) {
      console.log(`[figure-sourcing] Image too large (${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB), max ${maxSize / 1024 / 1024}MB`);
      return null;
    }

    // Determine file extension
    const ext = contentType.split('/')[1] || 'png';

    // Upload to Supabase storage
    const storagePath = `${subjectArea}/${filename}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('figures-library')
      .upload(storagePath, buffer, {
        contentType: contentType,
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error('[figure-sourcing] Storage upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('figures-library')
      .getPublicUrl(storagePath);

    console.log(`[figure-sourcing] Uploaded image to: ${urlData.publicUrl}`);

    return {
      fileUrl: urlData.publicUrl,
      thumbnailUrl: urlData.publicUrl,
    };

  } catch (error) {
    console.error('[figure-sourcing] Error downloading/storing figure:', error);
    return null;
  }
}

// ============================================================================
// FIGURE CACHING
// ============================================================================

/**
 * Try to find an existing figure by exact name match
 */
export async function findFigureByName(
  supabase: any,
  name: string,
  subjectArea?: string
): Promise<CachedFigure | null> {
  const query = supabase
    .from('curated_figures')
    .select('*')
    .ilike('name', name);

  if (subjectArea) {
    query.eq('subject_area', subjectArea);
  }

  const { data, error } = await query
    .order('times_used', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    figure_type: data.figure_type,
    file_url: data.file_url,
    thumbnail_url: data.thumbnail_url,
    subject_area: data.subject_area,
    source: data.source,
    license: data.license,
    original_url: data.original_url,
    from_cache: true,
  };
}

/**
 * Create a new figure entry in the database
 */
export async function createFigure(
  supabase: any,
  name: string,
  description: string,
  figureType: string,
  fileUrl: string,
  thumbnailUrl: string | undefined,
  subjectArea: string,
  topicTags: string[],
  concepts: string[],
  source: string,
  license: string,
  originalUrl: string,
  userId: string | null
): Promise<CachedFigure | null> {
  try {
    // Generate embedding for the figure name + description for future similarity matching
    const embeddingText = `${name}: ${description} ${topicTags.join(' ')}`;

    let embedding: number[] | null = null;
    try {
      const result = await generateEmbedding(embeddingText);
      embedding = result.embedding;
    } catch (embError) {
      console.log('[figure-sourcing] Could not generate figure embedding:', embError);
      // Continue without embedding
    }

    const insertData: any = {
      name: name,
      description: description,
      figure_type: figureType,
      file_url: fileUrl,
      thumbnail_url: thumbnailUrl,
      subject_area: subjectArea,
      topic_tags: topicTags,
      concepts: concepts,
      source: source,
      license: license,
      original_url: originalUrl,
      times_used: 1,
      created_by: userId,
    };

    if (embedding) {
      insertData.name_embedding = embedding;
    }

    const { data, error } = await supabase
      .from('curated_figures')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If it's a unique constraint violation, try to fetch the existing one
      if (error.code === '23505') {
        console.log('[figure-sourcing] Figure already exists, fetching...');
        return await findFigureByName(supabase, name, subjectArea);
      }
      console.error('[figure-sourcing] Error creating figure:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      figure_type: data.figure_type,
      file_url: data.file_url,
      thumbnail_url: data.thumbnail_url,
      subject_area: data.subject_area,
      source: data.source,
      license: data.license,
      original_url: data.original_url,
      from_cache: false,
    };

  } catch (err) {
    console.error('[figure-sourcing] Exception creating figure:', err);
    return null;
  }
}

/**
 * Find or create a figure - the main function to use
 * Checks cache first, then searches Wikimedia Commons if needed
 * RETRY LOGIC: Tries up to 5 results to find a valid image
 */
export async function findOrCreateFigure(
  supabase: any,
  name: string,
  description: string,
  figureType: string,
  searchTerms: string[],
  subjectArea: string,
  topicTags: string[],
  concepts: string[],
  userId: string | null
): Promise<CachedFigure | null> {
  try {
    console.log(`[figure-sourcing] Looking for figure: ${name}`);

    // 1. Check if we already have this figure cached
    const cached = await findFigureByName(supabase, name, subjectArea);
    if (cached) {
      console.log(`[figure-sourcing] Found cached figure: ${name}`);
      // Increment usage counter
      await supabase.rpc('increment_figure_usage', { figure_uuid: cached.id });
      return cached;
    }

    // 2. Search Wikimedia Commons
    // REQUEST 5 RESULTS so we can retry if the first ones are invalid
    console.log(`[figure-sourcing] Searching Wikimedia Commons for: ${name}`);
    const searchResults = await searchWikimediaFigures(searchTerms, figureType, 5);

    if (searchResults.length === 0) {
      console.log(`[figure-sourcing] No Wikimedia results found for: ${name}`);
      return null;
    }

    // 3. Try to download and store, iterating through results until one works
    let storageResult = null;
    let successfulResult = null;

    for (const result of searchResults) {
      console.log(`[figure-sourcing] Trying candidate: ${result.title}`);

      const filename = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
      storageResult = await downloadAndStoreFigure(
        result.imageUrl,
        filename,
        subjectArea,
        supabase
      );

      if (storageResult) {
        successfulResult = result;
        console.log(`[figure-sourcing] Successfully stored image: ${result.title}`);
        break; // Success! Stop retrying.
      } else {
        console.log(`[figure-sourcing] Candidate failed validation/storage: ${result.title}. Retrying with next...`);
      }
    }

    if (!storageResult || !successfulResult) {
      console.log(`[figure-sourcing] All candidates failed to download/store for: ${name}`);
      return null;
    }

    // 4. Create database entry
    const figure = await createFigure(
      supabase,
      name,
      description,
      figureType,
      storageResult.fileUrl,
      storageResult.thumbnailUrl,
      subjectArea,
      topicTags,
      concepts,
      'Wikimedia Commons',
      successfulResult.license,
      successfulResult.pageUrl,
      userId
    );

    if (figure) {
      console.log(`[figure-sourcing] Successfully cached new figure: ${name}`);
    }

    return figure;

  } catch (error) {
    console.error('[figure-sourcing] Error in findOrCreateFigure:', error);
    return null;
  }
}
