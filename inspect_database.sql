-- ============================================================================
-- DATABASE INSPECTION SCRIPT
-- ============================================================================
-- Run this in your Supabase SQL Editor to see what's in your database
-- ============================================================================

-- 1. TABLE ROW COUNTS
-- Shows how many records are in each table
-- ============================================================================
SELECT '=== TABLE ROW COUNTS ===' as section;

SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL SELECT 'classes', COUNT(*) FROM classes
UNION ALL SELECT 'blueprints', COUNT(*) FROM blueprints
UNION ALL SELECT 'class_documents', COUNT(*) FROM class_documents
UNION ALL SELECT 'document_analyses', COUNT(*) FROM document_analyses
UNION ALL SELECT 'blueprint_structures', COUNT(*) FROM blueprint_structures
UNION ALL SELECT 'topic_responses', COUNT(*) FROM topic_responses
UNION ALL SELECT 'curated_resources', COUNT(*) FROM curated_resources
UNION ALL SELECT 'blueprint_topic_resources', COUNT(*) FROM blueprint_topic_resources
UNION ALL SELECT 'curated_equations', COUNT(*) FROM curated_equations
UNION ALL SELECT 'blueprint_unit_equations', COUNT(*) FROM blueprint_unit_equations
UNION ALL SELECT 'curated_figures', COUNT(*) FROM curated_figures
UNION ALL SELECT 'blueprint_unit_figures', COUNT(*) FROM blueprint_unit_figures
UNION ALL SELECT 'cached_blueprint_structures', COUNT(*) FROM cached_blueprint_structures
UNION ALL SELECT 'cached_section_structures', COUNT(*) FROM cached_section_structures
ORDER BY row_count DESC;

-- ============================================================================
-- 2. TABLE SIZES
-- Shows disk space used by each table
-- ============================================================================
SELECT '=== TABLE SIZES ===' as section;

SELECT 
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- ============================================================================
-- 3. ROW LEVEL SECURITY STATUS
-- Shows which tables have RLS enabled
-- ============================================================================
SELECT '=== ROW LEVEL SECURITY STATUS ===' as section;

SELECT 
    tablename as table_name,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 4. RLS POLICIES
-- Shows what policies are active on each table
-- ============================================================================
SELECT '=== RLS POLICIES ===' as section;

SELECT 
    tablename as table_name,
    policyname as policy_name,
    cmd as operation,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN '✅ Permissive'
        ELSE '⚠️ Restrictive'
    END as type
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 5. STORAGE BUCKETS
-- Shows what storage buckets exist
-- ============================================================================
SELECT '=== STORAGE BUCKETS ===' as section;

SELECT 
    id as bucket_name,
    CASE 
        WHEN public THEN '✅ Public'
        ELSE '🔒 Private'
    END as access_level,
    created_at
FROM storage.buckets
ORDER BY created_at;

-- ============================================================================
-- 6. CACHE EFFECTIVENESS
-- Shows how well the caching systems are working
-- ============================================================================
SELECT '=== CACHE STATISTICS ===' as section;

-- Blueprint-level cache stats
SELECT 
    'Blueprint Cache' as cache_type,
    COUNT(*) as total_cached,
    SUM(times_used) as total_uses,
    ROUND(AVG(times_used), 2) as avg_uses_per_cache,
    ROUND(AVG(quality_score), 2) as avg_quality,
    SUM(times_used) * 12000 as estimated_tokens_saved
FROM cached_blueprint_structures
WHERE EXISTS (SELECT 1 FROM cached_blueprint_structures LIMIT 1)
UNION ALL
-- Section-level cache stats
SELECT 
    'Section Cache' as cache_type,
    COUNT(*) as total_cached,
    SUM(times_used) as total_uses,
    ROUND(AVG(times_used), 2) as avg_uses_per_cache,
    ROUND(AVG(quality_score), 2) as avg_quality,
    SUM(times_used) * 3000 as estimated_tokens_saved
FROM cached_section_structures
WHERE EXISTS (SELECT 1 FROM cached_section_structures LIMIT 1);

-- ============================================================================
-- 7. RESOURCE LIBRARY STATS
-- Shows how many resources, equations, and figures are cached
-- ============================================================================
SELECT '=== RESOURCE LIBRARY STATS ===' as section;

SELECT 
    'Videos/Articles' as resource_type,
    COUNT(*) as total_items,
    SUM(times_served) as total_uses,
    COUNT(DISTINCT platform) as unique_platforms
FROM curated_resources
UNION ALL
SELECT 
    'Equations',
    COUNT(*),
    SUM(times_used),
    COUNT(DISTINCT subject_area)
FROM curated_equations
UNION ALL
SELECT 
    'Figures/Diagrams',
    COUNT(*),
    SUM(times_used),
    COUNT(DISTINCT subject_area)
FROM curated_figures;

-- ============================================================================
-- 8. USER ACTIVITY SUMMARY
-- Shows how active users are
-- ============================================================================
SELECT '=== USER ACTIVITY SUMMARY ===' as section;

SELECT 
    u.id as user_id,
    u.full_name,
    (SELECT COUNT(*) FROM classes WHERE user_id = u.id) as total_classes,
    (SELECT COUNT(*) FROM blueprints WHERE user_id = u.id) as total_blueprints,
    (SELECT COUNT(*) FROM class_documents WHERE user_id = u.id) as total_documents,
    (SELECT MAX(created_at) FROM blueprints WHERE user_id = u.id) as last_blueprint_created
FROM users u
ORDER BY total_blueprints DESC;

-- ============================================================================
-- 9. ORPHANED RECORDS CHECK
-- Looks for data integrity issues
-- ============================================================================
SELECT '=== ORPHANED RECORDS CHECK ===' as section;

SELECT 'Blueprints without classes' as issue, COUNT(*) as count
FROM blueprints b
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = b.class_id)
UNION ALL
SELECT 'Class documents without classes', COUNT(*)
FROM class_documents cd
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = cd.class_id)
UNION ALL
SELECT 'Document analyses without documents', COUNT(*)
FROM document_analyses da
WHERE document_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM class_documents cd WHERE cd.id = da.document_id)
UNION ALL
SELECT 'Blueprint structures without blueprints', COUNT(*)
FROM blueprint_structures bs
WHERE NOT EXISTS (SELECT 1 FROM blueprints b WHERE b.id = bs.blueprint_id)
UNION ALL
SELECT 'Topic responses without blueprints', COUNT(*)
FROM topic_responses tr
WHERE NOT EXISTS (SELECT 1 FROM blueprints b WHERE b.id = tr.blueprint_id);

-- ============================================================================
-- 10. RECENT ACTIVITY
-- Shows what's been happening recently
-- ============================================================================
SELECT '=== RECENT ACTIVITY (Last 7 days) ===' as section;

SELECT 
    'Classes created' as activity,
    COUNT(*) as count,
    MAX(created_at) as most_recent
FROM classes
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Blueprints created',
    COUNT(*),
    MAX(created_at)
FROM blueprints
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Documents uploaded',
    COUNT(*),
    MAX(created_at)
FROM class_documents
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Documents analyzed',
    COUNT(*),
    MAX(created_at)
FROM document_analyses
WHERE created_at > NOW() - INTERVAL '7 days';

-- ============================================================================
-- DONE!
-- ============================================================================

