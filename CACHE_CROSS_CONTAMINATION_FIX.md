# Cache Cross-Contamination Fix

## Problem Description

When duplicating blueprints, the caching system was returning cached data from the **wrong homework assignment**. 

### Example Issue:
1. Created blueprint on **Homework 9** (Heat Exchangers) ✅ Works perfectly
2. Created blueprint on **Homework 10** (Radiation) ✅ Works perfectly  
3. Duplicated Homework 9 blueprint ✅ Got heat exchanger cached data (correct)
4. Duplicated Homework 10 blueprint ❌ Got **heat exchanger** cached data instead of radiation data!

### Root Cause

The cache query was matching sections by `section_id` alone, without filtering by `subject_area` or `specific_topic`. 

Since many homeworks have sections with the same names (e.g., "Problem 3"), the query would return **the first "Problem 3" it found** in the database, regardless of which homework it came from.

```typescript
// OLD CODE (BUGGY):
const { data: cachedSections } = await supabase
  .from('cached_blueprint_structures')
  .select('section_id, cached_unit, subject_area, specific_topic')
  .in('section_id', sectionIds);  // ❌ No filtering by subject!

// This would return BOTH:
// - Problem 3 from Homework 9 (Heat Exchangers)
// - Problem 3 from Homework 10 (Radiation)
// Then .find() would just pick the first one!
```

## The Fix

### Simple Solution: Use Blueprint ID as Unique Key

Instead of trying to filter by `subject_area` and `specific_topic` (which can have variations), we use the **`source_blueprint_id`** column that already exists in the database. This creates a unique key: `(source_blueprint_id, section_id)`.

### 1. Store source_blueprint_id When Caching

Modified `supabase/functions/generate-structure-legacy/index.ts` to include `source_blueprint_id`:

```typescript
const cacheEntry: any = {
  section_id: sectionToCache.section_id,
  section_type: sectionToCache.section_type,
  // ... other fields ...
  source_blueprint_id: blueprint_id, // CRITICAL: Links cache to source blueprint
  subject_area: analysisData.subject_area,
  specific_topic: analysisData.specific_topic,
  // ...
};
```

### 2. Query by Blueprint ID + Section ID

Modified `supabase/functions/_shared/section-embeddings.ts` to query by the unique pair:

```typescript
// Build array of (source_blueprint_id, section_id) pairs from Pinecone matches
const blueprintSectionPairs = sectionKeys
  .filter(k => k.blueprint_id && k.section_id)
  .map(k => ({ blueprint_id: k.blueprint_id, section_id: k.section_id }));

// Query Supabase for exact matches
const { data: cachedSections } = await supabase
  .from('cached_blueprint_structures')
  .select('section_id, cached_unit, source_blueprint_id, subject_area, specific_topic')
  .or(
    blueprintSectionPairs
      .map(pair => `and(source_blueprint_id.eq.${pair.blueprint_id},section_id.eq.${pair.section_id})`)
      .join(',')
  );
```

### 3. Match by Exact Blueprint + Section

```typescript
// Match by EXACT blueprint_id + section_id pair
const supabaseData = cachedSections.find(s => 
  s.section_id === matchSectionId &&
  s.source_blueprint_id === matchBlueprintId
);
```

This ensures we get the **exact cached section from the specific blueprint**, not just any section with the same name.

## Files Changed

1. **`supabase/functions/_shared/section-embeddings.ts`**
   - Modified `querySimilarSectionsFromPinecone()` function
   - Changed query to use `source_blueprint_id` + `section_id` as unique key
   - Simplified matching logic to exact blueprint+section pair
   - Enhanced logging for debugging

2. **`supabase/functions/generate-structure-legacy/index.ts`**
   - Added `source_blueprint_id` to cache entries when storing
   - Ensures every cached section is linked to its source blueprint

## Deployment

Run the deployment script:

```bash
deploy_cache_fix.bat
```

Or manually:

```bash
npx supabase functions deploy generate-structure-legacy --no-verify-jwt
```

## Testing

1. **Create a new blueprint on Homework 10 (Radiation)**
   - Should generate fresh structure and cache it

2. **Duplicate the Homework 10 blueprint**
   - Should retrieve cached radiation data (NOT heat exchanger data)
   - Check logs for: `subject_area="Mechanical Engineering", specific_topic="Radiation Heat Transfer"`

3. **Verify no cross-contamination**
   - Logs should show: `✅ Matched cached section: subject_area="...", specific_topic="..."`
   - Should NOT see warnings about subject mismatches

## Expected Log Output (Fixed)

```
[section-embeddings] Querying by source_blueprint_id + section_id (unique key)
[section-embeddings] Looking for 3 blueprint+section pairs
[section-embeddings] Looking for section "Problem 3" from blueprint "abc-123-def-456"
[section-embeddings] ✅ Matched cached section from blueprint "abc-123-def-456": "Mechanical Engineering" - "Radiation Heat Transfer"
[section-embeddings] ✅ Retrieved cached section Problem 3:
[section-embeddings]   - Single-unit cache: "Stefan-Boltzmann Law and Blackbody Radiation"
```

Notice how it now shows the **blueprint ID** in the logs, making it crystal clear which blueprint's cache is being used.

## Impact

- ✅ **Fixes cache cross-contamination** between different homework assignments
- ✅ **Maintains cache performance** - still uses Pinecone for fast vector search
- ✅ **Simple and reliable** - uses database primary key (blueprint_id) instead of text matching
- ✅ **Better debugging** - logs show exact blueprint ID being used
- ✅ **Future-proof** - works even if subject_area or specific_topic have slight variations

## Why Blueprint ID is Better Than Subject Filtering

1. **Unique and Reliable**: Blueprint IDs are UUIDs - guaranteed unique
2. **No Text Matching Issues**: Avoids problems with variations in subject_area or specific_topic text
3. **Simpler Logic**: One exact match instead of multi-tier fallback strategies
4. **Already Available**: The `source_blueprint_id` column already exists in the database
5. **Clear Semantics**: Each cached section is explicitly linked to its source blueprint

## Database Schema

The fix relies on the existing `source_blueprint_id` column:

```sql
-- From migration: 20260105224445_add_source_blueprint_id.sql
ALTER TABLE cached_blueprint_structures 
ADD COLUMN source_blueprint_id UUID REFERENCES blueprints(id);

-- Composite index for fast lookups
CREATE INDEX idx_cached_sections_section_blueprint
ON cached_blueprint_structures(section_id, source_blueprint_id);
```

