-- ============================================================================
-- WEB SEARCH RESOURCES MIGRATION
-- ============================================================================
-- Creates the resource caching system with pgvector for semantic similarity
-- matching. This enables reuse of educational resources across blueprints.
-- ============================================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CURATED_RESOURCES TABLE (Global Resource Cache)
-- ============================================================================
-- Master table of all discovered educational resources.
-- Each resource has a topic_embedding for semantic similarity matching.
-- ============================================================================

CREATE TABLE IF NOT EXISTS curated_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource identification
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Source information
    platform TEXT,                    -- YouTube, Khan Academy, MIT OCW, etc.
    channel_name TEXT,                -- Creator/channel name
    channel_url TEXT,                 -- Link to channel
    thumbnail_url TEXT,               -- Video thumbnail
    duration_seconds INTEGER,         -- Video length
    resource_type TEXT DEFAULT 'video', -- video, article, interactive
    
    -- Search & Semantic Matching
    original_search_query TEXT,       -- The query that first found this
    topic_signature TEXT NOT NULL,    -- AI-generated detailed topic descriptor
    topic_embedding vector(1536),     -- OpenAI text-embedding-3-small vector
    concepts_covered TEXT[],          -- Array of specific concepts taught
    difficulty_level TEXT,            -- beginner, intermediate, advanced
    quality_score FLOAT,              -- AI quality assessment (0-1)
    
    -- Usage tracking
    times_served INTEGER DEFAULT 0,   -- How many times shown to users
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for fast vector similarity search
-- Using lists = 100 for good balance of speed and accuracy
CREATE INDEX IF NOT EXISTS idx_curated_resources_embedding 
ON curated_resources 
USING ivfflat (topic_embedding vector_cosine_ops)
WITH (lists = 100);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_curated_resources_platform 
ON curated_resources(platform);

CREATE INDEX IF NOT EXISTS idx_curated_resources_difficulty 
ON curated_resources(difficulty_level);

CREATE INDEX IF NOT EXISTS idx_curated_resources_times_served 
ON curated_resources(times_served DESC);

CREATE INDEX IF NOT EXISTS idx_curated_resources_created_at 
ON curated_resources(created_at DESC);

-- ============================================================================
-- TOPIC_RESPONSES TABLE (User Comfort Tracking)
-- ============================================================================
-- Tracks whether users are comfortable with each topic or need help.
-- ============================================================================

CREATE TABLE IF NOT EXISTS topic_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,            -- References unit_id from learning structure
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Response data
    response TEXT NOT NULL CHECK (response IN ('comfortable', 'needs_help')),
    searched_at TIMESTAMPTZ,          -- When resources were fetched (null if comfortable)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one response per topic per blueprint
    UNIQUE(blueprint_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_responses_blueprint 
ON topic_responses(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_topic_responses_user 
ON topic_responses(user_id);

-- ============================================================================
-- BLUEPRINT_TOPIC_RESOURCES TABLE (Junction Table)
-- ============================================================================
-- Links blueprints/topics to curated resources with relevance scores.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blueprint_topic_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,            -- References unit_id from learning structure
    resource_id UUID NOT NULL REFERENCES curated_resources(id) ON DELETE CASCADE,
    
    -- Matching metadata
    relevance_score FLOAT,            -- How well this resource matches (0-1)
    query_type TEXT,                  -- introduction, concept, tutorial, example
    from_cache BOOLEAN DEFAULT false, -- Was this a cache hit?
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique resource per topic per blueprint
    UNIQUE(blueprint_id, unit_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_blueprint 
ON blueprint_topic_resources(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_resource 
ON blueprint_topic_resources(resource_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- curated_resources: Public read, service role write
ALTER TABLE curated_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read curated resources"
    ON curated_resources FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage curated resources"
    ON curated_resources FOR ALL
    USING (auth.role() = 'service_role');

-- topic_responses: Users own their responses
ALTER TABLE topic_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topic responses"
    ON topic_responses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic responses"
    ON topic_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic responses"
    ON topic_responses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topic responses"
    ON topic_responses FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage topic responses"
    ON topic_responses FOR ALL
    USING (auth.role() = 'service_role');

-- blueprint_topic_resources: Users can view their blueprint resources
ALTER TABLE blueprint_topic_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blueprint topic resources"
    ON blueprint_topic_resources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM blueprints 
            WHERE blueprints.id = blueprint_topic_resources.blueprint_id 
            AND blueprints.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage blueprint topic resources"
    ON blueprint_topic_resources FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_topic_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_topic_responses_updated_at ON topic_responses;
CREATE TRIGGER trigger_topic_responses_updated_at
    BEFORE UPDATE ON topic_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_topic_responses_updated_at();

-- ============================================================================
-- HELPER FUNCTION: Vector Similarity Search
-- ============================================================================
-- Function to search for similar resources using cosine similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_resources(
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.95,
    max_results INTEGER DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    url TEXT,
    title TEXT,
    description TEXT,
    platform TEXT,
    channel_name TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    topic_signature TEXT,
    concepts_covered TEXT[],
    difficulty_level TEXT,
    quality_score FLOAT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.id,
        cr.url,
        cr.title,
        cr.description,
        cr.platform,
        cr.channel_name,
        cr.thumbnail_url,
        cr.duration_seconds,
        cr.topic_signature,
        cr.concepts_covered,
        cr.difficulty_level,
        cr.quality_score,
        (1 - (cr.topic_embedding <=> query_embedding))::FLOAT as similarity
    FROM curated_resources cr
    WHERE cr.topic_embedding IS NOT NULL
      AND (1 - (cr.topic_embedding <=> query_embedding)) > similarity_threshold
    ORDER BY cr.topic_embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE curated_resources IS 
    'Global cache of educational resources with vector embeddings for semantic matching';

COMMENT ON COLUMN curated_resources.topic_signature IS 
    'AI-generated detailed description of what educational problem this resource solves';

COMMENT ON COLUMN curated_resources.topic_embedding IS 
    'OpenAI text-embedding-3-small vector (1536 dimensions) for similarity search';

COMMENT ON COLUMN curated_resources.times_served IS 
    'Counter for how many times this resource was shown to users';

COMMENT ON TABLE topic_responses IS 
    'Tracks user comfort level with each topic in their blueprint';

COMMENT ON TABLE blueprint_topic_resources IS 
    'Junction table linking blueprint topics to educational resources';

COMMENT ON FUNCTION search_similar_resources IS 
    'Searches for resources with similar topic embeddings using cosine similarity';

