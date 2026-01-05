# Deploy Updated generate-structure-legacy Function

## What Changed

The `generate-structure-legacy` function has been updated to use the NEW section-level caching system instead of the old full-structure caching.

### Key Changes:

1. **Removed old imports** - No longer imports deprecated `structure-cache.ts`
2. **Added new imports** - Now uses `section-embeddings.ts` for section-level caching
3. **Updated cache check** - Checks cache for each section individually
4. **Updated cache storage** - Stores ONE ROW PER SECTION in database

## Deploy Command

```bash
supabase functions deploy generate-structure-legacy
```

That's it! Just deploy this one function.

## What It Does Now

### Before (OLD - caused error):
```
1. Check cache for entire structure (using characteristics_embedding) ❌
2. Generate full structure
3. Cache as one big blob ❌
```

### After (NEW - works with new schema):
```
1. Check cache for EACH SECTION individually ✅
2. Generate full structure (for now - optimization later)
3. Cache EACH SECTION as separate row ✅
```

## Expected Behavior

### First Blueprint Generation:
```
[generate-structure] CHECKING SECTION-LEVEL CACHE
[generate-structure] Generated embeddings for 5 sections
[generate-structure] ❌ CACHE MISS for Problem 1
[generate-structure] ❌ CACHE MISS for Problem 2
[generate-structure] ❌ CACHE MISS for Problem 3
[generate-structure] ❌ CACHE MISS for Problem 4
[generate-structure] ❌ CACHE MISS for Problem 5
[generate-structure] Cache hit rate: 0.0% (0/5 sections)
[generate-structure] Generating structure with Claude...
[generate-structure] Caching sections individually for future reuse...
[generate-structure] ✅ Cached section: Problem 1
[generate-structure] ✅ Cached section: Problem 2
[generate-structure] ✅ Cached section: Problem 3
[generate-structure] ✅ Cached section: Problem 4
[generate-structure] ✅ Cached section: Problem 5
[generate-structure] Successfully cached 5/5 sections
```

### Second Similar Blueprint:
```
[generate-structure] CHECKING SECTION-LEVEL CACHE
[generate-structure] Generated embeddings for 5 sections
[generate-structure] ✅ CACHE HIT for Problem 1! Similarity: 96.2%
[generate-structure] ✅ CACHE HIT for Problem 2! Similarity: 95.8%
[generate-structure] ❌ CACHE MISS for Problem 3
[generate-structure] ✅ CACHE HIT for Problem 4! Similarity: 97.1%
[generate-structure] ❌ CACHE MISS for Problem 5
[generate-structure] Cache hit rate: 60.0% (3/5 sections)
[generate-structure] ⚠️  Some sections cached, but generating full structure for consistency
[generate-structure]   - Token savings estimate: ~3000 tokens
```

## Verify It Works

### 1. Check Database After Generation

```sql
SELECT 
  section_id,
  section_type,
  section_title,
  CASE 
    WHEN section_type = 'problem' THEN substring(problem_statement_text, 1, 50)
    WHEN section_type = 'topic' THEN substring(topic_summary_text, 1, 50)
  END as content_preview,
  concepts_tested,
  times_used,
  created_at
FROM cached_blueprint_structures
ORDER BY created_at DESC
LIMIT 10;
```

Expected: **Multiple rows** (one per section), not one big row.

### 2. Check for Errors

```bash
supabase functions logs generate-structure-legacy --tail
```

Should NOT see: `"Could not find the 'characteristics_embedding' column"`

## Future Optimization

Currently, the function still generates the FULL structure even with cache hits (for consistency).

**Future improvement:** Only generate cache-missed sections and combine with cached ones.

For now, we're getting:
- ✅ Proper section-level caching (one row per section)
- ✅ Cache hit detection per section
- ✅ Token savings tracking
- ⚠️  Still generating full structure (but caching works!)

## Troubleshooting

### If you still see the error:

1. **Make sure migration ran:**
   ```sql
   -- Should return 0 (column removed)
   SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'cached_blueprint_structures' 
   AND column_name = 'characteristics_embedding';
   ```

2. **Reload schema cache:**
   - Supabase Dashboard → Settings → API → "Reload schema"

3. **Check function deployed:**
   ```bash
   supabase functions list | grep generate-structure-legacy
   ```

---

**Status:** Ready to Deploy  
**Command:** `supabase functions deploy generate-structure-legacy`  
**Time:** 1 minute

