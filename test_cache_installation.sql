-- ============================================================================
-- QUICK TEST: Verify Cache System Installation
-- ============================================================================
-- Run this after deploying the migration to verify everything is working
-- ============================================================================

-- 1. Verify table was created
SELECT 
  'cached_blueprint_structures table' as component,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables
WHERE table_name = 'cached_blueprint_structures';

-- 2. Verify indexes were created
SELECT 
  'Vector indexes' as component,
  CASE WHEN COUNT(*) >= 3 THEN '✅ EXISTS' ELSE '⚠️ INCOMPLETE' END as status,
  COUNT(*) as index_count
FROM pg_indexes
WHERE tablename = 'cached_blueprint_structures'
  AND indexname LIKE '%embedding%';

-- 3. Verify search function exists
SELECT 
  'search_similar_blueprint_structures()' as component,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM pg_proc
WHERE proname = 'search_similar_blueprint_structures';

-- 4. Verify increment function exists
SELECT 
  'increment_cache_usage()' as component,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM pg_proc
WHERE proname = 'increment_cache_usage';

-- 5. Verify update quality function exists
SELECT 
  'update_cache_quality()' as component,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM pg_proc
WHERE proname = 'update_cache_quality';

-- 6. Verify new columns in blueprint_structures
SELECT 
  'blueprint_structures columns' as component,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ EXISTS'
    ELSE '⚠️ INCOMPLETE (' || COUNT(*)::text || '/3)' 
  END as status
FROM information_schema.columns
WHERE table_name = 'blueprint_structures'
  AND column_name IN ('from_cache', 'cache_source_id', 'cache_similarity');

-- 7. Verify views were created
SELECT 
  'cache_statistics view' as component,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.views
WHERE table_name = 'cache_statistics';

SELECT 
  'cache_performance_by_subject view' as component,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.views
WHERE table_name = 'cache_performance_by_subject';

-- ============================================================================
-- Expected Output: All components should show ✅ EXISTS
-- ============================================================================

-- 8. Show initial cache state
SELECT 
  'Initial cache state' as info,
  COUNT(*) as cached_structures,
  '0 expected (cache is empty initially)' as note
FROM cached_blueprint_structures;

-- ============================================================================
-- If any component shows ❌ MISSING or ⚠️ INCOMPLETE:
-- Re-run the migration SQL: add_blueprint_structure_caching.sql
-- ============================================================================

