# JSON Parsing Error Fix

## Problem
When analyzing documents (especially PDFs), the `analyze-document` Edge Function would fail with:
```
Error: Failed to parse Claude response as JSON: SyntaxError: Unterminated string in JSON at position 28754 (line 670 column 15)
```

This occurred because Claude's JSON response was being cut off mid-string when it hit the token limit, resulting in malformed JSON that couldn't be parsed.

## Root Cause
1. **Token Limit**: The function was using `maxTokens: 8192`, which wasn't enough for large/complex documents
2. **No JSON Repair**: The PDF-specific code paths (`callClaudeWithPDF` and `callClaudeWithPDFAndText`) didn't have the JSON repair logic that existed in `callClaudeJSON`
3. **Incomplete Guidance**: The prompts didn't explicitly instruct Claude to prioritize completing the JSON structure

## Solution

### 1. Added JSON Repair Logic to PDF Functions
**File**: `supabase/functions/_shared/supabase-client.ts`

Enhanced both `callClaudeWithPDF()` and `callClaudeWithPDFAndText()` with intelligent JSON repair:
- Detects unclosed strings, brackets, and braces
- Automatically closes incomplete JSON structures
- Provides detailed logging for debugging
- Falls back gracefully with helpful error messages

The repair logic:
- Counts open/closed brackets `{}` and arrays `[]`
- Tracks if we're inside a string (handling escape sequences)
- Closes unterminated strings with `"`
- Adds missing closing brackets `]` and braces `}`
- Attempts to parse the repaired JSON

### 2. Increased Token Limit
**File**: `supabase/functions/analyze-document/index.ts`

Changed from `maxTokens: 8192` to `maxTokens: 16384` (doubled) to give Claude more room to complete comprehensive analyses.

### 3. Enhanced Prompts
**File**: `supabase/functions/_shared/prompts.ts`

Updated the document analysis prompt with clearer instructions:
- Explicitly tells Claude to complete the JSON structure
- Advises prioritizing quality over quantity if approaching limits
- Instructs to properly close strings before hitting limits
- Adds guidance for handling very long documents

**File**: `supabase/functions/_shared/supabase-client.ts`

Enhanced JSON instructions in all Claude API calls:
```
CRITICAL JSON INSTRUCTIONS:
1. You must respond with valid JSON only. No markdown, no explanation, just the JSON object.
2. Ensure all arrays and objects are properly closed with ] and }.
3. If you are approaching your response limit, prioritize completing the JSON structure over including every detail.
4. Every opening bracket must have a matching closing bracket.
5. Do not truncate mid-string - if you must stop early, end the last string properly with a closing quote.
```

## Testing
To test the fix:

1. Try analyzing a document with the "Analyze Document" button in the Blueprint debug panel
2. Check the browser console for any errors
3. For large documents, the function should now:
   - Complete successfully with repaired JSON (if needed)
   - Log repair attempts in the Edge Function logs
   - Provide better error messages if repair fails

## Benefits
- ✅ Handles truncated Claude responses gracefully
- ✅ Doubles the available output space for complex analyses
- ✅ Better error messages for debugging
- ✅ Automatically recovers from incomplete JSON
- ✅ Works for all document types (PDF, text, combined)

## Future Improvements
If this issue persists with extremely large documents:
1. Consider chunking very large PDFs into smaller sections
2. Implement streaming JSON parsing for real-time processing
3. Add a document size warning before analysis
4. Create a "quick analysis" mode that samples key sections

