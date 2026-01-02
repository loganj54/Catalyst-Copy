-- ============================================================================
-- ROW LEVEL SECURITY (RLS) AUDIT AND FIX SCRIPT
-- ============================================================================
-- This script helps you identify and fix the red "unrestricted" warnings
-- in Supabase dashboard
-- ============================================================================

-- ============================================================================
-- PART 1: AUDIT - What's the current state?
-- ============================================================================

SELECT '=== RLS STATUS AUDIT ===' as section;

-- Check which tables have RLS enabled
SELECT 
    t.tablename,
    CASE 
        WHEN t.rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled (UNRESTRICTED)'
    END as rls_status,
    COUNT(p.policyname) as policy_count,
    CASE
        WHEN COUNT(p.policyname) = 0 AND t.rowsecurity THEN '⚠️ RLS on but NO POLICIES'
        WHEN COUNT(p.policyname) = 0 AND NOT t.rowsecurity THEN '🔴 COMPLETELY UNRESTRICTED'
        ELSE '✅ Has policies'
    END as policy_status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.rowsecurity ASC, policy_count ASC;

-- ============================================================================
-- PART 2: VIEW ALL EXISTING POLICIES
-- ============================================================================

SELECT '=== EXISTING RLS POLICIES ===' as section;

SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_check,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_status
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- ============================================================================
-- PART 3: VERIFY EXPECTED RLS SETUP
-- ============================================================================

SELECT '=== TABLES THAT SHOULD BE RESTRICTED TO OWNERS ===' as section;

-- These tables should have RLS enabled AND policies that check user_id = auth.uid()
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ MISSING RLS'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'classes', 'blueprints', 'class_documents', 
                    'document_analyses', 'blueprint_structures', 'topic_responses')
ORDER BY tablename;

SELECT '=== TABLES THAT SHOULD BE PUBLIC READ ===' as section;

-- These tables should have RLS enabled AND policies that allow public SELECT
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ MISSING RLS'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('curated_resources', 'curated_equations', 'curated_figures',
                    'cached_blueprint_structures', 'cached_section_structures')
ORDER BY tablename;

SELECT '=== JUNCTION TABLES (SHOULD CHECK PARENT OWNERSHIP) ===' as section;

SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ MISSING RLS'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('blueprint_topic_resources', 'blueprint_unit_equations', 
                    'blueprint_unit_figures')
ORDER BY tablename;

-- ============================================================================
-- PART 4: FIX SCRIPT (Uncomment to apply fixes)
-- ============================================================================
-- ⚠️ Only uncomment and run if you want to apply the fixes!
-- ============================================================================

/*

-- ----------------------------------------------------------------------------
-- FIX 1: Enable RLS on all public tables if not already enabled
-- ----------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_topic_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_equations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_unit_equations ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_figures ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_unit_figures ENABLE ROW LEVEL SECURITY;

SELECT '✅ RLS enabled on all tables' as status;

-- ----------------------------------------------------------------------------
-- FIX 2: Verify core table policies exist (they should from migrations)
-- ----------------------------------------------------------------------------

-- If any of these fail, it means policies are missing!
-- Check your migration files to re-run them

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can update own profile.'
    ) THEN
        RAISE NOTICE '⚠️ Missing policy on users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'classes' 
        AND policyname = 'Users can view their own classes.'
    ) THEN
        RAISE NOTICE '⚠️ Missing policy on classes table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'blueprints' 
        AND policyname = 'Users can view their own blueprints.'
    ) THEN
        RAISE NOTICE '⚠️ Missing policy on blueprints table';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- FIX 3: If policies are missing, here's how to recreate them
-- ----------------------------------------------------------------------------

-- USERS table policies
DROP POLICY IF EXISTS "Public users are viewable by everyone." ON users;
DROP POLICY IF EXISTS "Users can insert their own profile." ON users;
DROP POLICY IF EXISTS "Users can update own profile." ON users;

CREATE POLICY "Public users are viewable by everyone." ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON users
  FOR UPDATE USING (auth.uid() = id);

-- CLASSES table policies
DROP POLICY IF EXISTS "Users can view their own classes." ON classes;
DROP POLICY IF EXISTS "Users can create their own classes." ON classes;
DROP POLICY IF EXISTS "Users can update their own classes." ON classes;
DROP POLICY IF EXISTS "Users can delete their own classes." ON classes;

CREATE POLICY "Users can view their own classes." ON classes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own classes." ON classes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own classes." ON classes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own classes." ON classes
  FOR DELETE USING (auth.uid() = user_id);

-- BLUEPRINTS table policies  
DROP POLICY IF EXISTS "Users can view their own blueprints." ON blueprints;
DROP POLICY IF EXISTS "Users can create their own blueprints." ON blueprints;
DROP POLICY IF EXISTS "Users can update their own blueprints." ON blueprints;
DROP POLICY IF EXISTS "Users can delete their own blueprints." ON blueprints;

CREATE POLICY "Users can view their own blueprints." ON blueprints
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own blueprints." ON blueprints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blueprints." ON blueprints
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blueprints." ON blueprints
  FOR DELETE USING (auth.uid() = user_id);

-- CLASS_DOCUMENTS table policies
DROP POLICY IF EXISTS "Users can view their own class documents" ON class_documents;
DROP POLICY IF EXISTS "Users can create their own class documents" ON class_documents;
DROP POLICY IF EXISTS "Users can update their own class documents" ON class_documents;
DROP POLICY IF EXISTS "Users can delete their own class documents" ON class_documents;

CREATE POLICY "Users can view their own class documents" ON class_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own class documents" ON class_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own class documents" ON class_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own class documents" ON class_documents
  FOR DELETE USING (auth.uid() = user_id);

SELECT '✅ Core table policies created' as status;

*/

-- ============================================================================
-- PART 5: FINAL VERIFICATION
-- ============================================================================

SELECT '=== FINAL VERIFICATION ===' as section;

-- Should have 0 rows (no unrestricted tables)
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false;
-- Expected: 0 rows if all fixed

-- Should have policies on all tables
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

SELECT '=== AUDIT COMPLETE ===' as section;

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
-- 
-- ❌ RLS Disabled = Red "unrestricted" warning in Supabase
-- ✅ RLS Enabled + Policies = Properly secured
-- ⚠️ RLS Enabled + No Policies = Still unrestricted (no one can access!)
--
-- User Data Tables (MUST be restricted to user_id):
--   - users, classes, blueprints, class_documents
--   - document_analyses, blueprint_structures, topic_responses
--
-- Global Cache Tables (Public read, service role write):
--   - curated_resources, curated_equations, curated_figures
--   - cached_blueprint_structures, cached_section_structures
--
-- Junction Tables (Check parent table ownership):
--   - blueprint_topic_resources (check blueprint ownership)
--   - blueprint_unit_equations (check blueprint ownership)
--   - blueprint_unit_figures (check blueprint ownership)
--
-- ============================================================================

