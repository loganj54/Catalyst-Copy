-- ============================================================================
-- CHECK IF RESOURCE PERSISTENCE TABLES EXIST
-- ============================================================================
-- Run this in Supabase SQL Editor to verify your database schema
-- ============================================================================

-- Check if curated_resources table exists
SELECT 
    'curated_resources' as table_name,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'curated_resources'
    ) as exists;

-- Check if blueprint_topic_resources table exists
SELECT 
    'blueprint_topic_resources' as table_name,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'blueprint_topic_resources'
    ) as exists;

-- Check if topic_responses table exists
SELECT 
    'topic_responses' as table_name,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'topic_responses'
    ) as exists;

-- ============================================================================
-- CHECK COLUMNS IN blueprint_topic_resources
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'blueprint_topic_resources'
ORDER BY ordinal_position;

-- ============================================================================
-- CHECK IF resource_explanation COLUMN EXISTS
-- ============================================================================

SELECT 
    EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'blueprint_topic_resources'
        AND column_name = 'resource_explanation'
    ) as resource_explanation_exists;

-- ============================================================================
-- COUNT EXISTING RESOURCES
-- ============================================================================

SELECT 
    (SELECT COUNT(*) FROM curated_resources) as total_resources,
    (SELECT COUNT(*) FROM blueprint_topic_resources) as total_links,
    (SELECT COUNT(*) FROM blueprint_topic_resources WHERE resource_explanation IS NOT NULL) as links_with_explanations;

