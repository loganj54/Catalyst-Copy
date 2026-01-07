-- ============================================================================
-- RESOURCE PERSISTENCE SETUP - COMPLETE MIGRATION
-- ============================================================================
-- Run this ENTIRE file in Supabase SQL Editor if tables don't exist
-- This sets up the complete resource persistence system
-- ============================================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. CURATED_RESOURCES TABLE
-- ============================================================================
-- Master table of all discovered educational resources

CREATE TABLE IF NOT EXISTS curated_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource identification
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Source information
    platform TEXT,
    channel_name TEXT,
    channel_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    resource_type TEXT DEFAULT 'video',
    
    -- Search & Semantic Matching
    original_search_query TEXT,
    topic_signature TEXT NOT NULL,
    topic_embedding vector(1536),
    concepts_covered TEXT[],
    difficulty_level TEXT,
    quality_score FLOAT,
    
    -- Transcript data (for analysis)
    transcript_text TEXT,
    transcript_analyzed BOOLEAN DEFAULT false,
    transcript_source TEXT,
    analyzed_at TIMESTAMPTZ,
    
    -- Usage tracking
    times_served INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for curated_resources
CREATE INDEX IF NOT EXISTS idx_curated_resources_embedding 
ON curated_resources 
USING ivfflat (topic_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_curated_resources_platform 
ON curated_resources(platform);

CREATE INDEX IF NOT EXISTS idx_curated_resources_difficulty 
ON curated_resources(difficulty_level);

CREATE INDEX IF NOT EXISTS idx_curated_resources_times_served 
ON curated_resources(times_served DESC);

CREATE INDEX IF NOT EXISTS idx_curated_resources_created_at 
ON curated_resources(created_at DESC);

-- ============================================================================
-- 2. TOPIC_RESPONSES TABLE
-- ============================================================================
-- Tracks whether users are comfortable with each topic or need help

CREATE TABLE IF NOT EXISTS topic_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Response data
    response TEXT NOT NULL CHECK (response IN ('comfortable', 'needs_help')),
    searched_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one response per topic per blueprint
    UNIQUE(blueprint_id, unit_id)
);

-- Indexes for topic_responses
CREATE INDEX IF NOT EXISTS idx_topic_responses_blueprint 
ON topic_responses(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_topic_responses_user 
ON topic_responses(user_id);

-- ============================================================================
-- 3. BLUEPRINT_TOPIC_RESOURCES TABLE (THE KEY TABLE!)
-- ============================================================================
-- This is where resources are PERMANENTLY linked to blueprint units
-- This is what makes resources persist across page refreshes!

CREATE TABLE IF NOT EXISTS blueprint_topic_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,
    resource_id UUID NOT NULL REFERENCES curated_resources(id) ON DELETE CASCADE,
    
    -- Matching metadata
    relevance_score FLOAT,
    query_type TEXT,
    from_cache BOOLEAN DEFAULT false,
    
    -- THE IMPORTANT COLUMN: "Why this helps" explanation
    resource_explanation TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique resource per topic per blueprint
    UNIQUE(blueprint_id, unit_id, resource_id)
);

-- Indexes for blueprint_topic_resources
CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_blueprint 
ON blueprint_topic_resources(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_resource 
ON blueprint_topic_resources(resource_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_unit 
ON blueprint_topic_resources(unit_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- curated_resources: Public read, service role write
ALTER TABLE curated_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read curated resources" ON curated_resources;
CREATE POLICY "Anyone can read curated resources"
    ON curated_resources FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role can manage curated resources" ON curated_resources;
CREATE POLICY "Service role can manage curated resources"
    ON curated_resources FOR ALL
    USING (auth.role() = 'service_role');

-- topic_responses: Users own their responses
ALTER TABLE topic_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own topic responses" ON topic_responses;
CREATE POLICY "Users can view own topic responses"
    ON topic_responses FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own topic responses" ON topic_responses;
CREATE POLICY "Users can insert own topic responses"
    ON topic_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own topic responses" ON topic_responses;
CREATE POLICY "Users can update own topic responses"
    ON topic_responses FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own topic responses" ON topic_responses;
CREATE POLICY "Users can delete own topic responses"
    ON topic_responses FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage topic responses" ON topic_responses;
CREATE POLICY "Service role can manage topic responses"
    ON topic_responses FOR ALL
    USING (auth.role() = 'service_role');

-- blueprint_topic_resources: Users can view their blueprint resources
ALTER TABLE blueprint_topic_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blueprint topic resources" ON blueprint_topic_resources;
CREATE POLICY "Users can view own blueprint topic resources"
    ON blueprint_topic_resources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM blueprints 
            WHERE blueprints.id = blueprint_topic_resources.blueprint_id 
            AND blueprints.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage blueprint topic resources" ON blueprint_topic_resources;
CREATE POLICY "Service role can manage blueprint topic resources"
    ON blueprint_topic_resources FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. TRIGGERS
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
-- 6. HELPER FUNCTION: Vector Similarity Search
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
-- 7. COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE curated_resources IS 
    'Global cache of educational resources with vector embeddings for semantic matching';

COMMENT ON TABLE topic_responses IS 
    'Tracks user comfort level with each topic in their blueprint';

COMMENT ON TABLE blueprint_topic_resources IS 
    'Junction table linking blueprint topics to educational resources - THIS IS WHERE RESOURCES ARE PERSISTED!';

COMMENT ON COLUMN blueprint_topic_resources.resource_explanation IS 
    'AI-generated explanation (2-3 sentences) describing what the resource covers and how it helps the student achieve their learning objective';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check that tables were created
SELECT 
    'curated_resources' as table_name,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'curated_resources') as exists
UNION ALL
SELECT 
    'topic_responses',
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'topic_responses')
UNION ALL
SELECT 
    'blueprint_topic_resources',
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'blueprint_topic_resources');

-- Check that resource_explanation column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'blueprint_topic_resources'
ORDER BY ordinal_position;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Resource persistence tables created successfully!';
    RAISE NOTICE '✅ Resources will now persist across page refreshes';
    RAISE NOTICE '✅ Run the CHECK_RESOURCE_TABLES.sql to verify everything is set up';
END $$;

