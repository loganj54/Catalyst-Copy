-- ============================================================================
-- LEARNING STRUCTURES TABLE
-- ============================================================================
-- Stores the generated learning structure with search queries for each topic
-- Created by the generate-structure edge function (Step 2 of the pipeline)
-- ============================================================================

-- Create the learning_structures table
CREATE TABLE IF NOT EXISTS learning_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES document_analyses(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- The generated learning structure (full hierarchical data)
    structure JSONB NOT NULL,
    
    -- Flattened search queries for easy access by search-resources step
    -- Format: [{ unit_id, topic, query, query_type, priority }]
    all_search_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadata for quick access
    total_prerequisites INTEGER DEFAULT 0,
    total_sections INTEGER DEFAULT 0,
    total_learning_units INTEGER DEFAULT 0,
    total_search_queries INTEGER DEFAULT 0,
    model_used TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_learning_structures_blueprint_id 
    ON learning_structures(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_learning_structures_user_id 
    ON learning_structures(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_structures_analysis_id 
    ON learning_structures(analysis_id);
CREATE INDEX IF NOT EXISTS idx_learning_structures_created_at 
    ON learning_structures(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE learning_structures ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own learning structures
CREATE POLICY "Users can view own learning structures"
    ON learning_structures
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own learning structures
CREATE POLICY "Users can insert own learning structures"
    ON learning_structures
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own learning structures
CREATE POLICY "Users can update own learning structures"
    ON learning_structures
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own learning structures
CREATE POLICY "Users can delete own learning structures"
    ON learning_structures
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for edge functions)
CREATE POLICY "Service role has full access to learning structures"
    ON learning_structures
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_learning_structures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_learning_structures_updated_at ON learning_structures;
CREATE TRIGGER trigger_learning_structures_updated_at
    BEFORE UPDATE ON learning_structures
    FOR EACH ROW
    EXECUTE FUNCTION update_learning_structures_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE learning_structures IS 
    'Stores generated learning structures with search queries for educational content discovery';

COMMENT ON COLUMN learning_structures.structure IS 
    'Full hierarchical learning structure with prerequisites_section and content_sections';

COMMENT ON COLUMN learning_structures.all_search_queries IS 
    'Flattened array of all search queries for batch processing by search-resources';

COMMENT ON COLUMN learning_structures.total_prerequisites IS 
    'Number of prerequisite topics identified';

COMMENT ON COLUMN learning_structures.total_sections IS 
    'Number of content sections (problems or topic sections)';

COMMENT ON COLUMN learning_structures.total_learning_units IS 
    'Total number of learning units across all sections';

COMMENT ON COLUMN learning_structures.total_search_queries IS 
    'Total number of search queries generated';

