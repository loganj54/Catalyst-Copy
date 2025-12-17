-- ============================================================================
-- CURATED EQUATIONS MIGRATION
-- ============================================================================
-- Creates a global equation cache with pgvector for semantic similarity
-- matching. This enables reuse of LaTeX equations across blueprints.
-- Similar pattern to curated_resources for videos.
-- ============================================================================

-- ============================================================================
-- CURATED_EQUATIONS TABLE (Global Equation Cache)
-- ============================================================================
-- Master table of all equations with LaTeX notation.
-- Each equation has a name_embedding for semantic similarity matching.
-- Once an equation like "Planck's Law" is generated, it can be reused globally.
-- ============================================================================

CREATE TABLE IF NOT EXISTS curated_equations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Equation identification
    name TEXT NOT NULL,                 -- e.g., "Stefan-Boltzmann Law", "Planck's Law"
    latex TEXT NOT NULL,                -- LaTeX notation: "E = \\sigma T^4"
    
    -- Variable definitions (stored as JSONB for flexibility)
    -- Format: {"T": "Temperature in Kelvin", "\\sigma": "Stefan-Boltzmann constant"}
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Usage context
    when_to_use TEXT,                   -- Brief description of when to apply
    subject_area TEXT,                  -- physics, math, chemistry, engineering
    topic_tags TEXT[],                  -- Array of related topics for matching
    
    -- Semantic Matching
    name_embedding vector(1536),        -- OpenAI embedding of name + context for matching
    
    -- Quality tracking
    times_used INTEGER DEFAULT 0,       -- How many times used across blueprints
    verified BOOLEAN DEFAULT false,     -- Has been manually verified as correct
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate equations with same name and LaTeX
    UNIQUE(name, latex)
);

-- IVFFlat index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_curated_equations_embedding 
ON curated_equations 
USING ivfflat (name_embedding vector_cosine_ops)
WITH (lists = 50);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_curated_equations_name 
ON curated_equations(name);

CREATE INDEX IF NOT EXISTS idx_curated_equations_subject 
ON curated_equations(subject_area);

CREATE INDEX IF NOT EXISTS idx_curated_equations_times_used 
ON curated_equations(times_used DESC);

CREATE INDEX IF NOT EXISTS idx_curated_equations_topic_tags 
ON curated_equations USING gin(topic_tags);

-- ============================================================================
-- BLUEPRINT_UNIT_EQUATIONS TABLE (Junction Table)
-- ============================================================================
-- Links blueprint learning units to curated equations.
-- Allows equations to be associated with specific learning units.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blueprint_unit_equations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,              -- References unit_id from learning structure
    equation_id UUID NOT NULL REFERENCES curated_equations(id) ON DELETE CASCADE,
    
    -- Display metadata
    display_index INTEGER DEFAULT 1,    -- Order to display (1, 2, 3...)
    from_cache BOOLEAN DEFAULT false,   -- Was this a cache hit from existing equation?
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique equation per position per unit per blueprint
    UNIQUE(blueprint_id, unit_id, equation_id)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_unit_equations_blueprint 
ON blueprint_unit_equations(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_unit_equations_unit 
ON blueprint_unit_equations(blueprint_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_unit_equations_equation 
ON blueprint_unit_equations(equation_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- curated_equations: Public read, service role write
ALTER TABLE curated_equations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read curated equations"
    ON curated_equations FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage curated equations"
    ON curated_equations FOR ALL
    USING (auth.role() = 'service_role');

-- blueprint_unit_equations: Users can view their blueprint equations
ALTER TABLE blueprint_unit_equations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blueprint unit equations"
    ON blueprint_unit_equations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM blueprints 
            WHERE blueprints.id = blueprint_unit_equations.blueprint_id 
            AND blueprints.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage blueprint unit equations"
    ON blueprint_unit_equations FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_curated_equations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_curated_equations_updated_at ON curated_equations;
CREATE TRIGGER trigger_curated_equations_updated_at
    BEFORE UPDATE ON curated_equations
    FOR EACH ROW
    EXECUTE FUNCTION update_curated_equations_updated_at();

-- ============================================================================
-- HELPER FUNCTION: Search Similar Equations
-- ============================================================================
-- Function to search for equations with similar names using cosine similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_equations(
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.90,
    max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    latex TEXT,
    variables JSONB,
    when_to_use TEXT,
    subject_area TEXT,
    topic_tags TEXT[],
    times_used INTEGER,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.name,
        ce.latex,
        ce.variables,
        ce.when_to_use,
        ce.subject_area,
        ce.topic_tags,
        ce.times_used,
        (1 - (ce.name_embedding <=> query_embedding))::FLOAT as similarity
    FROM curated_equations ce
    WHERE ce.name_embedding IS NOT NULL
      AND (1 - (ce.name_embedding <=> query_embedding)) > similarity_threshold
    ORDER BY ce.name_embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Find Equation by Name (Exact Match)
-- ============================================================================
-- Fast lookup for exact equation name matches
-- ============================================================================

CREATE OR REPLACE FUNCTION find_equation_by_name(
    equation_name TEXT
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    latex TEXT,
    variables JSONB,
    when_to_use TEXT,
    subject_area TEXT,
    topic_tags TEXT[],
    times_used INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.name,
        ce.latex,
        ce.variables,
        ce.when_to_use,
        ce.subject_area,
        ce.topic_tags,
        ce.times_used
    FROM curated_equations ce
    WHERE LOWER(ce.name) = LOWER(equation_name)
    ORDER BY ce.times_used DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INCREMENT USAGE COUNTER
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_equation_usage(equation_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE curated_equations
    SET times_used = times_used + 1
    WHERE id = equation_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE curated_equations IS 
    'Global cache of LaTeX equations with vector embeddings for semantic matching and reuse';

COMMENT ON COLUMN curated_equations.latex IS 
    'LaTeX notation of the equation (e.g., "E = \\sigma T^4")';

COMMENT ON COLUMN curated_equations.variables IS 
    'JSONB object mapping variable symbols to their descriptions';

COMMENT ON COLUMN curated_equations.name_embedding IS 
    'OpenAI text-embedding-3-small vector (1536 dimensions) for similarity search';

COMMENT ON COLUMN curated_equations.times_used IS 
    'Counter for how many times this equation was used across all blueprints';

COMMENT ON TABLE blueprint_unit_equations IS 
    'Junction table linking blueprint learning units to cached equations';

COMMENT ON FUNCTION search_similar_equations IS 
    'Searches for equations with similar names using cosine similarity on embeddings';

COMMENT ON FUNCTION find_equation_by_name IS 
    'Fast lookup for equations by exact name match (case-insensitive)';

COMMENT ON FUNCTION increment_equation_usage IS 
    'Increments the usage counter for an equation when it is displayed to a user';

