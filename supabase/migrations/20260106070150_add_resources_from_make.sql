-- ============================================================================
-- RESOURCES FROM MAKE MIGRATION
-- ============================================================================
-- Creates a backend storage table for resources ingested from Make.com
-- This table stores educational resources with detailed metadata and analysis
-- ============================================================================

-- ============================================================================
-- RESOURCES_FROM_MAKE TABLE
-- ============================================================================
-- Backend storage for resources coming from Make.com automation
-- Similar structure to curated_resources but tailored for Make.com workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS resources_from_make (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource ID (random generator for external reference)
    resource_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
    
    -- Resource identification
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Source information
    platform TEXT,                    -- YouTube, Khan Academy, MIT OCW, etc.
    channel_name TEXT,                -- Creator/channel name
    channel_url TEXT,                 -- Link to channel
    thumbnail_url TEXT,               -- Video/resource thumbnail
    duration_seconds INTEGER,         -- Video length in seconds
    resource_type TEXT,               -- video, article, interactive, etc.
    
    -- Search metadata
    original_search_query TEXT,       -- The query used to find this resource
    key_phrases TEXT[],               -- Array of key phrases extracted from content
    
    -- Content analysis
    transcript TEXT,                  -- Full transcript (for videos)
    summary TEXT,                     -- Summary of the transcript
    full_content_analysis TEXT,       -- Detailed content analysis
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on resource_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_resources_from_make_resource_id 
ON resources_from_make(resource_id);

-- Index on platform for filtering
CREATE INDEX IF NOT EXISTS idx_resources_from_make_platform 
ON resources_from_make(platform);

-- Index on resource_type for filtering
CREATE INDEX IF NOT EXISTS idx_resources_from_make_type 
ON resources_from_make(resource_type);

-- Index on created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_resources_from_make_created_at 
ON resources_from_make(created_at DESC);

-- GIN index for key_phrases array searches
CREATE INDEX IF NOT EXISTS idx_resources_from_make_key_phrases 
ON resources_from_make USING GIN(key_phrases);

-- Full text search index on title and description
CREATE INDEX IF NOT EXISTS idx_resources_from_make_search 
ON resources_from_make USING GIN(
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Backend storage table: Public read access, service role write access
-- This allows the frontend to read resources while only backend services can write
-- ============================================================================

ALTER TABLE resources_from_make ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read resources
CREATE POLICY "Authenticated users can read resources from make"
    ON resources_from_make FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy: Service role (backend/Make.com) can insert new resources
CREATE POLICY "Service role can insert resources from make"
    ON resources_from_make FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Service role can update resources
CREATE POLICY "Service role can update resources from make"
    ON resources_from_make FOR UPDATE
    USING (auth.role() = 'service_role');

-- Policy: Service role can delete resources
CREATE POLICY "Service role can delete resources from make"
    ON resources_from_make FOR DELETE
    USING (auth.role() = 'service_role');

-- Policy: Allow all operations for service role (comprehensive policy)
CREATE POLICY "Service role can manage all resources from make"
    ON resources_from_make FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTION: Search Resources by Key Phrases
-- ============================================================================
-- Function to search resources by matching key phrases
-- ============================================================================

CREATE OR REPLACE FUNCTION search_resources_from_make_by_phrases(
    search_phrases TEXT[],
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    resource_id TEXT,
    url TEXT,
    title TEXT,
    description TEXT,
    platform TEXT,
    channel_name TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    resource_type TEXT,
    original_search_query TEXT,
    key_phrases TEXT[],
    transcript TEXT,
    summary TEXT,
    full_content_analysis TEXT,
    match_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rfm.id,
        rfm.resource_id,
        rfm.url,
        rfm.title,
        rfm.description,
        rfm.platform,
        rfm.channel_name,
        rfm.thumbnail_url,
        rfm.duration_seconds,
        rfm.resource_type,
        rfm.original_search_query,
        rfm.key_phrases,
        rfm.transcript,
        rfm.summary,
        rfm.full_content_analysis,
        (
            SELECT COUNT(*)
            FROM unnest(rfm.key_phrases) phrase
            WHERE phrase = ANY(search_phrases)
        ) as match_count
    FROM resources_from_make rfm
    WHERE rfm.key_phrases && search_phrases  -- Array overlap operator
    ORDER BY match_count DESC, rfm.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Full Text Search
-- ============================================================================
-- Function to perform full text search on title, description, and summary
-- ============================================================================

CREATE OR REPLACE FUNCTION search_resources_from_make_fulltext(
    search_query TEXT,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    resource_id TEXT,
    url TEXT,
    title TEXT,
    description TEXT,
    platform TEXT,
    channel_name TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    resource_type TEXT,
    summary TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rfm.id,
        rfm.resource_id,
        rfm.url,
        rfm.title,
        rfm.description,
        rfm.platform,
        rfm.channel_name,
        rfm.thumbnail_url,
        rfm.duration_seconds,
        rfm.resource_type,
        rfm.summary,
        ts_rank(
            to_tsvector('english', 
                COALESCE(rfm.title, '') || ' ' || 
                COALESCE(rfm.description, '') || ' ' || 
                COALESCE(rfm.summary, '')
            ),
            plainto_tsquery('english', search_query)
        ) as rank
    FROM resources_from_make rfm
    WHERE to_tsvector('english', 
            COALESCE(rfm.title, '') || ' ' || 
            COALESCE(rfm.description, '') || ' ' || 
            COALESCE(rfm.summary, '')
          ) @@ plainto_tsquery('english', search_query)
    ORDER BY rank DESC, rfm.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE resources_from_make IS 
    'Backend storage for educational resources ingested from Make.com automation workflows';

COMMENT ON COLUMN resources_from_make.resource_id IS 
    'Unique text identifier for external reference and API integration';

COMMENT ON COLUMN resources_from_make.key_phrases IS 
    'Array of key phrases extracted from the resource content for matching';

COMMENT ON COLUMN resources_from_make.transcript IS 
    'Full transcript of video content or extracted text from articles';

COMMENT ON COLUMN resources_from_make.summary IS 
    'AI-generated summary of the transcript or main content';

COMMENT ON COLUMN resources_from_make.full_content_analysis IS 
    'Comprehensive analysis of the resource content including topics, difficulty, quality';

COMMENT ON FUNCTION search_resources_from_make_by_phrases IS 
    'Searches for resources matching specific key phrases with ranking by match count';

COMMENT ON FUNCTION search_resources_from_make_fulltext IS 
    'Full text search across title, description, and summary with relevance ranking';

