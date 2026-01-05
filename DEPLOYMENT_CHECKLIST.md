# Section-Level Caching Deployment Checklist

## Pre-Deployment

- [ ] Review all changes in this PR/commit
- [ ] Verify database migration syntax
- [ ] Check TypeScript types compile
- [ ] Review Edge Function code

## Database Migration

### Step 1: Backup Current Data

```sql
-- Create backup of current cached_blueprint_structures
CREATE TABLE cached_blueprint_structures_backup_20260105 AS
SELECT * FROM cached_blueprint_structures;

-- Verify backup
SELECT COUNT(*) FROM cached_blueprint_structures_backup_20260105;
```

### Step 2: Apply Migration

```bash
# Connect to database
psql $DATABASE_URL

# Run the refactor migration
\i supabase/migrations/refactor_section_caching_schema.sql

# Verify columns were added
\d cached_blueprint_structures
```

### Step 3: Verify Migration

```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cached_blueprint_structures'
  AND column_name IN (
    'section_title',
    'problem_statement_text',
    'problem_statement_embedding',
    'topic_summary_text',
    'topic_summary_embedding',
    'concepts_tested',
    'primary_embedding'
  );

-- Check indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'cached_blueprint_structures'
  AND indexname LIKE '%embedding%';

-- Check constraints were added
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'cached_blueprint_structures'::regclass
  AND conname LIKE 'check_%';

-- Check functions exist
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'search_similar_sections',
  'get_section_cache_details'
);

-- Check views exist
SELECT viewname 
FROM pg_views 
WHERE viewname IN (
  'section_cache_statistics',
  'section_cache_performance',
  'section_cache_inspection'
);
```

## Edge Functions Deployment

### Step 1: Deploy Updated Functions

```bash
# Deploy cache-structure (critical - creates rows)
supabase functions deploy cache-structure

# Deploy check-structure-cache (reads cache)
supabase functions deploy check-structure-cache

# Deploy orchestrate-generate-structure (orchestration)
supabase functions deploy orchestrate-generate-structure

# Verify deployments
supabase functions list
```

### Step 2: Test Individual Functions

```bash
# Test cache-structure
curl -X POST https://your-project.supabase.co/functions/v1/cache-structure \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sections_to_cache": [{
      "section_id": "Test Problem 1",
      "section_type": "problem",
      "section_embedding": [0.1, 0.2, ...],
      "embedding_source": "problem_statement",
      "cached_unit": {"unit_id": "test", "topic": "Test"},
      "original_section": {
        "section_id": "Test Problem 1",
        "section_type": "problem",
        "problem_statement": "This is a test problem",
        "concepts_tested": ["Test Concept"]
      }
    }],
    "analysis": {
      "subject_area": "Test",
      "specific_topic": "Testing",
      "document_type": "problem_set",
      "sections": []
    },
    "analysis_id": "test-123"
  }'

# Check if row was created
psql $DATABASE_URL -c "SELECT section_id, section_type, section_title FROM cached_blueprint_structures WHERE section_id = 'Test Problem 1';"
```

## Integration Testing

### Test Case 1: Generate Blueprint with Multiple Sections

```bash
# 1. Upload a test document with 3-5 sections
# 2. Generate blueprint
# 3. Check database

psql $DATABASE_URL -c "
SELECT 
  source_analysis_id,
  COUNT(*) as rows_created,
  array_agg(section_id) as section_ids
FROM cached_blueprint_structures
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY source_analysis_id;
"

# Expected: Multiple rows (one per section)
```

### Test Case 2: Verify Row Contents

```sql
-- Check the most recent cached sections
SELECT 
  section_id,
  section_type,
  section_title,
  problem_statement_text IS NOT NULL as has_problem_text,
  topic_summary_text IS NOT NULL as has_topic_text,
  primary_embedding IS NOT NULL as has_embedding,
  concepts_tested,
  jsonb_typeof(cached_unit) as cached_unit_type
FROM cached_blueprint_structures
ORDER BY created_at DESC
LIMIT 5;

-- Expected results:
-- - section_id populated
-- - section_type is 'problem' or 'topic'
-- - section_title populated
-- - For problems: has_problem_text = true, has_topic_text = false
-- - For topics: has_problem_text = false, has_topic_text = true
-- - has_embedding = true for all
-- - concepts_tested is an array with elements
-- - cached_unit_type = 'object'
```

### Test Case 3: Cache Hit on Second Generation

```bash
# 1. Generate blueprint A with 5 sections
# 2. Generate similar blueprint B with same sections
# 3. Check cache metrics

psql $DATABASE_URL -c "
SELECT * FROM section_cache_metrics
ORDER BY created_at DESC
LIMIT 2;
"

# Expected for blueprint B:
-- - cache_hit_rate > 0 (some sections cached)
-- - cached_sections > 0
-- - estimated_tokens_saved > 0
```

## Monitoring

### Dashboard Queries

```sql
-- Overall cache statistics
SELECT * FROM section_cache_statistics;

-- Performance by subject
SELECT * FROM section_cache_performance
ORDER BY total_uses DESC
LIMIT 10;

-- Recent cache activity
SELECT * FROM section_cache_inspection
ORDER BY created_at DESC
LIMIT 20;

-- Cache hit rates over time
SELECT 
  DATE(created_at) as date,
  AVG(cache_hit_rate) as avg_hit_rate,
  SUM(cached_sections) as total_cached,
  SUM(generated_sections) as total_generated,
  SUM(estimated_tokens_saved) as total_tokens_saved
FROM section_cache_metrics
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Alerts to Set Up

- [ ] Alert if cache_hit_rate drops below 20% (may indicate issues)
- [ ] Alert if no new cached sections in 24 hours (caching may be broken)
- [ ] Alert if database errors in cache-structure function
- [ ] Monitor disk usage of cached_blueprint_structures table

## Rollback Plan

If issues are detected:

### Option 1: Rollback Database Only

```sql
-- Drop new constraints
ALTER TABLE cached_blueprint_structures DROP CONSTRAINT IF EXISTS check_problem_fields;
ALTER TABLE cached_blueprint_structures DROP CONSTRAINT IF EXISTS check_topic_fields;

-- Drop new columns
ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS section_title;
ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS problem_statement_text;
ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS problem_statement_embedding;
ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS topic_summary_text;
ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS topic_summary_embedding;
ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS concepts_tested;

-- Rename primary_embedding back to section_embedding
ALTER TABLE cached_blueprint_structures RENAME COLUMN primary_embedding TO section_embedding;

-- Restore from backup if needed
-- (Only if new schema caused data loss)
```

### Option 2: Rollback Edge Functions

```bash
# Redeploy previous versions
git checkout <previous-commit>
supabase functions deploy cache-structure
supabase functions deploy check-structure-cache
supabase functions deploy orchestrate-generate-structure
```

### Option 3: Full Rollback

```bash
# 1. Rollback Edge Functions (Option 2)
# 2. Rollback Database (Option 1)
# 3. Verify system is working with old code
```

## Post-Deployment

### Week 1: Monitor Closely

- [ ] Check cache hit rates daily
- [ ] Verify row counts are increasing
- [ ] Monitor for errors in logs
- [ ] Check database disk usage
- [ ] Verify cache search performance

### Week 2: Optimize

- [ ] Analyze common concepts_tested patterns
- [ ] Adjust similarity threshold if needed
- [ ] Review quality_score trends
- [ ] Consider cleaning up unused cache entries

### Month 1: Evaluate

- [ ] Calculate total token savings
- [ ] Measure average cache hit rate
- [ ] Identify most reused sections
- [ ] Plan for cache warming strategies

## Success Criteria

✅ **Database Migration:**
- All new columns created
- All indexes created
- All constraints added
- All functions and views created

✅ **Edge Functions:**
- All functions deployed successfully
- No errors in function logs
- Test requests return expected results

✅ **Integration:**
- Multiple rows created per blueprint generation
- Each row has correct section_id and section_type
- Problem sections have problem_statement_text populated
- Topic sections have topic_summary_text populated
- All rows have embeddings and cached_unit

✅ **Performance:**
- Cache hit rate > 0% on second similar blueprint
- Token savings visible in metrics
- No significant performance degradation
- Database queries remain fast (<100ms)

## Contacts

- **Database Issues:** DBA team
- **Edge Function Issues:** Backend team
- **Performance Issues:** DevOps team
- **Product Questions:** Product team

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Verified By:** _____________  
**Status:** ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back

