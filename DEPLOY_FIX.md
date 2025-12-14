# Deploying the JSON Parsing Fix

## What Was Fixed
The JSON parsing error when analyzing documents has been fixed with:
1. JSON repair logic in PDF analysis functions
2. Increased token limit (8192 → 16384)
3. Enhanced prompts for better JSON completion

## Files Modified
- `supabase/functions/_shared/supabase-client.ts` - Added JSON repair logic
- `supabase/functions/_shared/prompts.ts` - Enhanced prompts
- `supabase/functions/analyze-document/index.ts` - Increased token limit

## Deployment Steps

### Option 1: Deploy via Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```powershell
   # Using npm
   npm install -g supabase
   
   # Or using scoop
   scoop install supabase
   ```

2. **Login to Supabase**:
   ```powershell
   supabase login
   ```

3. **Link to your project** (if not already linked):
   ```powershell
   supabase link --project-ref your-project-ref
   ```

4. **Deploy the functions**:
   ```powershell
   # Deploy all functions
   supabase functions deploy
   
   # Or deploy specific functions
   supabase functions deploy analyze-document
   supabase functions deploy generate-structure
   supabase functions deploy search-resources
   ```

5. **Verify deployment**:
   Check the Supabase Dashboard → Edge Functions to see the updated timestamp

### Option 2: Manual Upload via Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. For each function (`analyze-document`, `generate-structure`, `search-resources`):
   - Click on the function name
   - Click **Edit**
   - Copy the contents from your local file
   - Paste and save

**Important**: Don't forget to also update the `_shared` folder files, as these are used by all functions.

### Option 3: CI/CD Deployment

If you have a CI/CD pipeline set up, commit and push the changes:
```powershell
git add supabase/functions/
git commit -m "Fix JSON parsing error in document analysis"
git push
```

Your CI/CD should automatically deploy the updated functions.

## Testing After Deployment

1. Open your application
2. Navigate to a Blueprint page
3. Open the Debug Panel
4. Click **"1. Analyze Document"**
5. Check that:
   - The analysis completes without JSON errors
   - The document analysis appears in the debug panel
   - No "Unterminated string" errors in the browser console

## Troubleshooting

### If deployment fails:
- Check that you have the correct permissions
- Verify the Supabase CLI is up to date: `supabase --version`
- Check the deployment logs for specific errors

### If the error still occurs:
1. Check the Edge Function logs in Supabase Dashboard
2. Look for the new log messages:
   - "Attempting JSON repair: X unclosed braces..."
   - "JSON repair successful!"
3. If repair fails, the error message will indicate if the document is too large

### Environment Variables
Ensure these are set in your Supabase project:
- `ANTHROPIC_API_KEY` - Your Claude API key
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase
- `SUPABASE_ANON_KEY` - Auto-set by Supabase

## Rollback Plan

If issues occur after deployment, you can rollback using Git:
```powershell
git revert HEAD
supabase functions deploy
```

Or manually restore the previous version from your version control system.

## Next Steps

After successful deployment and testing:
1. Monitor the Edge Function logs for any new errors
2. Test with various document types and sizes
3. If issues persist with very large documents (>50 pages), consider implementing document chunking

