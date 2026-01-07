-- ============================================================================
-- FIX: Update blueprint_topic_resources to use resources_from_make
-- ============================================================================
-- This updates the foreign key to point to resources_from_make instead of curated_resources
-- and drops the old curated_resources table if it exists
-- ============================================================================

-- Step 1: Drop the old foreign key constraint if it exists
DO $$ 
BEGIN
    -- Drop constraint on blueprint_topic_resources if it references curated_resources
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%curated_resources%' 
        AND table_name = 'blueprint_topic_resources'
    ) THEN
        ALTER TABLE blueprint_topic_resources 
        DROP CONSTRAINT IF EXISTS blueprint_topic_resources_resource_id_fkey;
        RAISE NOTICE '✅ Dropped old foreign key constraint';
    END IF;
END $$;

-- Step 2: Ensure blueprint_topic_resources table exists with correct structure
CREATE TABLE IF NOT EXISTS blueprint_topic_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,
    resource_id UUID NOT NULL, -- Will reference resources_from_make.id
    
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

-- Step 3: Add foreign key to resources_from_make
ALTER TABLE blueprint_topic_resources
DROP CONSTRAINT IF EXISTS blueprint_topic_resources_resource_id_fkey;

ALTER TABLE blueprint_topic_resources
ADD CONSTRAINT blueprint_topic_resources_resource_id_fkey 
FOREIGN KEY (resource_id) REFERENCES resources_from_make(id) ON DELETE CASCADE;

-- Step 4: Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_blueprint 
ON blueprint_topic_resources(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_resource 
ON blueprint_topic_resources(resource_id);

CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_unit 
ON blueprint_topic_resources(unit_id);

-- Step 5: Ensure RLS policies exist
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

-- Step 6: Drop search_similar_resources function (not needed with resources_from_make)
DROP FUNCTION IF EXISTS search_similar_resources(vector, double precision, integer);
DROP FUNCTION IF EXISTS search_similar_resources(vector, float, integer);

-- Step 7: Drop curated_resources table if it exists (optional - only if you want to clean up)
-- UNCOMMENT THE NEXT LINE IF YOU WANT TO DELETE THE OLD TABLE
-- DROP TABLE IF EXISTS curated_resources CASCADE;

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that foreign key points to resources_from_make
SELECT 
    '✅ Foreign Key Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu 
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'blueprint_topic_resources'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'resources_from_make'
        )
        THEN '✅ blueprint_topic_resources now references resources_from_make'
        ELSE '❌ Foreign key not set correctly'
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
        'Resources: ', (SELECT COUNT(*) FROM resources_from_make),
        ' | Links: ', (SELECT COUNT(*) FROM blueprint_topic_resources),
        ' | Explanations: ', (SELECT COUNT(*) FROM blueprint_topic_resources WHERE resource_explanation IS NOT NULL)
    ) as result;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
    RAISE NOTICE '';
    RAISE NOTICE '✅ ============================================';
    RAISE NOTICE '✅ Database updated to use resources_from_make!';
    RAISE NOTICE '✅ ============================================';
    RAISE NOTICE '';
    RAISE NOTICE '📝 What changed:';
    RAISE NOTICE '  - blueprint_topic_resources now references resources_from_make';
    RAISE NOTICE '  - Old search_similar_resources function removed';
    RAISE NOTICE '  - curated_resources table NOT deleted (commented out)';
    RAISE NOTICE '';
    RAISE NOTICE '📝 NEXT STEPS:';
    RAISE NOTICE '  1. Update Blueprint.jsx to join with resources_from_make';
    RAISE NOTICE '  2. Test searching for resources in your app';
    RAISE NOTICE '  3. Refresh the page - resources will persist!';
    RAISE NOTICE '';
END $$;

