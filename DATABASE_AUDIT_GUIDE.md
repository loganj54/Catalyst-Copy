# Database Audit & Cleanup Guide

## Current Database Overview

Your database has grown significantly with many caching and optimization features. Here's what you have:

### 📊 Core Tables (ESSENTIAL - DO NOT DELETE)

These are the fundamental tables your app needs to function:

1. **users** - User profiles and authentication
   - Referenced by: Everything
   - Status: ✅ ESSENTIAL

2. **classes** - User's classes (e.g., "Calculus I")
   - Referenced by: blueprints, class_documents
   - Status: ✅ ESSENTIAL

3. **blueprints** - Learning plans/blueprints created by users
   - References: classes, users, class_documents
   - Status: ✅ ESSENTIAL

4. **class_documents** - Uploaded documents (PDFs, etc.)
   - References: classes, users
   - Status: ✅ ESSENTIAL

### 📄 Document Processing Pipeline (IMPORTANT)

These tables handle document analysis and structure generation:

5. **document_analyses** - AI analysis of uploaded documents
   - References: class_documents, users
   - Used by: Backend to avoid re-analyzing same document
   - Status: ✅ KEEP (prevents re-analysis of same doc)

6. **blueprint_structures** (formerly learning_structures) - Generated learning structures
   - References: blueprints, document_analyses, class_documents, users
   - Used by: Your Blueprint.jsx page to display content
   - Status: ✅ KEEP (stores generated learning paths)

### 🎯 Learning Content Tables (ACTIVE FEATURES)

7. **topic_responses** - Tracks if user is "comfortable" or "needs help" with topics
   - References: blueprints, users
   - Used in: Blueprint.jsx (comfort buttons)
   - Status: ✅ KEEP

8. **curated_resources** - Cache of educational videos/articles
   - Used by: Resource recommendation system
   - Status: ✅ KEEP (saves API calls, improves speed)

9. **blueprint_topic_resources** - Links blueprints to resources
   - References: blueprints, curated_resources
   - Used in: Blueprint.jsx (displays recommended resources)
   - Status: ✅ KEEP

10. **curated_equations** - Cache of LaTeX equations
    - Used by: Equation display system
    - Status: ✅ KEEP (reusable equation library)

11. **blueprint_unit_equations** - Links equations to learning units
    - References: blueprints, curated_equations
    - Used in: Blueprint.jsx (EquationDisplay component)
    - Status: ✅ KEEP

12. **curated_figures** - Cache of diagrams/charts/figures
    - Used by: Figure display system
    - Status: ✅ KEEP (reusable figure library)

13. **blueprint_unit_figures** - Links figures to learning units
    - References: blueprints, curated_figures
    - Used in: Blueprint.jsx (FigureDisplay component)
    - Status: ✅ KEEP

### 🚀 Performance Caching Tables (OPTIMIZATION)

These tables improve performance and reduce AI costs:

14. **cached_blueprint_structures** - Caches entire document structures
    - Purpose: Reuse learning structures for similar documents
    - Token Savings: ~10,000-15,000 tokens per cache hit
    - Status: ⚠️ OPTIONAL (improves performance but not required)

15. **cached_section_structures** - Caches individual problem/section structures
    - Purpose: Granular caching at problem level
    - Token Savings: ~3,000 tokens per section
    - Status: ⚠️ OPTIONAL (improves performance but not required)

---

## 🔍 How to Review Your Database

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Click on **"Table Editor"** in the left sidebar
3. You'll see a list of all tables

**Look for:**
- 🔴 **Red "unrestricted" notifications** = No Row Level Security (RLS) policies
  - This is **OK** for cache tables (curated_resources, curated_equations, curated_figures)
  - These are meant to be public/shared across users
  - **NOT OK** for user data tables (users, classes, blueprints, class_documents)

- **Empty tables** = Click on each table and check if it has any rows
  - Empty cache tables are normal initially
  - Empty core tables suggest the feature isn't being used

### Option 2: SQL Query to Check Table Sizes

Run this in the Supabase SQL Editor:

```sql
-- Check table sizes and row counts
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    (SELECT count(*) FROM information_schema.tables WHERE table_name = tablename) as table_exists
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

Run this to count rows in each table:

```sql
-- Count rows in each table
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'classes', COUNT(*) FROM classes
UNION ALL
SELECT 'blueprints', COUNT(*) FROM blueprints
UNION ALL
SELECT 'class_documents', COUNT(*) FROM class_documents
UNION ALL
SELECT 'document_analyses', COUNT(*) FROM document_analyses
UNION ALL
SELECT 'blueprint_structures', COUNT(*) FROM blueprint_structures
UNION ALL
SELECT 'topic_responses', COUNT(*) FROM topic_responses
UNION ALL
SELECT 'curated_resources', COUNT(*) FROM curated_resources
UNION ALL
SELECT 'blueprint_topic_resources', COUNT(*) FROM blueprint_topic_resources
UNION ALL
SELECT 'curated_equations', COUNT(*) FROM curated_equations
UNION ALL
SELECT 'blueprint_unit_equations', COUNT(*) FROM blueprint_unit_equations
UNION ALL
SELECT 'curated_figures', COUNT(*) FROM curated_figures
UNION ALL
SELECT 'blueprint_unit_figures', COUNT(*) FROM blueprint_unit_figures
UNION ALL
SELECT 'cached_blueprint_structures', COUNT(*) FROM cached_blueprint_structures
UNION ALL
SELECT 'cached_section_structures', COUNT(*) FROM cached_section_structures
ORDER BY row_count DESC;
```

---

## 🧹 Cleanup Recommendations

### Tables You Can SAFELY DELETE (if you want simpler database)

If you want to simplify and don't care about performance optimizations:

```sql
-- OPTIONAL: Remove caching tables (will increase AI costs but simplify database)
DROP TABLE IF EXISTS cached_section_structures CASCADE;
DROP TABLE IF EXISTS cached_blueprint_structures CASCADE;

-- This will also drop the associated views and functions:
DROP VIEW IF EXISTS section_cache_statistics CASCADE;
DROP VIEW IF EXISTS section_cache_performance_by_subject CASCADE;
DROP VIEW IF EXISTS most_valuable_cached_sections CASCADE;
DROP VIEW IF EXISTS cache_statistics CASCADE;
DROP VIEW IF EXISTS cache_performance_by_subject CASCADE;
DROP FUNCTION IF EXISTS search_similar_section_structures CASCADE;
DROP FUNCTION IF EXISTS increment_section_cache_usage CASCADE;
DROP FUNCTION IF EXISTS update_section_cache_quality CASCADE;
DROP FUNCTION IF EXISTS search_similar_blueprint_structures CASCADE;
DROP FUNCTION IF EXISTS increment_cache_usage CASCADE;
DROP FUNCTION IF EXISTS update_cache_quality CASCADE;
```

**Impact:**
- ✅ Simpler database
- ✅ Easier to understand
- ❌ Higher OpenAI API costs (no structure reuse)
- ❌ Slower blueprint generation

### Tables You Should NEVER DELETE

**DO NOT DELETE these or your app will break:**
- users
- classes
- blueprints
- class_documents
- document_analyses
- blueprint_structures
- topic_responses
- curated_resources
- blueprint_topic_resources
- curated_equations
- blueprint_unit_equations
- curated_figures
- blueprint_unit_figures

---

## 🔒 Fixing Row Level Security (RLS) Issues

If you see red "unrestricted" warnings in Supabase, here's what to do:

### Check RLS Status

```sql
-- Check which tables have RLS enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check RLS Policies

```sql
-- View all RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Expected RLS Setup

**User-owned data** (should have RLS with user_id checks):
- users, classes, blueprints, class_documents
- document_analyses, blueprint_structures, topic_responses

**Shared/public data** (should have RLS with public read access):
- curated_resources, curated_equations, curated_figures
- cached_blueprint_structures, cached_section_structures

**Junction tables** (should have RLS checking parent table ownership):
- blueprint_topic_resources, blueprint_unit_equations, blueprint_unit_figures

---

## 📊 Recommended Actions

### 1. For Beginners / Development
Keep everything simple:
```sql
-- Only keep core tables, remove optimizations
-- Run the "Tables You Can SAFELY DELETE" section above
```

### 2. For Production / Cost Optimization
Keep everything - the caching saves money and improves performance.

### 3. Immediate Actions
1. ✅ Check table row counts (see if they're actually being used)
2. ✅ Verify RLS policies are set up correctly
3. ✅ Remove any tables you don't recognize or weren't in my list above
4. ✅ Make sure storage buckets are set up:
   - `class-documents` bucket for uploaded files
   - `figures-library` bucket for cached figures (if using figures feature)

---

## 🛠️ Verification Queries

After cleanup, run these to verify your database is healthy:

```sql
-- Check for orphaned records (records pointing to deleted parents)
SELECT 'blueprints without classes' as issue, COUNT(*) as count
FROM blueprints b
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = b.class_id)
UNION ALL
SELECT 'class_documents without classes', COUNT(*)
FROM class_documents cd
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = cd.class_id)
UNION ALL
SELECT 'document_analyses without documents', COUNT(*)
FROM document_analyses da
WHERE document_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM class_documents cd WHERE cd.id = da.document_id);
```

```sql
-- Check for missing RLS policies on sensitive tables
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename IN ('users', 'classes', 'blueprints', 'class_documents', 
                    'document_analyses', 'blueprint_structures', 'topic_responses');
```

---

## 📈 Understanding Your Data Flow

```
User uploads document → class_documents
                      ↓
        document_analyses (AI analyzes it)
                      ↓
        blueprint_structures (generates learning path)
                      ↓
        blueprint (user-facing learning plan)
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
topic_responses  equations    figures
        ↓             ↓             ↓
    resources    curated_equations  curated_figures
```

---

## Need Help?

If you're unsure about a table:
1. Search for it in your code: `grep -r "table_name" src/`
2. Check if it's referenced in migration files
3. If no references found → probably safe to delete
4. If in doubt → keep it (storage is cheap, broken apps are expensive)

