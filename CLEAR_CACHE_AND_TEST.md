# Clear Cache and Test - adaptedStructure Error

## The Issue

You're seeing `adaptedStructure is not defined` even though we deployed the fix.

## Why This Happens

1. **Browser cache** - Your browser might have cached the old error response
2. **Edge function cache** - Supabase might be serving cached function code
3. **In-progress request** - An old request might still be running

## Fix Steps

### Step 1: Clear Browser Cache

**Option A: Hard Refresh**
- Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Option B: Clear Cache Manually**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Step 2: Verify Function is Updated

Check the deployment timestamp in Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/breeiehhmibttsugorly/functions
2. Click on `generate-structure-legacy`
3. Check "Last deployed" timestamp - should be very recent (within last few minutes)

### Step 3: Test with Fresh Request

1. **Clear any in-progress generations:**
   - Refresh the page completely
   - Close and reopen the browser tab

2. **Start a new blueprint generation:**
   - Upload a new document OR
   - Click "Regenerate" on an existing blueprint

3. **Watch the console logs:**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for `[generate-structure]` logs

### Step 4: Check Function Logs

View real-time function logs:

```bash
npx supabase functions logs generate-structure-legacy --tail
```

Or in Dashboard:
https://supabase.com/dashboard/project/breeiehhmibttsugorly/logs/edge-functions

Look for the most recent invocation - it should NOT mention `adaptedStructure`.

## What You Should See Now

### In Function Logs:
```
[generate-structure] CHECKING SECTION-LEVEL CACHE
[generate-structure] Generated embeddings for 6 sections
[generate-structure] Cache hit rate: 66.7% (4/6 sections)
[generate-structure] ⚠️  Some sections cached, but generating full structure for consistency
[generate-structure]   - Token savings estimate: ~4000 tokens
[generate-structure]   - Future optimization: Use cached sections directly
[generate-structure] Generating structure with AI...
```

**No `adaptedStructure` error!**

### Then You'll Hit the Database Error:
```
[generate-structure] Error caching section Problem 1: 
{ code: "23502", message: 'null value in column "structure"...' }
```

**This is expected!** This is the database constraint error we need to fix with SQL.

## The SQL Fix (Still Needed)

Once you confirm the `adaptedStructure` error is gone, run this SQL:

```sql
ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS structure CASCADE;
```

**Link:** https://supabase.com/dashboard/project/breeiehhmibttsugorly/sql/new

## If You STILL See adaptedStructure Error

### Check the exact error location:

The error message should show a line number like:
```
adaptedStructure is not defined 
at file:///var/tmp/.../generate-structure-legacy/index.ts:689:75
```

**Send me that line number** and I'll check if there's another reference we missed.

### Force a complete redeploy:

```bash
# Delete the function
npx supabase functions delete generate-structure-legacy

# Redeploy it
npx supabase functions deploy generate-structure-legacy
```

## Summary

1. ✅ Function redeployed (just now)
2. ⚠️ Clear browser cache (Ctrl+Shift+R)
3. ⚠️ Start fresh blueprint generation
4. ✅ Should see database error (not adaptedStructure error)
5. ⚠️ Run SQL to drop structure column
6. ✅ Everything works!

---

**Current Status:** Function deployed, waiting for you to test  
**Next Step:** Hard refresh browser and try again  
**Expected:** Database error (which we fix with SQL)

