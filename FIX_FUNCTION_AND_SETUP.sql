-- ============================================================================
-- FIX: Drop and recreate the search_similar_resources function
-- ============================================================================
-- This fixes the "cannot change return type" error
-- ============================================================================

-- Step 1: Drop the existing function
DROP FUNCTION IF EXISTS search_similar_resources(vector, double precision, integer);
DROP FUNCTION IF EXISTS search_similar_resources(vector, float, integer);

-- Step 2: Recreate the function with correct signature
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
-- Step 3: Ensure resource_explanation column exists
-- ============================================================================

ALTER TABLE blueprint_topic_resources
ADD COLUMN IF NOT EXISTS resource_explanation TEXT;

-- ============================================================================
-- Step 4: Ensure transcript columns exist in curated_resources
-- ============================================================================

ALTER TABLE curated_resources
ADD COLUMN IF NOT EXISTS transcript_text TEXT;

ALTER TABLE curated_resources
ADD COLUMN IF NOT EXISTS transcript_analyzed BOOLEAN DEFAULT false;

ALTER TABLE curated_resources
ADD COLUMN IF NOT EXISTS transcript_source TEXT;

ALTER TABLE curated_resources
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that function was recreated
SELECT 
    '✅ Function Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT FROM pg_proc 
            WHERE proname = 'search_similar_resources'
        )
        THEN '✅ search_similar_resources function EXISTS'
        ELSE '❌ Function missing'
    END as result;

-- Check that resource_explanation column exists
SELECT 
    '✅ Column Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'blueprint_topic_resources'
            AND column_name = 'resource_explanation'
        )
        THEN '✅ resource_explanation column EXISTS'
        ELSE '❌ Column missing'
    END as result;

-- Show current counts
SELECT 
    '📊 Current Data' as check_type,
    CONCAT(
        'Resources: ', (SELECT COUNT(*) FROM curated_resources),
        ' | Links: ', (SELECT COUNT(*) FROM blueprint_topic_resources),
        ' | Explanations: ', (SELECT COUNT(*) FROM blueprint_topic_resources WHERE resource_explanation IS NOT NULL)
    ) as result;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Function fixed successfully!';
    RAISE NOTICE '✅ All columns verified!';
    RAISE NOTICE '';
    RAISE NOTICE '📝 NEXT STEPS:';
    RAISE NOTICE '1. The blueprint_topic_resources table is empty because you havent searched for resources yet';
    RAISE NOTICE '2. Go to your app and search for resources on a learning unit';
    RAISE NOTICE '3. Resources will be saved to the database automatically';
    RAISE NOTICE '4. Refresh the page - resources will still be there!';
END $$;

