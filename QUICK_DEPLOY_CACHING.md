# Quick Deployment Guide - Blueprint Structure Caching

## 🚀 Deploy in 3 Steps

### Step 1: Deploy Database Migration

**Option A: Supabase Dashboard (Recommended)**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase/migrations/add_blueprint_structure_caching.sql`
5. Paste into the editor
6. Click **Run** (or press F5)
7. ✅ Verify: You should see "Success" message

**Option B: Supabase CLI**
```bash
# If your CLI is working
npx supabase db push
```

### Step 2: Deploy Edge Functions

**Option A: Supabase Dashboard (Recommended)**
1. Go to **Edge Functions** in dashboard
2. Find `generate-structure` function
3. Click **Deploy new version**
4. Select the source from your repo or upload
5. ✅ Verify: Function shows "Deployed" status

**Option B: Git Push**
```bash
git add .
git commit -m "feat: blueprint structure caching system"
git push
# Supabase will auto-deploy if you have GitHub integration
```

### Step 3: Test It!

1. **Upload a document** and generate a blueprint
2. **Upload a similar document** (same subject, similar structure)
3. **Check the debug panel** on the blueprint page
4. **Look for**:
   - "Optimized" badge near the section title
   - `from_cache: true` in the Structure Info
   - `cache_similarity: "XX.X%"`
   - `token_savings: "~24,000 tokens (~$0.06)"`

## 🔍 Verify Deployment

### Check Database
```sql
-- Run in SQL Editor
SELECT COUNT(*) as table_exists 
FROM information_schema.tables 
WHERE table_name = 'cached_blueprint_structures';
-- Expected: 1
```

### Check Edge Function
```bash
# Check function logs
# Go to Edge Functions → generate-structure → Logs
# Look for: "[cache] Checking for similar blueprint structures..."
```

## 📊 Monitor Cache Performance

```sql
-- View cache statistics
SELECT * FROM cache_statistics;

-- View most used cached structures
SELECT 
  subject_area,
  specific_topic,
  times_used,
  quality_score,
  (times_used * 24000) as estimated_tokens_saved
FROM cached_blueprint_structures
ORDER BY times_used DESC
LIMIT 10;
```

## ⚠️ Troubleshooting

### "Function not found" error
- Re-deploy the Edge Function
- Check function name is exactly `generate-structure`

### "Table does not exist" error
- Re-run the migration SQL
- Check you're in the correct Supabase project

### Cache never hits
- This is normal for the first few documents
- Cache builds over time as you generate more blueprints
- Try uploading 2-3 similar documents in the same subject

### "Failed to generate embeddings" error
- Check OpenAI API key is set in Supabase secrets
- Verify you have OpenAI API credits

## ✅ Success Indicators

1. ✅ Database migration runs without errors
2. ✅ Edge Function deploys successfully
3. ✅ First blueprint generates normally (cache miss expected)
4. ✅ Second similar blueprint shows "Optimized" badge
5. ✅ Debug panel shows cache information
6. ✅ Console logs show "[cache] ✅ CACHE HIT!"

## 🎉 You're Done!

The blueprint structure caching system is now live and saving you tokens automatically!

**Expected Results:**
- 80-90% token reduction for similar documents
- 4-6x more concurrent blueprint generations
- ~$0.06 saved per cache hit
- Faster blueprint generation times

---

**Need Help?**
- Check `BLUEPRINT_STRUCTURE_CACHING_COMPLETE.md` for full documentation
- Look at Edge Function logs for detailed cache information
- Run SQL queries above to monitor cache performance

