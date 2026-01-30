-- ============================================================================
-- BLUEPRINT VIDEO RANKINGS TABLE
-- ============================================================================
-- Stores ranked video results for each term/query in a blueprint
-- Supports the reroll feature by maintaining ordered video lists
-- ============================================================================

-- ============================================================================
-- CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS blueprint_video_rankings (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Blueprint and term reference
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    search_query TEXT NOT NULL,
    
    -- Target resource profile used for ranking
    target_resource_profile TEXT,
    
    -- Ranked video results (JSONB array)
    -- Each entry: {rank, video_id, url, title, channel_name, thumbnail_url, duration_seconds, summary, similarity_score, profile_match_score}
    ranked_videos JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Currently selected video rank (for reroll persistence)
    selected_rank INTEGER NOT NULL DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure one ranking per term/query combination per blueprint
    UNIQUE(blueprint_id, term, search_query)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for fast lookups by blueprint
CREATE INDEX IF NOT EXISTS idx_blueprint_video_rankings_blueprint_id 
ON blueprint_video_rankings(blueprint_id);

-- Index for combined blueprint + term lookups
CREATE INDEX IF NOT EXISTS idx_blueprint_video_rankings_blueprint_term 
ON blueprint_video_rankings(blueprint_id, term);

-- Index for full lookup
CREATE INDEX IF NOT EXISTS idx_blueprint_video_rankings_full_key 
ON blueprint_video_rankings(blueprint_id, term, search_query);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE blueprint_video_rankings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read rankings for their blueprints
CREATE POLICY "Users can read own video rankings"
    ON blueprint_video_rankings FOR SELECT
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can insert rankings for their blueprints
CREATE POLICY "Users can insert video rankings for own blueprints"
    ON blueprint_video_rankings FOR INSERT
    WITH CHECK (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can update rankings for their blueprints
CREATE POLICY "Users can update video rankings for own blueprints"
    ON blueprint_video_rankings FOR UPDATE
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    )
    WITH CHECK (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Users can delete rankings for their blueprints
CREATE POLICY "Users can delete video rankings for own blueprints"
    ON blueprint_video_rankings FOR DELETE
    USING (
        blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
    );

-- Policy: Service role can manage all rankings
CREATE POLICY "Service role can manage video rankings"
    ON blueprint_video_rankings FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_blueprint_video_rankings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_blueprint_video_rankings_updated_at ON blueprint_video_rankings;
CREATE TRIGGER trigger_blueprint_video_rankings_updated_at
    BEFORE UPDATE ON blueprint_video_rankings
    FOR EACH ROW
    EXECUTE FUNCTION update_blueprint_video_rankings_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get current selected video for a term
CREATE OR REPLACE FUNCTION get_selected_video_ranking(
    p_blueprint_id UUID,
    p_term TEXT,
    p_search_query TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_ranking RECORD;
    v_selected_video JSONB;
BEGIN
    -- Get the ranking record
    IF p_search_query IS NOT NULL THEN
        SELECT * INTO v_ranking
        FROM blueprint_video_rankings
        WHERE blueprint_id = p_blueprint_id 
          AND term = p_term 
          AND search_query = p_search_query
        LIMIT 1;
    ELSE
        SELECT * INTO v_ranking
        FROM blueprint_video_rankings
        WHERE blueprint_id = p_blueprint_id 
          AND term = p_term
        ORDER BY updated_at DESC
        LIMIT 1;
    END IF;
    
    IF v_ranking IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Extract the selected video from ranked_videos array
    SELECT elem INTO v_selected_video
    FROM jsonb_array_elements(v_ranking.ranked_videos) elem
    WHERE (elem->>'rank')::int = v_ranking.selected_rank
    LIMIT 1;
    
    RETURN v_selected_video;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update selected rank (for reroll)
CREATE OR REPLACE FUNCTION update_video_ranking_selection(
    p_blueprint_id UUID,
    p_term TEXT,
    p_search_query TEXT,
    p_new_rank INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_max_rank INTEGER;
BEGIN
    -- Get max rank from ranked_videos
    SELECT COALESCE(MAX((elem->>'rank')::int), 0) INTO v_max_rank
    FROM blueprint_video_rankings,
         jsonb_array_elements(ranked_videos) elem
    WHERE blueprint_id = p_blueprint_id 
      AND term = p_term 
      AND search_query = p_search_query;
    
    IF v_max_rank = 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Clamp rank to valid range
    p_new_rank := GREATEST(1, LEAST(p_new_rank, v_max_rank));
    
    -- Update the selection
    UPDATE blueprint_video_rankings
    SET selected_rank = p_new_rank,
        updated_at = NOW()
    WHERE blueprint_id = p_blueprint_id 
      AND term = p_term 
      AND search_query = p_search_query;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE blueprint_video_rankings IS 
    'Stores ranked video results for each term/query combination, supporting the reroll feature';

COMMENT ON COLUMN blueprint_video_rankings.ranked_videos IS 
    'JSONB array of ranked videos with scores and metadata';

COMMENT ON COLUMN blueprint_video_rankings.selected_rank IS 
    'Currently displayed video rank (1-5), updated when user rerolls';

COMMENT ON COLUMN blueprint_video_rankings.target_resource_profile IS 
    'AI-generated profile describing the ideal video for this query';

COMMENT ON FUNCTION get_selected_video_ranking IS 
    'Returns the currently selected video for a term in a blueprint';

COMMENT ON FUNCTION update_video_ranking_selection IS 
    'Updates the selected rank for reroll functionality';
