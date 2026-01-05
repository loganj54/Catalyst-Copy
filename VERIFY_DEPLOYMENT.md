# Verify Function Deployment

## The Issue

You're seeing `max_tokens: 100000 > 64000` error even after deploying with 64000.

## Possible Causes

1. **Old request still running** - A request started before the deployment is still executing
2. **Browser cache** - Your browser cached the old error response
3. **Edge function cache** - Supabase is serving cached function code
4. **Multiple deployment needed** - Sometimes needs 2-3 deploys to fully update

## Verification Steps

### Step 1: Check Deployment Timestamp

Go to: https://supabase.com/dashboard/project/breeiehhmibttsugorly/functions

Click on `generate-structure-legacy` and check:
- **Last deployed:** Should be within the last 2 minutes
- **Version:** Should show recent timestamp

### Step 2: Check Function Logs

```bash
npx supabase functions logs generate-structure-legacy --tail
```

Or in Dashboard:
https://supabase.com/dashboard/project/breeiehhmibttsugorly/logs/edge-functions

Look for the most recent invocation and check if it shows the 64000 or 100000 error.

### Step 3: Clear Everything

1. **Close all browser tabs** with your app
2. **Wait 1 minute** (let any running requests finish)
3. **Open a fresh browser tab**
4. **Hard refresh** (Ctrl+Shift+R)
5. **Start a new blueprint generation**

### Step 4: Force Another Deploy

Sometimes Supabase needs multiple deploys:

```bash
# Delete the function
npx supabase functions delete generate-structure-legacy

# Wait 10 seconds

# Redeploy
npx supabase functions deploy generate-structure-legacy
```

### Step 5: Check the Actual Error Line

The error message should include a line number like:
```
at file:///.../generate-structure-legacy/index.ts:713:23
```

**Send me that line number** and I'll check if there's another place calling Claude with 100000 tokens.

## Verify Local File

Run this to confirm the local file has 64000:

```bash
grep -n "maxTokens" supabase/functions/generate-structure-legacy/index.ts
```

Should show:
```
1082:      { temperature: 0.4, maxTokens: 64000 }
```

## Alternative: Check if Error is from Different Function

The error might be coming from a different function that also calls Claude. Check:

```bash
grep -r "maxTokens.*100000" supabase/functions/
```

If this finds anything, we need to update those files too.

## If Still Failing

1. **Send me the full error** including line numbers
2. **Check function logs** for the actual invocation
3. **Try the delete + redeploy** approach above

---

**Most Likely:** Old request still running or browser cache  
**Solution:** Wait 1 minute + hard refresh + try again  
**If persists:** Delete and redeploy function

