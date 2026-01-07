-- ============================================================================
-- QUICK CHECK - Do I need to run migrations?
-- ============================================================================
-- Copy and paste this ENTIRE query into Supabase SQL Editor and click RUN
-- ============================================================================

-- Check 1: Do the tables exist?
SELECT 
    '✅ Tables Check' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'curated_resources')
         AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'blueprint_topic_resources')
         AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'topic_responses')
        THEN '✅ ALL TABLES EXIST - You are good to go!'
        ELSE '❌ TABLES MISSING - Run SETUP_RESOURCE_PERSISTENCE.sql'
    END as result;

-- Check 2: Does resource_explanation column exist?
SELECT 
    '✅ Column Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'blueprint_topic_resources'
            AND column_name = 'resource_explanation'
        )
        THEN '✅ resource_explanation column EXISTS - Explanations will persist!'
        ELSE '❌ resource_explanation column MISSING - Run SETUP_RESOURCE_PERSISTENCE.sql'
    END as result;

-- Check 3: Show current data counts
SELECT 
    '📊 Data Count' as check_type,
    CONCAT(
        'Resources: ', (SELECT COUNT(*) FROM curated_resources),
        ' | Links: ', (SELECT COUNT(*) FROM blueprint_topic_resources),
        ' | With Explanations: ', (SELECT COUNT(*) FROM blueprint_topic_resources WHERE resource_explanation IS NOT NULL)
    ) as result;

-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- If you see:
--   ✅ ALL TABLES EXIST - You don't need to run any migrations!
--   ✅ resource_explanation column EXISTS - The system is ready!
--
-- If you see:
--   ❌ TABLES MISSING or ❌ column MISSING
--   → Run SETUP_RESOURCE_PERSISTENCE.sql in SQL Editor
-- ============================================================================

