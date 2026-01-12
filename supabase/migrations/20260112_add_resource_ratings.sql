-- ============================================================================
-- ADD RESOURCE RATINGS SYSTEM
-- ============================================================================
-- Adds rating columns to resources_from_make and creates resource_ratings table
-- for tracking individual user ratings with aggregate statistics
-- ============================================================================

-- ============================================================================
-- ADD RATING COLUMNS TO RESOURCES_FROM_MAKE
-- ============================================================================

ALTER TABLE resources_from_make
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_sum INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) GENERATED ALWAYS AS (
    CASE WHEN rating_count > 0 THEN rating_sum::DECIMAL / rating_count ELSE NULL END
) STORED;

-- Index for sorting by rating
CREATE INDEX IF NOT EXISTS idx_resources_from_make_average_rating
ON resources_from_make(average_rating DESC NULLS LAST);

-- ============================================================================
-- RESOURCE_RATINGS TABLE
-- ============================================================================
-- Stores individual user ratings for resources (one per user per resource)

CREATE TABLE IF NOT EXISTS resource_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources_from_make(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- One rating per user per resource
    UNIQUE(resource_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resource_ratings_resource_id
ON resource_ratings(resource_id);

CREATE INDEX IF NOT EXISTS idx_resource_ratings_user_id
ON resource_ratings(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE resource_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read all ratings
CREATE POLICY "Users can read all resource ratings"
    ON resource_ratings FOR SELECT
    USING (auth.role() = 'authenticated');

-- Users can insert their own ratings
CREATE POLICY "Users can insert their own ratings"
    ON resource_ratings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings"
    ON resource_ratings FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their own ratings"
    ON resource_ratings FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can manage all ratings
CREATE POLICY "Service role can manage all ratings"
    ON resource_ratings FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- SUBMIT RATING RPC FUNCTION
-- ============================================================================
-- Upserts a user rating and updates aggregate statistics on resources_from_make

CREATE OR REPLACE FUNCTION submit_resource_rating(
    p_resource_id UUID,
    p_user_id UUID,
    p_rating INTEGER
)
RETURNS TABLE (
    new_average_rating DECIMAL(3,2),
    new_rating_count INTEGER
) AS $$
DECLARE
    v_old_rating INTEGER;
BEGIN
    -- Validate rating
    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;

    -- Get existing rating if any
    SELECT rating INTO v_old_rating
    FROM resource_ratings
    WHERE resource_id = p_resource_id AND user_id = p_user_id;

    IF v_old_rating IS NOT NULL THEN
        -- Update existing rating
        UPDATE resource_ratings
        SET rating = p_rating, updated_at = NOW()
        WHERE resource_id = p_resource_id AND user_id = p_user_id;

        -- Update aggregates (adjust for changed rating)
        UPDATE resources_from_make
        SET rating_sum = rating_sum - v_old_rating + p_rating
        WHERE id = p_resource_id;
    ELSE
        -- Insert new rating
        INSERT INTO resource_ratings (resource_id, user_id, rating)
        VALUES (p_resource_id, p_user_id, p_rating);

        -- Update aggregates (new rating)
        UPDATE resources_from_make
        SET rating_count = rating_count + 1,
            rating_sum = rating_sum + p_rating
        WHERE id = p_resource_id;
    END IF;

    -- Return new aggregate values
    RETURN QUERY
    SELECT average_rating, rating_count
    FROM resources_from_make
    WHERE id = p_resource_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE resource_ratings IS 
    'Stores individual user ratings (1-5 stars) for educational resources';

COMMENT ON COLUMN resources_from_make.rating_count IS 
    'Total number of ratings this resource has received';

COMMENT ON COLUMN resources_from_make.rating_sum IS 
    'Sum of all star ratings (used to calculate average)';

COMMENT ON COLUMN resources_from_make.average_rating IS 
    'Computed average rating (rating_sum / rating_count)';

COMMENT ON FUNCTION submit_resource_rating IS 
    'Upserts a user rating and updates aggregate statistics on the resource';
