# Quick Fix: Transcript Parsing Issue

## The Problem
SupaData returns transcripts as JSON arrays, but we were storing them as-is instead of extracting the text.

**Example of bad data:**
```json
[{"text":"in this video...","offset":8620,"duration":4080},...]
```

**What we need:**
```
in this video...
```

## The Fix
Added parsing functions to extract text from JSON arrays before storing/analyzing.

## Deploy Now

```bash
# Run this command:
deploy_transcript_fix.bat

# Or manually:
npx supabase functions deploy load-resources-database --no-verify-jwt
```

## Verify It Works

1. **Load a new video resource**
2. **Check the logs** - should see:
   ```
   [SupaData] First 200 chars: in this video we will be talking about...
   ```
3. **Check database** - transcript should be plain text, not JSON

## Fix Old Data (Optional)

If you have existing resources with JSON transcripts:

```sql
-- 1. Check what needs fixing
\i check_transcript_format.sql

-- 2. Review the migration (DRY RUN first!)
\i fix_existing_transcripts.sql

-- 3. Uncomment the UPDATE statement in the SQL file to actually fix the data
```

## Files Changed
- `supabase/functions/load-resources-database/index.ts` - Added parsing
- `supabase/functions/_shared/transcript.ts` - Added parsing

## Expected Result
- ✅ Transcripts stored as plain text
- ✅ Grok analyzes actual content (not JSON)
- ✅ Better search results
- ✅ Better resource recommendations

## More Details
See `TRANSCRIPT_FIX_COMPLETE.md` for full documentation.

