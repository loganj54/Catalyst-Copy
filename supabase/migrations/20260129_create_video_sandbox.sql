-- ============================================================================
-- VIDEO SANDBOX TABLE
-- ============================================================================
-- Isolated test environment for enhanced video discovery pipeline
-- Completely separate from production resources_from_make table
-- ============================================================================

-- ============================================================================
-- CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_sandbox (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- YouTube video identity
    video_id TEXT UNIQUE NOT NULL,  -- YouTube video ID (e.g., "dQw4w9WgXcQ")
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    
    -- Channel info
    channel_name TEXT,
    channel_url TEXT,
    thumbnail_url TEXT,
    
    -- Video metadata
    duration TEXT,  -- Format: "HH:MM:SS" from YouTube API
    view_count INTEGER,
    
    -- Raw content
    transcript TEXT,
    
    -- AI Analysis results
    summary TEXT,
    teaching_style TEXT,  -- 'lecture', 'visual', 'worked-example', 'demo'
    visual_elements TEXT[],  -- ['animations', 'diagrams', 'simulations']
    math_coverage TEXT[],  -- ['derivations', 'worked examples', 'formulas shown']
    applications TEXT[],  -- ['HVAC systems', 'automotive cooling', 'aerospace']
    
    -- 4-Dimension Scores (0.0 to 1.0)
    beginner_score REAL NOT NULL DEFAULT 0.5,
    visualization_score REAL NOT NULL DEFAULT 0.5,
    math_explanation_score REAL NOT NULL DEFAULT 0.5,
    real_world_score REAL NOT NULL DEFAULT 0.5,
    ai_quality_score REAL NOT NULL DEFAULT 0.5,
    
    -- Text used to generate embedding (for debugging/reprocessing)
    embedding_text TEXT,
    
    -- Original search context (what query found this video)
    original_search_query TEXT,
    original_search_context TEXT,
    
    -- YouTube Comments (stored to avoid re-scraping)
    comments_json JSONB,  -- Raw comments from YouTube
    comment_analysis_json JSONB,  -- AI analysis of comments (quality signals)
    
    -- Engagement tracking (future use)
    times_shown INTEGER DEFAULT 0,
    times_clicked INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on video_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_video_sandbox_video_id 
ON video_sandbox(video_id);

-- Indexes for filtering by type scores
CREATE INDEX IF NOT EXISTS idx_video_sandbox_beginner_score 
ON video_sandbox(beginner_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_video_sandbox_visualization_score 
ON video_sandbox(visualization_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_video_sandbox_math_score 
ON video_sandbox(math_explanation_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_video_sandbox_real_world_score 
ON video_sandbox(real_world_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_video_sandbox_quality_score 
ON video_sandbox(ai_quality_score DESC NULLS LAST);

-- Index on created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_video_sandbox_created_at 
ON video_sandbox(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE video_sandbox ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read videos
CREATE POLICY "Authenticated users can read video sandbox"
    ON video_sandbox FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy: Service role can manage all videos
CREATE POLICY "Service role can manage video sandbox"
    ON video_sandbox FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment times_shown
CREATE OR REPLACE FUNCTION increment_video_sandbox_shown(p_video_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE video_sandbox 
    SET times_shown = times_shown + 1,
        updated_at = NOW()
    WHERE video_id = p_video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment times_clicked
CREATE OR REPLACE FUNCTION increment_video_sandbox_clicked(p_video_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE video_sandbox 
    SET times_clicked = times_clicked + 1,
        updated_at = NOW()
    WHERE video_id = p_video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE video_sandbox IS 
    'Isolated test environment for enhanced video discovery with multi-dimensional scoring';

COMMENT ON COLUMN video_sandbox.video_id IS 
    'YouTube video ID extracted from URL';

COMMENT ON COLUMN video_sandbox.beginner_score IS 
    'Score 0-1: How accessible to complete beginners (1 = assumes no prior knowledge)';

COMMENT ON COLUMN video_sandbox.visualization_score IS 
    'Score 0-1: How visual the teaching approach is (1 = heavy use of animations/diagrams)';

COMMENT ON COLUMN video_sandbox.math_explanation_score IS 
    'Score 0-1: How much mathematical derivation/worked examples (1 = step-by-step math)';

COMMENT ON COLUMN video_sandbox.real_world_score IS 
    'Score 0-1: How practical/applied the content is (1 = real engineering examples)';

COMMENT ON COLUMN video_sandbox.embedding_text IS 
    'Composite text used to generate the vector embedding for this video';
