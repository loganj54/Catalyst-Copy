# Deploy Semantic Caching (Copy-Paste Fix)

## 1. Run Database Migration
We need to add the helper function that finds matching documents.

1.  Open the file: `supabase/migrations/20260109_find_matching_document_chunk.sql`
2.  Copy the content.
3.  Run it in your **Supabase SQL Editor** (dashboard).

## 2. Deploy the Function
Update the analysis function with the new logic.

```bash
supabase functions deploy analyze-document-legacy --no-verify-jwt
```

## 3. Verify
1.  Open Blueprint page.
2.  Copy text from an existing blueprint's document (something you've already analyzed).
3.  Go to "Create Blueprint".
4.  Paste the text into the text box.
5.  Click Create.
6.  **Result**: The "Analyzing" step should finish extremely quickly, and logs should show:
    `[analyze-document] ✅ Found semantic match!`
