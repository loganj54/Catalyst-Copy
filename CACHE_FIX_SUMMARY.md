# Cache Cross-Contamination Fix - Summary

## Issue Reported

When duplicating blueprints, the caching system returned cached data from the **wrong homework**:

1. ✅ Created blueprint on HW 9 (Heat Exchangers) - worked perfectly
2. ✅ Created blueprint on HW 10 (Radiation) - worked perfectly
3. ✅ Duplicated HW 9 - got heat exchanger cache (correct)
4. ❌ Duplicated HW 10 - got **heat exchanger** cache instead of radiation!

## Root Cause

The cache query matched sections by `section_id` alone:
- Both HW 9 and HW 10 have a "Problem 3"
- Query returned both, code picked the first one
- First one happened to be from HW 9 (heat exchangers)
- Wrong data returned for HW 10 (radiation)

## Solution

**Use `source_blueprint_id` as the unique key** instead of text matching.

### Changes Made:

1. **Store blueprint_id when caching** (`generate-structure-legacy/index.ts`)
   ```typescript
   source_blueprint_id: blueprint_id  // Links cache to source blueprint
   ```

2. **Query by blueprint_id + section_id** (`_shared/section-embeddings.ts`)
   ```typescript
   .or('and(source_blueprint_id.eq.{id},section_id.eq.{section})')
   ```

3. **Match exactly** (no fallbacks needed)
   ```typescript
   find(s => s.section_id === id && s.source_blueprint_id === blueprintId)
   ```

## Files Modified

- ✅ `supabase/functions/_shared/section-embeddings.ts`
- ✅ `supabase/functions/generate-structure-legacy/index.ts`

## Deployment

Run: `deploy_cache_fix.bat`

Or manually:
```bash
npx supabase functions deploy generate-structure-legacy --no-verify-jwt
```

## Testing

After deployment:
1. Create a new blueprint on HW 10 (Radiation)
2. Duplicate it
3. Should get radiation cached data (NOT heat exchangers)
4. Check logs for: `✅ Matched from blueprint "xyz-123"...`

## Why This Works

- **Blueprint IDs are UUIDs** - guaranteed unique
- **No text matching issues** - avoids subject_area variations
- **Simple logic** - one exact match, no fallbacks
- **Already indexed** - database has composite index on (section_id, source_blueprint_id)
- **Clear semantics** - each cache entry explicitly linked to its source

## Impact

✅ Fixes cache cross-contamination  
✅ Maintains performance (Pinecone + indexed queries)  
✅ Simpler and more reliable than text matching  
✅ Better debugging (logs show exact blueprint ID)  
✅ Future-proof (works regardless of text variations)

