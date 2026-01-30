-- ============================================================================
-- BLUEPRINT EXPLAINERS TABLE
-- ============================================================================
-- Stores user-opened explainer modules (video, explain, question) for blueprints
-- Persists across page refreshes and browser sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS blueprint_explainers (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Blueprint reference
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,

    -- Explainer identification and type
    explainer_type TEXT NOT NULL CHECK (explainer_type IN ('video', 'explain', 'question')),
    term TEXT NOT NULL,

    -- Context for regenerating content
    context TEXT,
    solution_context TEXT,
    unit_id TEXT,

    -- Positioning data (for re-anchoring)
    anchor_rect JSONB,
    captured_scroll_top NUMERIC,

    -- Type-specific cached content (to avoid re-fetching)
    cached_explanation TEXT,           -- For 'explain' type
    cached_video_data JSONB,           -- For 'video' type: { url, title, thumbnail_url, duration, query }
    conversation_history JSONB,        -- For 'question' type: array of { role, content }

    -- Video-specific query info
    selected_query TEXT,

    -- State flags
    is_open BOOLEAN DEFAULT true,
    is_hidden BOOLEAN DEFAULT false,

    -- Ownership and timestamps
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_blueprint_explainers_blueprint_id
ON blueprint_explainers(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_explainers_user_id
ON blueprint_explainers(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE blueprint_explainers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read explainers for their own blueprints
CREATE POLICY "Users can read own explainers"
    ON blueprint_explainers FOR SELECT
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can insert explainers for their blueprints
CREATE POLICY "Users can insert explainers for own blueprints"
    ON blueprint_explainers FOR INSERT
    WITH CHECK (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can update explainers for their blueprints
CREATE POLICY "Users can update explainers for own blueprints"
    ON blueprint_explainers FOR UPDATE
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    )
    WITH CHECK (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can delete explainers for their blueprints
CREATE POLICY "Users can delete explainers for own blueprints"
    ON blueprint_explainers FOR DELETE
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_blueprint_explainers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_blueprint_explainers_updated_at ON blueprint_explainers;
CREATE TRIGGER trigger_blueprint_explainers_updated_at
    BEFORE UPDATE ON blueprint_explainers
    FOR EACH ROW
    EXECUTE FUNCTION update_blueprint_explainers_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE blueprint_explainers IS
    'Stores user-opened explainer modules (video, explain, question) for blueprints, persisting across sessions';

COMMENT ON COLUMN blueprint_explainers.explainer_type IS
    'Type of explainer: video, explain, or question';

COMMENT ON COLUMN blueprint_explainers.anchor_rect IS
    'Bounding rectangle data for positioning the explainer bubble relative to selected text';

COMMENT ON COLUMN blueprint_explainers.conversation_history IS
    'For question-type explainers, stores the full conversation as JSON array';
