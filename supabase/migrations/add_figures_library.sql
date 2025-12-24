-- ============================================================================
-- FIGURES LIBRARY MIGRATION
-- ============================================================================
-- Creates a global figures/diagrams cache with vector embeddings for semantic
-- similarity matching. This enables reuse of figures, charts, diagrams, and
-- tables across blueprints.
-- ============================================================================

-- ============================================================================
-- CURATED_FIGURES TABLE (Global Figure Cache)
-- ============================================================================
-- Master table of all figures/diagrams with metadata and storage URLs.
-- Each figure has a name_embedding for semantic similarity matching.
-- Once a figure like "Moody Diagram" is cached, it can be reused globally.
-- ============================================================================

CREATE TABLE IF NOT EXISTS curated_figures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Figure identification
    name TEXT NOT NULL,                     -- e.g., "Moody Diagram", "Unit Circle", "Sphere Volume Formula"
    description TEXT NOT NULL,              -- What the figure shows and how it helps
    figure_type TEXT NOT NULL,              -- 'diagram', 'chart', 'graph', 'table', 'illustration'
    
    -- Storage URLs
    file_url TEXT NOT NULL,                 -- Supabase storage URL for full-size image
    thumbnail_url TEXT,                     -- Smaller version for previews (optional)
    
    -- Metadata for searching and filtering
    subject_area TEXT NOT NULL,             -- 'physics', 'math', 'chemistry', 'engineering', etc.
    topic_tags TEXT[],                      -- Array of related topics for matching
    concepts TEXT[],                        -- Key concepts shown in the figure
    
    -- Semantic Matching
    name_embedding vector(1536),            -- OpenAI embedding of name + description for matching
    
    -- Source attribution (for copyright compliance)
    source TEXT,                            -- 'Wikimedia Commons', 'Generated', 'Wikipedia', 'Custom'
    license TEXT,                           -- 'CC-BY-SA', 'Public Domain', 'CC0', etc.
    original_url TEXT,                      -- Attribution link to original source
    
    -- Quality tracking
    times_used INTEGER DEFAULT 0,           -- How many times used across blueprints
    quality_score FLOAT DEFAULT 0.5,        -- Quality rating (0-1)
    verified BOOLEAN DEFAULT false,         -- Has been manually verified
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate figures with same URL
    UNIQUE(file_url)
);

-- IVFFlat index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_curated_figures_embedding 
ON curated_figures 
USING ivfflat (name_embedding vector_cosine_ops)
WITH (lists = 50);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_curated_figures_name 
ON curated_figures(name);

CREATE INDEX IF NOT EXISTS idx_curated_figures_subject 
ON curated_figures(subject_area);

CREATE INDEX IF NOT EXISTS idx_curated_figures_type 
ON curated_figures(figure_type);

CREATE INDEX IF NOT EXISTS idx_curated_figures_times_used 
ON curated_figures(times_used DESC);

CREATE INDEX IF NOT EXISTS idx_curated_figures_topic_tags 
ON curated_figures USING gin(topic_tags);

CREATE INDEX IF NOT EXISTS idx_curated_figures_concepts 
ON curated_figures USING gin(concepts);

-- ============================================================================
-- BLUEPRINT_UNIT_FIGURES TABLE (Junction Table)
-- ============================================================================
-- Links blueprint learning units to curated figures.
-- Allows figures to be associated with specific learning units.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blueprint_unit_figures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,                  -- References unit_id from learning structure
    figure_id UUID NOT NULL REFERENCES curated_figures(id) ON DELETE CASCADE,
    
    -- Display metadata
    display_index INTEGER DEFAULT 1,        -- Order to display (1, 2, 3...)
    from_cache BOOLEAN DEFAULT false,       -- Was this a cache hit from existing figure?
    relevance_explanation TEXT,             -- Why this figure helps with this unit
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique figure per unit per blueprint
    UNIQUE(blueprint_id, unit_id, figure_id)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_unit_figures_blueprint 
ON blueprint_unit_figures(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_unit_figures_unit 
ON blueprint_unit_figures(blueprint_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_unit_figures_figure 
ON blueprint_unit_figures(figure_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- curated_figures: Public read, service role write
ALTER TABLE curated_figures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read curated figures"
    ON curated_figures FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage curated figures"
    ON curated_figures FOR ALL
    USING (auth.role() = 'service_role');

-- blueprint_unit_figures: Users can view their blueprint figures
ALTER TABLE blueprint_unit_figures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blueprint unit figures"
    ON blueprint_unit_figures FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM blueprints 
            WHERE blueprints.id = blueprint_unit_figures.blueprint_id 
            AND blueprints.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage blueprint unit figures"
    ON blueprint_unit_figures FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_curated_figures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_curated_figures_updated_at ON curated_figures;
CREATE TRIGGER trigger_curated_figures_updated_at
    BEFORE UPDATE ON curated_figures
    FOR EACH ROW
    EXECUTE FUNCTION update_curated_figures_updated_at();

-- ============================================================================
-- HELPER FUNCTION: Search Similar Figures
-- ============================================================================
-- Function to search for figures with similar names/descriptions using cosine similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_figures(
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.85,
    max_results INTEGER DEFAULT 5,
    filter_subject_area TEXT DEFAULT NULL,
    filter_figure_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    figure_type TEXT,
    file_url TEXT,
    thumbnail_url TEXT,
    subject_area TEXT,
    topic_tags TEXT[],
    concepts TEXT[],
    source TEXT,
    license TEXT,
    original_url TEXT,
    times_used INTEGER,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cf.id,
        cf.name,
        cf.description,
        cf.figure_type,
        cf.file_url,
        cf.thumbnail_url,
        cf.subject_area,
        cf.topic_tags,
        cf.concepts,
        cf.source,
        cf.license,
        cf.original_url,
        cf.times_used,
        (1 - (cf.name_embedding <=> query_embedding))::FLOAT as similarity
    FROM curated_figures cf
    WHERE cf.name_embedding IS NOT NULL
      AND (1 - (cf.name_embedding <=> query_embedding)) > similarity_threshold
      AND (filter_subject_area IS NULL OR cf.subject_area = filter_subject_area)
      AND (filter_figure_type IS NULL OR cf.figure_type = filter_figure_type)
    ORDER BY cf.name_embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Find Figure by Name (Exact Match)
-- ============================================================================
-- Fast lookup for exact figure name matches
-- ============================================================================

CREATE OR REPLACE FUNCTION find_figure_by_name(
    figure_name TEXT,
    filter_subject_area TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    figure_type TEXT,
    file_url TEXT,
    thumbnail_url TEXT,
    subject_area TEXT,
    topic_tags TEXT[],
    concepts TEXT[],
    source TEXT,
    license TEXT,
    original_url TEXT,
    times_used INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cf.id,
        cf.name,
        cf.description,
        cf.figure_type,
        cf.file_url,
        cf.thumbnail_url,
        cf.subject_area,
        cf.topic_tags,
        cf.concepts,
        cf.source,
        cf.license,
        cf.original_url,
        cf.times_used
    FROM curated_figures cf
    WHERE LOWER(cf.name) = LOWER(figure_name)
      AND (filter_subject_area IS NULL OR cf.subject_area = filter_subject_area)
    ORDER BY cf.times_used DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INCREMENT USAGE COUNTER
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_figure_usage(figure_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE curated_figures
    SET times_used = times_used + 1
    WHERE id = figure_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STORAGE BUCKET SETUP
-- ============================================================================
-- Note: This needs to be run separately via Supabase dashboard or API
-- as CREATE BUCKET is not standard SQL
-- ============================================================================

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('figures-library', 'figures-library', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies will be set up separately

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE curated_figures IS 
    'Global cache of figures, diagrams, charts, and tables with vector embeddings for semantic matching and reuse';

COMMENT ON COLUMN curated_figures.file_url IS 
    'Supabase storage URL for the full-size image';

COMMENT ON COLUMN curated_figures.thumbnail_url IS 
    'Supabase storage URL for thumbnail version (optional, for faster loading)';

COMMENT ON COLUMN curated_figures.name_embedding IS 
    'OpenAI text-embedding-3-small vector (1536 dimensions) for similarity search';

COMMENT ON COLUMN curated_figures.source IS 
    'Source of the figure (Wikimedia Commons, Wikipedia, Generated, Custom, etc.)';

COMMENT ON COLUMN curated_figures.license IS 
    'License type for attribution (CC-BY-SA, Public Domain, CC0, etc.)';

COMMENT ON COLUMN curated_figures.times_used IS 
    'Counter for how many times this figure was used across all blueprints';

COMMENT ON TABLE blueprint_unit_figures IS 
    'Junction table linking blueprint learning units to cached figures';

COMMENT ON FUNCTION search_similar_figures IS 
    'Searches for figures with similar names/descriptions using cosine similarity on embeddings';

COMMENT ON FUNCTION find_figure_by_name IS 
    'Fast lookup for figures by exact name match (case-insensitive)';

COMMENT ON FUNCTION increment_figure_usage IS 
    'Increments the usage counter for a figure when it is displayed to a user';

