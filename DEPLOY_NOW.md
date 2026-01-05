# Deploy These Functions NOW

## Problem
The error `"Could not find the 'characteristics_embedding' column"` is caused by old Edge Functions trying to use the old database schema.

## Solution
Deploy the updated Edge Functions that work with the new schema.

## Commands to Run

```bash
# 1. Deploy the NEW/UPDATED functions
supabase functions deploy fetch-analysis
supabase functions deploy check-structure-cache
supabase functions deploy generate-structure-mixed
supabase functions deploy cache-structure
supabase functions deploy store-structure
supabase functions deploy orchestrate-generate-structure

# 2. Deploy the DEPRECATED function (returns error message)
supabase functions deploy generate-structure-legacy

# 3. Verify deployments
supabase functions list
```

## What Each Function Does

### ✅ NEW Functions (deploy these)

1. **fetch-analysis** - Fetches document analysis from database
2. **check-structure-cache** - Checks cache for each section individually
3. **generate-structure-mixed** - Generates only cache-missed sections
4. **cache-structure** - Stores newly generated sections (ONE ROW PER SECTION)
5. **store-structure** - Stores complete structure with cache metadata
6. **orchestrate-generate-structure** - Main orchestration with section-level caching

### ⚠️ DEPRECATED Functions (disabled)

1. **generate-structure-legacy** - Returns 410 Gone error with migration message

## After Deployment

### Test It Works

```bash
# Generate a test blueprint
# The logs should show:
# - "Checking cache for section: Problem 1"
# - "Checking cache for section: Problem 2"
# - etc.

# Check database
psql $DATABASE_URL -c "
SELECT 
  section_id,
  section_type,
  section_title,
  problem_statement_text IS NOT NULL as has_problem_text,
  topic_summary_text IS NOT NULL as has_topic_text,
  created_at
FROM cached_blueprint_structures
ORDER BY created_at DESC
LIMIT 5;
"
```

### Expected Results

✅ **Multiple rows** created (one per section)  
✅ **No errors** about `characteristics_embedding`  
✅ **Section details** populated (problem_statement_text OR topic_summary_text)  
✅ **Cache hits** on second similar blueprint  

## Troubleshooting

### If you still see the error:

1. **Reload schema cache**
   - Go to Supabase Dashboard
   - Settings → API → "Reload schema"

2. **Check function logs**
   ```bash
   supabase functions logs orchestrate-generate-structure
   ```

3. **Verify database schema**
   ```sql
   -- Should return 0 rows (column removed)
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'cached_blueprint_structures' 
   AND column_name = 'characteristics_embedding';
   
   -- Should return 6 rows (new columns added)
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'cached_blueprint_structures' 
   AND column_name IN (
     'section_title', 'problem_statement_text', 
     'problem_statement_embedding', 'topic_summary_text',
     'topic_summary_embedding', 'primary_embedding'
   );
   ```

## Files Changed

- ✅ `supabase/functions/fetch-analysis/index.ts` - CREATED
- ✅ `supabase/functions/check-structure-cache/index.ts` - UPDATED
- ✅ `supabase/functions/generate-structure-mixed/index.ts` - CREATED
- ✅ `supabase/functions/cache-structure/index.ts` - UPDATED (creates one row per section)
- ✅ `supabase/functions/store-structure/index.ts` - UPDATED
- ✅ `supabase/functions/orchestrate-generate-structure/index.ts` - UPDATED
- ✅ `supabase/functions/generate-structure-legacy/index.ts` - DEPRECATED
- ✅ `supabase/functions/_shared/structure-cache.ts` - DISABLED
- ✅ `supabase/functions/_shared/section-cache.ts` - DISABLED
- ✅ `supabase/functions/_shared/section-embeddings.ts` - CREATED
- ✅ `supabase/functions/_shared/types.ts` - UPDATED

## Quick Verification

After deployment, this should work:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/orchestrate-generate-structure \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"blueprint_id": "your-blueprint-id"}'
```

Expected response:
```json
{
  "structure": {...},
  "structure_id": "uuid",
  "from_cache": false,
  "metadata": {
    "total_time_ms": 15000,
    "cache_hit_rate": 0,
    "cached_sections": 0,
    "generated_sections": 5
  }
}
```

---

**Status:** Ready to Deploy  
**Priority:** HIGH - Blocks blueprint generation  
**Estimated Time:** 5 minutes

