-- ============================================================================
-- BLUEPRINT VIDEO SELECTIONS TABLE
-- ============================================================================
-- Stores which video is selected for each learning unit in a blueprint
-- Persists video selections across page refreshes and browser sessions
-- ============================================================================

-- ============================================================================
-- CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS blueprint_video_selections (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Blueprint and unit reference
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,
    
    -- Selected video information
    video_url TEXT NOT NULL,
    video_title TEXT,
    video_thumbnail_url TEXT,
    video_duration TEXT,
    video_channel_name TEXT,
    
    -- Optional reference to video_sandbox or blueprint_topic_resources
    video_sandbox_id UUID REFERENCES video_sandbox(id) ON DELETE SET NULL,
    resource_id UUID,  -- References blueprint_topic_resources if applicable
    
    -- Selection metadata
    selected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure one video per unit per blueprint
    UNIQUE(blueprint_id, unit_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for fast lookups by blueprint
CREATE INDEX IF NOT EXISTS idx_blueprint_video_selections_blueprint_id 
ON blueprint_video_selections(blueprint_id);

-- Index for combined blueprint + unit lookups
CREATE INDEX IF NOT EXISTS idx_blueprint_video_selections_blueprint_unit 
ON blueprint_video_selections(blueprint_id, unit_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE blueprint_video_selections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own video selections
CREATE POLICY "Users can read own video selections"
    ON blueprint_video_selections FOR SELECT
    USING (
        selected_by = auth.uid() OR 
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can insert video selections for their blueprints
CREATE POLICY "Users can insert video selections for own blueprints"
    ON blueprint_video_selections FOR INSERT
    WITH CHECK (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can update video selections for their blueprints
CREATE POLICY "Users can update video selections for own blueprints"
    ON blueprint_video_selections FOR UPDATE
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    )
    WITH CHECK (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can delete video selections for their blueprints
CREATE POLICY "Users can delete video selections for own blueprints"
    ON blueprint_video_selections FOR DELETE
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Service role can manage all video selections
CREATE POLICY "Service role can manage video selections"
    ON blueprint_video_selections FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_blueprint_video_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_blueprint_video_selections_updated_at ON blueprint_video_selections;
CREATE TRIGGER trigger_blueprint_video_selections_updated_at
    BEFORE UPDATE ON blueprint_video_selections
    FOR EACH ROW
    EXECUTE FUNCTION update_blueprint_video_selections_updated_at();

-- ============================================================================
-- UPSERT FUNCTION
-- ============================================================================
-- Helper function to save or update a video selection

CREATE OR REPLACE FUNCTION upsert_video_selection(
    p_blueprint_id UUID,
    p_unit_id TEXT,
    p_video_url TEXT,
    p_video_title TEXT DEFAULT NULL,
    p_video_thumbnail_url TEXT DEFAULT NULL,
    p_video_duration TEXT DEFAULT NULL,
    p_video_channel_name TEXT DEFAULT NULL,
    p_selected_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO blueprint_video_selections (
        blueprint_id,
        unit_id,
        video_url,
        video_title,
        video_thumbnail_url,
        video_duration,
        video_channel_name,
        selected_by
    ) VALUES (
        p_blueprint_id,
        p_unit_id,
        p_video_url,
        p_video_title,
        p_video_thumbnail_url,
        p_video_duration,
        p_video_channel_name,
        p_selected_by
    )
    ON CONFLICT (blueprint_id, unit_id) 
    DO UPDATE SET
        video_url = EXCLUDED.video_url,
        video_title = EXCLUDED.video_title,
        video_thumbnail_url = EXCLUDED.video_thumbnail_url,
        video_duration = EXCLUDED.video_duration,
        video_channel_name = EXCLUDED.video_channel_name,
        selected_by = EXCLUDED.selected_by,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE blueprint_video_selections IS 
    'Stores which video is selected for each learning unit in a blueprint, persisting across sessions';

COMMENT ON COLUMN blueprint_video_selections.unit_id IS 
    'The learning unit ID within the blueprint structure';

COMMENT ON COLUMN blueprint_video_selections.video_url IS 
    'Full URL of the selected video (YouTube, etc.)';

COMMENT ON FUNCTION upsert_video_selection IS 
    'Upserts a video selection for a blueprint unit, creating or updating as needed';
