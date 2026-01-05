# UI Shows "No Topics Found" - Diagnostic Guide

## The Issue

- ✅ No errors in function logs
- ✅ Structure generated successfully
- ❌ UI shows "No topics found in this section"

## Possible Causes

1. **Structure is NULL in database**
2. **Structure format is wrong**
3. **Learning units array is empty**
4. **UI can't parse the structure**

## Step 1: Check Browser Console

Open browser DevTools (F12) and look for these logs:

```javascript
[Blueprint] Has learningStructure: true/false
[Blueprint] Has structure: true/false
[Blueprint] Structure details: { ... }
[Blueprint] Final currentUnits count: X
```

**Send me these values!** They'll tell us exactly what's wrong.

## Step 2: Check Database

Run this in Supabase SQL Editor:

```sql
-- Quick check
SELECT 
  blueprint_id,
  CASE 
    WHEN structure IS NULL THEN 'NULL ❌'
    WHEN structure ? 'content_sections' THEN 'Has content_sections ✅'
    ELSE 'Missing content_sections ❌'
  END as status,
  jsonb_array_length(structure->'content_sections') as num_sections,
  structure->'content_sections'->0->>'title' as first_section_title,
  jsonb_array_length(structure->'content_sections'->0->'learning_units') as first_section_units
FROM blueprint_structures
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `status` = "Has content_sections ✅"
- `num_sections` = 6 (or however many problems you have)
- `first_section_units` = 2-5 (number of learning units)

**If you see:**
- `status` = "NULL ❌" → Structure wasn't stored
- `num_sections` = NULL → Structure is malformed
- `first_section_units` = 0 or NULL → No learning units generated

## Step 3: Check Structure Format

Run this to see the actual structure:

```sql
SELECT 
  blueprint_id,
  jsonb_pretty(structure) as structure_json
FROM blueprint_structures
ORDER BY created_at DESC
LIMIT 1;
```

Look for:
```json
{
  "summary": { ... },
  "content_sections": [
    {
      "section_id": "Problem 1",
      "title": "...",
      "learning_units": [
        {
          "unit_id": "...",
          "topic": "...",
          "search_queries": [...]
        }
      ]
    }
  ]
}
```

## Step 4: Common Issues

### Issue A: Structure is NULL
**Cause:** Database transaction rolled back  
**Fix:** Run the SQL to drop the `structure` column from `cached_blueprint_structures`:
```sql
ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS structure CASCADE;
```

### Issue B: Empty learning_units array
**Cause:** Claude generated structure without units  
**Check:** Look at function logs for the Claude response  
**Fix:** Might need to adjust the prompt or token limit

### Issue C: Wrong column name
**Cause:** UI looking for wrong field  
**Check:** Does the UI expect `structure` or `structure_data`?  
**Fix:** Update UI or database column name

### Issue D: Structure stored but UI can't access it
**Cause:** RLS (Row Level Security) policy blocking access  
**Check:** Run query as authenticated user  
**Fix:** Update RLS policies

## Quick Test

Run this to manually insert a test structure:

```sql
-- Get a blueprint_id
SELECT id FROM blueprints ORDER BY created_at DESC LIMIT 1;

-- Insert test structure (replace YOUR_BLUEPRINT_ID)
INSERT INTO blueprint_structures (blueprint_id, user_id, structure, total_sections, total_learning_units)
VALUES (
  'YOUR_BLUEPRINT_ID',
  (SELECT user_id FROM blueprints WHERE id = 'YOUR_BLUEPRINT_ID'),
  '{
    "summary": {
      "title": "Test",
      "description": "Test structure",
      "total_estimated_time_minutes": 60,
      "difficulty_progression": "beginner to intermediate"
    },
    "prerequisites_section": {
      "description": "None",
      "learning_units": []
    },
    "content_sections": [
      {
        "section_id": "test-1",
        "section_type": "topic",
        "title": "Test Topic",
        "description": "Test",
        "concepts": ["test"],
        "learning_units": [
          {
            "unit_id": "test_unit_1",
            "unit_type": "topic",
            "topic": "Test Topic",
            "explanation": "Test explanation",
            "search_queries": [
              {
                "query_id": "q1",
                "query_text": "test query",
                "query_type": "introductory"
              }
            ]
          }
        ]
      }
    ]
  }'::jsonb,
  1,
  1
);
```

If this test structure shows up in the UI, then the issue is with how the real structure is being generated.

## What to Send Me

Please provide:

1. **Browser console logs** (the `[Blueprint]` lines)
2. **Result of the Quick Check SQL** (Step 2)
3. **Any error messages** from browser Network tab

This will tell me exactly what's wrong!

---

**Files:**
- `DIAGNOSE_STRUCTURE.sql` - Full diagnostic queries
- `UI_NO_TOPICS_FOUND.md` - This guide

