# Fix CORS Error and Structure Column Issue

## The Errors You're Seeing

### Error 1: CORS Policy Error (Frontend)
```
Access to fetch at 'https://breeiehhmibttsugorly.supabase.co/functions/v1/generate-structure-legacy' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Error 2: Database Constraint Error (Backend Logs)
```
null value in column "structure" of relation "cached_blueprint_structures" 
violates not-null constraint
```

## Why This Is Happening

The CORS error is a **symptom**, not the root cause. Here's what's happening:

1. Frontend calls `generate-structure-legacy` function
2. Function processes the request successfully
3. Function tries to cache sections in database
4. Database INSERT fails due to NOT NULL constraint on `structure` column
5. **Function crashes before it can return CORS headers**
6. Frontend sees CORS error (because no response was returned)

## The Root Cause

The `cached_blueprint_structures` table has an old `structure` column with a NOT NULL constraint. The new caching code doesn't populate this column (it uses `cached_unit` instead), so the INSERT fails.

## The Fix (One SQL Command)

### Step 1: Go to Supabase SQL Editor

**Direct Link:** https://supabase.com/dashboard/project/breeiehhmibttsugorly/sql/new

### Step 2: Run This SQL

```sql
-- Drop the old 'structure' column that's causing the error
ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS structure CASCADE;
```

### Step 3: Click "Run"

That's it! The column will be dropped and both errors will be fixed.

## Verify It Worked

### Option 1: Check the Column is Gone

Run this in SQL Editor:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cached_blueprint_structures'
AND column_name = 'structure';
```

Should return **0 rows** (column is gone).

### Option 2: Generate a Blueprint

Try generating a blueprint again. You should see:

**Frontend:** ✅ No CORS error  
**Backend Logs:**
```
[generate-structure] ✅ Cached section: Problem 1
[generate-structure] ✅ Cached section: Problem 2
[generate-structure] ✅ Cached section: Problem 3
...
[generate-structure] Successfully cached 6/6 sections
```

## Why Both Errors Will Be Fixed

### CORS Error Will Go Away Because:
- Function will complete successfully
- Function will return proper response with CORS headers
- Frontend will receive the response
- No more CORS error! ✅

### Database Error Will Go Away Because:
- No more `structure` column
- No more NOT NULL constraint
- INSERT will succeed with just `cached_unit`
- Caching will work! ✅

## Alternative: Quick Test Without Caching

If you want to test the function WITHOUT fixing the database, you can temporarily disable caching:

**File:** `supabase/functions/generate-structure-legacy/index.ts`

Find this line (around line 1280):
```typescript
if (blueprint_id && analysisData && structure) {
```

Change to:
```typescript
if (false && blueprint_id && analysisData && structure) {
```

This will skip caching entirely, and the function will work. But you won't get the benefits of caching.

## Recommended: Fix the Database

Just run the SQL command above. It takes 5 seconds and fixes everything permanently.

---

## Summary

**Problem:** Old `structure` column with NOT NULL constraint  
**Solution:** Drop the column  
**Command:** `ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS structure CASCADE;`  
**Where:** https://supabase.com/dashboard/project/breeiehhmibttsugorly/sql/new  
**Time:** 5 seconds  
**Result:** Both CORS and database errors fixed! 🎉

---

## After the Fix

Your section-level caching will work perfectly:
- ✅ One row per section
- ✅ Proper embeddings
- ✅ Fast cache lookups
- ✅ Token savings on similar problems
- ✅ No more errors!

