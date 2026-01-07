# Deploy Cache Fix - Checklist

## Pre-Deployment Checklist

- [x] Identified root cause (section_id matching without blueprint context)
- [x] Implemented fix using source_blueprint_id as unique key
- [x] Updated cache storage to include source_blueprint_id
- [x] Updated cache query to use blueprint_id + section_id
- [x] Updated matching logic for exact matches
- [x] No linter errors
- [x] Created documentation
- [x] Created deployment script

## Deployment Steps

1. **Review Changes**
   - [ ] Read `CACHE_FIX_SUMMARY.md` for overview
   - [ ] Read `CACHE_FIX_VISUAL.md` for visual explanation
   - [ ] Review code changes in:
     - `supabase/functions/_shared/section-embeddings.ts`
     - `supabase/functions/generate-structure-legacy/index.ts`

2. **Deploy Function**
   ```bash
   deploy_cache_fix.bat
   ```
   
   Or manually:
   ```bash
   npx supabase functions deploy generate-structure-legacy --no-verify-jwt
   ```

3. **Verify Deployment**
   - [ ] Check Supabase dashboard for successful deployment
   - [ ] No errors in deployment logs

## Post-Deployment Testing

### Test Case 1: Create Fresh Blueprints
- [ ] Create blueprint on HW 9 (Heat Exchangers)
- [ ] Verify it generates and caches correctly
- [ ] Check logs show: `source_blueprint_id: <hw9-id>`

### Test Case 2: Create Second Homework
- [ ] Create blueprint on HW 10 (Radiation)
- [ ] Verify it generates and caches correctly
- [ ] Check logs show: `source_blueprint_id: <hw10-id>`

### Test Case 3: Duplicate HW 9 (Should Work)
- [ ] Duplicate HW 9 blueprint
- [ ] Should get heat exchanger cached data
- [ ] Check logs show: `Matched from blueprint "<hw9-id>"`
- [ ] Verify content is about heat exchangers

### Test Case 4: Duplicate HW 10 (THIS WAS BROKEN)
- [ ] Duplicate HW 10 blueprint
- [ ] Should get radiation cached data (NOT heat exchangers!)
- [ ] Check logs show: `Matched from blueprint "<hw10-id>"`
- [ ] Verify content is about radiation
- [ ] **This is the critical test - it was returning HW 9 data before**

## Expected Log Output (Success)

```
[section-embeddings] Querying by source_blueprint_id + section_id (unique key)
[section-embeddings] Looking for 4 blueprint+section pairs
[section-embeddings] Looking for section "Problem 3" from blueprint "xyz-222-hw10"
[section-embeddings] ✅ Matched from blueprint "xyz-222-hw10": "Mechanical Engineering" - "Radiation Heat Transfer"
[section-embeddings] ✅ Retrieved cached section Problem 3:
[section-embeddings]   - Single-unit cache: "Stefan-Boltzmann Law and Blackbody Radiation"
```

## Rollback Plan (If Needed)

If something goes wrong:

1. **Check Error Logs**
   - Look for errors in Supabase function logs
   - Check for database query errors

2. **Verify Database Column Exists**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'cached_blueprint_structures' 
   AND column_name = 'source_blueprint_id';
   ```
   
   If column doesn't exist, run:
   ```sql
   -- From migration: 20260105224445_add_source_blueprint_id.sql
   ALTER TABLE cached_blueprint_structures 
   ADD COLUMN source_blueprint_id UUID REFERENCES blueprints(id);
   ```

3. **Clear Cache if Needed**
   ```sql
   -- Only if you need to start fresh
   DELETE FROM cached_blueprint_structures;
   ```

## Success Criteria

✅ HW 10 duplicate returns radiation data (not heat exchangers)  
✅ Logs show correct blueprint_id being matched  
✅ No errors in function logs  
✅ Cache hit rate remains high (95%+)  
✅ Performance is unchanged  

## Notes

- The fix is **backwards compatible** - old cached entries without source_blueprint_id will still work (Pinecone has blueprint_id in metadata)
- New cache entries will include source_blueprint_id for precise matching
- The database already has the column and indexes from migration `20260105224445_add_source_blueprint_id.sql`

