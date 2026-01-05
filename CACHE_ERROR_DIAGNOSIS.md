# Cache Error Diagnosis

## Error Message
```
[cache] Error storing structure in cache: {
  code: "PGRST204",
  details: null,
  hint: null,
  message: "Could not find the 'characteristics_embedding' column of 'cached_blueprint_structures' in the schema cache"
}
```

## Root Cause

The error indicates that **some code is still trying to insert into the old `characteristics_embedding` column** which was removed in the database migration.

## Possible Sources

### 1. Old Edge Functions Still Deployed

The most likely cause is that **old Edge Functions are still deployed** and haven't been updated with the new code.

**Solution:**
```bash
# Redeploy all updated functions
supabase functions deploy cache-structure
supabase functions deploy check-structure-cache
supabase functions deploy orchestrate-generate-structure
supabase functions deploy generate-structure-mixed
```

### 2. Legacy Functions Being Called

Check if the frontend or orchestration is calling old function names:
- `generate-structure-legacy` - OLD, should not be used
- Old `structure-cache.ts` helper functions

**Solution:**
- Ensure frontend calls `orchestrate-generate-structure` (not legacy versions)
- Check that no code imports from `_shared/structure-cache.ts` or `_shared/section-cache.ts`

### 3. Database Schema Cache

PostgREST (Supabase's API layer) caches the database schema. After running migrations, the cache might be stale.

**Solution:**
```bash
# Reload PostgREST schema cache
curl -X POST https://your-project.supabase.co/rest/v1/rpc/reload_schema \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"

# OR restart the Supabase services
# (In Supabase dashboard: Settings > API > Reload schema)
```

## Verification Steps

### Step 1: Check Database Schema

```sql
-- Verify the column does NOT exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cached_blueprint_structures'
  AND column_name = 'characteristics_embedding';

-- Should return 0 rows

-- Verify new columns DO exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cached_blueprint_structures'
  AND column_name IN (
    'section_title',
    'problem_statement_text',
    'problem_statement_embedding',
    'topic_summary_text',
    'topic_summary_embedding',
    'primary_embedding'
  );

-- Should return 6 rows
```

### Step 2: Check Deployed Functions

```bash
# List deployed functions
supabase functions list

# Check when they were last deployed
# If cache-structure was deployed before the migration, that's the problem
```

### Step 3: Test Direct API Call

```bash
# Test the cache-structure function directly
curl -X POST https://your-project.supabase.co/functions/v1/cache-structure \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sections_to_cache": [],
    "analysis": {
      "subject_area": "Test",
      "specific_topic": "Test",
      "document_type": "problem_set",
      "sections": []
    },
    "analysis_id": "test"
  }'

# Should return: {"cached_sections": 0, "cache_ids": [], ...}
# Should NOT error about characteristics_embedding
```

## Fix Procedure

### Option 1: Redeploy Functions (Recommended)

```bash
# 1. Ensure you're on the latest code
git pull

# 2. Deploy updated functions
supabase functions deploy cache-structure
supabase functions deploy check-structure-cache  
supabase functions deploy orchestrate-generate-structure
supabase functions deploy generate-structure-mixed

# 3. Reload schema cache
# Go to Supabase Dashboard > Settings > API > Reload schema

# 4. Test
# Generate a new blueprint and check for errors
```

### Option 2: Temporarily Add Column Back (Not Recommended)

If you need a quick fix while deploying:

```sql
-- TEMPORARY: Add the column back as NULL
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS characteristics_embedding VECTOR(1536);

-- This allows old code to run without errors
-- But you should still deploy the new functions ASAP
```

Then after deploying new functions:

```sql
-- Remove the temporary column
ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS characteristics_embedding;
```

## Prevention

1. **Always deploy functions after database migrations**
2. **Test in staging first**
3. **Use feature flags for major changes**
4. **Monitor error logs after deployments**

## Verification After Fix

```bash
# 1. Generate a test blueprint
# 2. Check logs for cache-related messages
# 3. Query database to see if rows were created

psql $DATABASE_URL -c "
SELECT 
  section_id,
  section_type,
  section_title,
  created_at
FROM cached_blueprint_structures
ORDER BY created_at DESC
LIMIT 5;
"

# Should see new rows with section-level data
```

## Related Files

- `supabase/functions/cache-structure/index.ts` - Updated cache function
- `supabase/migrations/complete_section_caching_setup.sql` - Database migration
- `supabase/functions/_shared/section-embeddings.ts` - New embedding logic
- `SECTION_LEVEL_CACHING.md` - Full documentation

---

**Most Likely Fix:** Redeploy the Edge Functions after running the database migration.

