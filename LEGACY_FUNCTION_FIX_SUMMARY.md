# Legacy Function Fix Summary

## The Problem

You reported: `"Could not find the 'characteristics_embedding' column"`

**Root Cause:** The `generate-structure-legacy` function was using OLD caching code that tried to access the removed `characteristics_embedding` column.

## The Misunderstanding

I initially thought you were using the new atomic functions (`check-structure-cache`, `cache-structure`, etc.), but you clarified:

> "Those goddamn functions don't even exist anymore. I'm using generate structure legacy only; it's the big monolithic function."

You're right! You're using the **monolithic `generate-structure-legacy` function**, not the separate atomic functions.

## The Fix

Updated `generate-structure-legacy/index.ts` to:

### 1. Remove Old Imports
```typescript
// REMOVED:
// import { checkStructureCache, adaptCachedStructure, cacheNewStructure } from '../_shared/structure-cache.ts';

// ADDED:
import { generateAllSectionEmbeddings, prepareSectionsForCache } from '../_shared/section-embeddings.ts';
```

### 2. Replace Cache Check Logic

**Before (OLD - caused error):**
```typescript
const cacheCheck = await checkStructureCache(supabase, analysisData, 0.92);
// Used characteristics_embedding ❌
```

**After (NEW - works):**
```typescript
const sectionsWithEmbeddings = await generateAllSectionEmbeddings(analysisData);

for (const section of sectionsWithEmbeddings) {
  const { data } = await supabase.rpc('search_similar_sections', {
    query_embedding: section.embedding,
    p_section_type: section.section_type,
    p_subject_area: analysisData.subject_area,
    p_document_type: analysisData.document_type,
    similarity_threshold: 0.95
  });
  // Uses primary_embedding, problem_statement_embedding, topic_summary_embedding ✅
}
```

### 3. Replace Cache Storage Logic

**Before (OLD - one big row):**
```typescript
await cacheNewStructure(supabase, structure, analysisData, analysisId);
// Stored entire structure as one row ❌
```

**After (NEW - one row per section):**
```typescript
for (const sectionToCache of sectionsToCache) {
  await supabase.from('cached_blueprint_structures').insert({
    section_id: sectionToCache.section_id,
    section_type: sectionToCache.section_type,
    section_title: sectionToCache.cached_unit?.topic,
    problem_statement_text: ...,
    problem_statement_embedding: ...,
    topic_summary_text: ...,
    topic_summary_embedding: ...,
    concepts_tested: ...,
    primary_embedding: ...,
    cached_unit: sectionToCache.cached_unit,
    // ... other fields
  });
}
// Stores ONE ROW PER SECTION ✅
```

## Files Changed

1. ✅ `supabase/functions/generate-structure-legacy/index.ts` - Updated to use new schema
2. ✅ `DEPLOY_LEGACY_FUNCTION.md` - Deployment instructions
3. ✅ `LEGACY_FUNCTION_FIX_SUMMARY.md` - This file

## Files NOT Changed (Don't Exist in Your Setup)

- ❌ `check-structure-cache/index.ts` - You don't use this
- ❌ `cache-structure/index.ts` - You don't use this
- ❌ `orchestrate-generate-structure/index.ts` - You don't use this
- ❌ `generate-structure-mixed/index.ts` - You don't use this

## Deploy Now

```bash
supabase functions deploy generate-structure-legacy
```

That's it! Just this one function.

## What You'll See

### First Generation (No Cache):
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
[generate-structure] Caching sections individually...
[generate-structure] ✅ Cached section: Problem 1
[generate-structure] ✅ Cached section: Problem 2
[generate-structure] ✅ Cached section: Problem 3
[generate-structure] ✅ Cached section: Problem 4
[generate-structure] ✅ Cached section: Problem 5
[generate-structure] Successfully cached 5/5 sections
```

### Second Generation (Similar Problems):
```
[generate-structure] CHECKING SECTION-LEVEL CACHE
[generate-structure] ✅ CACHE HIT for Problem 1! Similarity: 96.2%
[generate-structure] ✅ CACHE HIT for Problem 2! Similarity: 95.8%
[generate-structure] ❌ CACHE MISS for Problem 3
[generate-structure] Cache hit rate: 40.0% (2/5 sections)
```

### Database (Multiple Rows):
```sql
SELECT section_id, section_type, section_title 
FROM cached_blueprint_structures 
ORDER BY created_at DESC;
```

Expected output:
```
section_id    | section_type | section_title
--------------+--------------+------------------
Problem 1     | problem      | Projectile Motion
Problem 2     | problem      | Energy Conservation
Problem 3     | problem      | Momentum Transfer
Problem 4     | problem      | Circular Motion
Problem 5     | problem      | Work and Power
```

**5 rows, not 1!** ✅

## Error Should Be Gone

You should NO LONGER see:
```
"Could not find the 'characteristics_embedding' column"
```

Because the function now uses:
- `primary_embedding` ✅
- `problem_statement_embedding` ✅
- `topic_summary_embedding` ✅

NOT:
- `characteristics_embedding` ❌ (removed)
- `section_embedding` ❌ (renamed to primary_embedding)

---

**Status:** ✅ Ready to Deploy  
**Command:** `supabase functions deploy generate-structure-legacy`  
**Expected Result:** Error gone, section-level caching works

