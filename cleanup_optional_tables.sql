-- ============================================================================
-- OPTIONAL DATABASE CLEANUP SCRIPT
-- ============================================================================
-- ⚠️ WARNING: Only run this if you want to remove performance optimizations
-- and simplify your database structure.
--
-- This removes caching tables that improve performance but aren't essential
-- for core functionality.
--
-- BEFORE running this:
-- 1. Run inspect_database.sql to see what data you'll lose
-- 2. Make a backup of your database
-- 3. Read DATABASE_AUDIT_GUIDE.md to understand the impact
-- ============================================================================

-- ============================================================================
-- STEP 1: Remove Structure Caching System (saves ~15k tokens per cache hit)
-- ============================================================================
-- Impact: Blueprint generation will be slower and cost more OpenAI tokens
-- Benefit: Simpler database, fewer tables to manage
-- ============================================================================

-- Drop views first
DROP VIEW IF EXISTS most_valuable_cached_sections CASCADE;
DROP VIEW IF EXISTS section_cache_performance_by_subject CASCADE;
DROP VIEW IF EXISTS section_cache_statistics CASCADE;
DROP VIEW IF EXISTS cache_performance_by_subject CASCADE;
DROP VIEW IF EXISTS cache_statistics CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_section_cache_quality(UUID, FLOAT) CASCADE;
DROP FUNCTION IF EXISTS increment_section_cache_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS search_similar_section_structures(VECTOR, VECTOR, VECTOR, TEXT, TEXT, FLOAT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_cache_quality(UUID, FLOAT) CASCADE;
DROP FUNCTION IF EXISTS increment_cache_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS search_similar_blueprint_structures(VECTOR, VECTOR, VECTOR, TEXT, TEXT, FLOAT, INTEGER) CASCADE;

-- Drop the cache tables
DROP TABLE IF EXISTS cached_section_structures CASCADE;
DROP TABLE IF EXISTS cached_blueprint_structures CASCADE;

-- Remove cache tracking columns from blueprint_structures
ALTER TABLE blueprint_structures 
DROP COLUMN IF EXISTS from_cache,
DROP COLUMN IF EXISTS cache_source_id,
DROP COLUMN IF EXISTS cache_similarity;

SELECT '✅ Structure caching system removed' as status;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the cleanup was successful
-- ============================================================================

-- Should show no tables with 'cached' in the name
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%cached%';
-- Expected: 0 rows

-- Should show no functions with 'cache' in the name  
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%cache%';
-- Expected: 0 rows

-- Should show no views with 'cache' in the name
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE '%cache%';
-- Expected: 0 rows

SELECT '✅ Cleanup verification complete' as status;

-- ============================================================================
-- WHAT'S LEFT
-- ============================================================================
-- After running this cleanup, your database will have:
--
-- Core Tables (13 tables):
--   ✅ users - User accounts
--   ✅ classes - User's classes
--   ✅ blueprints - Learning plans
--   ✅ class_documents - Uploaded files
--   ✅ document_analyses - Document AI analysis
--   ✅ blueprint_structures - Generated learning structures
--   ✅ topic_responses - User comfort tracking
--   ✅ curated_resources - Educational videos/articles cache
--   ✅ blueprint_topic_resources - Links resources to blueprints
--   ✅ curated_equations - LaTeX equations library
--   ✅ blueprint_unit_equations - Links equations to learning units
--   ✅ curated_figures - Diagrams/charts library
--   ✅ blueprint_unit_figures - Links figures to learning units
--
-- The resource/equation/figure caching is kept because:
-- 1. It prevents duplicate YouTube API calls
-- 2. It provides consistent, high-quality resources
-- 3. It's actually used in the UI (Blueprint.jsx)
--
-- The structure caching is removed because:
-- 1. It's a "nice to have" optimization
-- 2. It's complex to maintain
-- 3. It's not visible to users
-- ============================================================================

