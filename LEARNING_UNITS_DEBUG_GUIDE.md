# Learning Units Not Showing - Debugging Guide

## Problem
Structure generates successfully and appears in the debug panel, but UI shows "No topics found in this section."

## Root Cause Investigation

The issue is that `learning_units` array is either:
1. Missing from the cached structure
2. Getting lost during adaptation
3. Empty arrays

## Step-by-Step Debugging

### 1. Check Supabase Function Logs

Go to: https://supabase.com/dashboard/project/breeiehhmibttsugorly/functions

Look for logs from `generate-structure` function. You should see:

```
[cache] Adapting cached structure to new document...
[cache] Input cached structure keys: [...list of keys...]
[cache] Has content_sections: true/false
[cache] Number of content_sections: X
[cache]   Section 0: has X learning units
[cache]   Section 1: has X learning units
...
[cache] ✅ Structure adapted successfully
[cache] Final structure has X sections
[cache] First section has X learning units
```

**What to look for:**
- If "has X learning units" shows 0 → The cached structure doesn't have learning_units
- If the final log shows 0 → They're getting lost during adaptation
- If both show > 0 → Problem is in the frontend

### 2. Check Browser Console for Structure Data

In the browser console, when you see the structure loaded message, type:

```javascript
// Get the structure from the page
const structure = document.querySelector('[data-structure]'); // May need to adjust selector

// Or use React DevTools to inspect the component state
// Look for: learningStructure.structure.content_sections[0].learning_units
```

**Check:**
1. Does `structure.content_sections` exist? ✅/❌
2. Does `structure.content_sections[0]` exist? ✅/❌
3. Does `structure.content_sections[0].learning_units` exist? ✅/❌
4. What is `structure.content_sections[0].learning_units.length`? _____

### 3. Check the Debug Panel

When you open the debug panel and see the structure:
1. Expand `structure` → `content_sections` → `[0]`
2. Look for `learning_units` array
3. Check if it has items

**Screenshot what you see and share it**

### 4. Check Database Directly

Run this query in Supabase SQL Editor:

```sql
SELECT 
  id,
  blueprint_id,
  jsonb_array_length(structure->'content_sections') as num_sections,
  structure->'content_sections'->0->'learning_units' as first_section_units,
  jsonb_array_length(structure->'content_sections'->0->'learning_units') as first_section_unit_count
FROM blueprint_structures
WHERE blueprint_id = '0d2c19db-47cf-4c19-b4ba-f24c4cd223dd' -- Your blueprint ID
ORDER BY created_at DESC
LIMIT 1;
```

**What to check:**
- `first_section_unit_count` should be > 0
- `first_section_units` should show an array of objects

## Fixes Deployed

### Fix #1: Explicit learning_units Preservation
Added explicit preservation of `learning_units` in `adaptCachedStructure`:

```typescript
return {
  ...cachedSection,
  // ... other fields ...
  learning_units: cachedSection.learning_units || [],
};
```

### Fix #2: Enhanced Logging
Added detailed logging to track:
- Input structure shape
- Number of learning units per section
- Final output shape

## Next Steps

Based on the debugging results:

### If cached structure has 0 learning_units:
→ The cache has bad data. Need to either:
  - Clear the cache table: `DELETE FROM blueprint_structure_cache;`
  - Or bypass cache for now: modify the similarity threshold

### If learning_units are lost during adaptation:
→ Bug in adaptCachedStructure (but we explicitly preserve them now)

### If learning_units exist in structure but UI shows empty:
→ Frontend rendering issue. Need to check:
  - Is `currentUnits` being set correctly?
  - Are there other conditions filtering them out?

## Quick Test

Try generating a structure for a NEW document type (not similar to any previous one) to force AI generation instead of cache. If that works, the problem is definitely in the cached structure data.

## Support Info

- Blueprint ID: `0d2c19db-47cf-4c19-b4ba-f24c4cd223dd`
- Document ID: `22ae7e93-ecfe-4e45-96af-bfe735bffd56`
- Analysis ID: `a597d493-5751-43d9-9984-4b9d94ac28d2`

Run the SQL query above with this blueprint ID to inspect the actual database data.

