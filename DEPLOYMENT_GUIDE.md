# Quick Deployment Guide

## 🚀 Deployment Checklist

### Step 1: Database Migrations
Run these SQL files in Supabase SQL Editor (in order):

1. **Figures Library Tables**
   ```bash
   supabase/migrations/add_figures_library.sql
   ```
   Creates: `curated_figures`, `blueprint_unit_figures` tables

2. **Storage Bucket Setup**
   ```bash
   supabase/migrations/add_figures_storage_bucket.sql
   ```
   Creates: `figures-library` storage bucket with policies

### Step 2: Verify Storage
In Supabase Dashboard → Storage:
- [ ] `figures-library` bucket exists
- [ ] Bucket is public
- [ ] File size limit: 512KB
- [ ] Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml

### Step 3: Deploy Edge Functions
```bash
cd supabase
supabase functions deploy generate-structure
```

### Step 4: Deploy Frontend
```bash
npm run build
# Then deploy the dist/ folder to your hosting platform
```

### Step 5: Test
1. Create a new blueprint with a heat transfer or geometry topic
2. Wait for structure generation
3. Verify equations appear automatically
4. Check if figures are sourced (if AI suggested any)
5. Test lightbox by clicking a figure

## ⚠️ Common Issues

### Issue: Figures not appearing
**Check:**
- Storage bucket exists and is public
- Migration ran successfully
- Edge function deployed correctly

### Issue: Wikimedia API errors
**Check:**
- Internet connection from Supabase functions
- API rate limits not exceeded
- Search terms are appropriate

### Issue: Images too large
**Solution:**
- Wikimedia automatically provides resized versions
- The system requests 800px width thumbnails
- If still too large, images are skipped (logged in console)

## 📊 Monitoring

### Check Logs:
```bash
supabase functions logs generate-structure
```

### Look for:
- `[generate-structure] Aggressive detection added: X equations`
- `[generate-structure] Figures: X cached, X new`
- `[figure-sourcing] Found cached figure: ...`
- `[figure-sourcing] Successfully cached new figure: ...`

### Database Queries:
```sql
-- Check figures library
SELECT COUNT(*) FROM curated_figures;

-- Check figure usage
SELECT name, times_used, subject_area 
FROM curated_figures 
ORDER BY times_used DESC 
LIMIT 10;

-- Check equations
SELECT COUNT(*) FROM curated_equations;
```

## 🎯 Success Indicators

✅ **Equations appearing automatically** - Check blueprints for math/physics topics  
✅ **Figures being sourced** - Look for "Moody diagram" or geometry topics  
✅ **Cache building up** - Query `curated_figures` and `curated_equations` tables  
✅ **No errors in logs** - Function logs show successful completion  
✅ **Attribution displayed** - Figures show source and license info  

## 🔄 Rollback Plan

If issues occur:

1. **Edge Functions:** Redeploy previous version
   ```bash
   git checkout <previous-commit>
   supabase functions deploy generate-structure
   ```

2. **Frontend:** Redeploy previous build

3. **Database:** Tables can remain (won't affect existing functionality)

## 📞 Support

If you encounter issues:
1. Check function logs: `supabase functions logs generate-structure`
2. Check browser console for frontend errors
3. Verify database migrations completed successfully
4. Test with a simple blueprint (e.g., basic geometry topic)

