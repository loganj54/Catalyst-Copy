# 🚨 URGENT: Run This SQL Now

## The Problems

### 1. CORS Error (Frontend)
```
Access to fetch at '...generate-structure-legacy' has been blocked by CORS policy
```

### 2. Database Error (Backend)
```
null value in column "structure" of relation "cached_blueprint_structures" violates not-null constraint
```

**These are connected!** The database error crashes the function before it can return CORS headers, causing the CORS error.

## The Root Cause

The `cached_blueprint_structures` table has an old `structure` column with a NOT NULL constraint. This is causing all cache inserts to fail.

## The Fix

**Go to your Supabase Dashboard** and run this SQL:

### Option 1: Supabase Dashboard SQL Editor

1. Go to: https://supabase.com/dashboard/project/breeiehhmibttsugorly/sql/new
2. Paste this SQL:

```sql
-- Drop the old 'structure' column
ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS structure CASCADE;

-- Verify it's gone
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cached_blueprint_structures'
AND column_name = 'structure';
-- Should return 0 rows
```

3. Click "Run"
4. Done!

### Option 2: Command Line (if you have psql)

```bash
# Get your database connection string from Supabase dashboard
psql "your-connection-string-here" -c "ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS structure CASCADE;"
```

## Why This Happened

The old caching system used a `structure` column to store the entire blueprint structure. The new system uses `cached_unit` to store individual learning units per section.

The migration file tried to drop this column, but it wasn't applied because the migration files don't have proper timestamps.

## After Running the SQL

**Both errors will be fixed!**

### Frontend:
✅ No more CORS error  
✅ Function returns successfully  

### Backend:
```
[generate-structure] ✅ Cached section: Problem 1
[generate-structure] ✅ Cached section: Problem 2
[generate-structure] ✅ Cached section: Problem 3
...
[generate-structure] Successfully cached 6/6 sections
```

**No more errors!** 🎉

---

**Time to fix:** 30 seconds  
**Action:** Run the SQL in Supabase Dashboard  
**Result:** Caching will work!

