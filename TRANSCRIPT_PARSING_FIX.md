# Transcript Parsing Fix

## Problem Identified

The SupaData API was returning transcripts in a **JSON array format** with timing information:

```json
[
  {"text":"in this video we will be talking to about how to find out the overall","offset":8620,"duration":4080},
  {"text":"heat transfer coefficient inside ansys fluent so in this tutorial we will be dealing with","offset":12700,"duration":5340},
  ...
]
```

However, the code was treating this as plain text and storing it directly in the database. When Grok analyzed these "transcripts", it was analyzing the JSON structure itself rather than the actual spoken content, resulting in useless analysis like:

> "The provided transcript consists solely of JSON-like object notation that doesn't actually consist of anything useful."

## Root Cause

In both `load-resources-database/index.ts` and `_shared/transcript.ts`, the code was:

1. Fetching the transcript from SupaData API
2. Extracting the raw data: `data.transcript || data.text || data.content`
3. Storing/using it directly without parsing the array format

## Solution Implemented

### 1. Added `parseTranscriptSegments()` function (in load-resources-database)

```typescript
function parseTranscriptSegments(transcriptData: any): string {
  // If it's already a string, return it
  if (typeof transcriptData === 'string') {
    return transcriptData;
  }

  // If it's an array of segments, extract the text
  if (Array.isArray(transcriptData)) {
    const textSegments = transcriptData
      .filter(segment => segment && segment.text)
      .map(segment => segment.text.trim())
      .filter(text => text.length > 0);
    
    return textSegments.join(' ');
  }

  // If it's an object with a text property
  if (transcriptData && typeof transcriptData === 'object' && transcriptData.text) {
    return transcriptData.text;
  }

  // Fallback: try to stringify and extract
  return String(transcriptData);
}
```

### 2. Added `parseTranscriptData()` function (in _shared/transcript.ts)

Similar parsing logic with additional safety checks for the shared module.

### 3. Updated transcript extraction logic

**Before:**
```typescript
const transcript = data.transcript || data.text || data.content || '';
return transcript;
```

**After:**
```typescript
const rawTranscript = data.transcript || data.text || data.content || '';
const transcript = parseTranscriptSegments(rawTranscript);
console.log(`[SupaData] First 200 chars: ${transcript.substring(0, 200)}...`);
return transcript;
```

## Files Modified

1. **`supabase/functions/load-resources-database/index.ts`**
   - Added `parseTranscriptSegments()` helper function
   - Updated `getTranscriptWithSupaData()` to parse array format
   - Added logging to show first 200 characters of parsed transcript

2. **`supabase/functions/_shared/transcript.ts`**
   - Added `parseTranscriptData()` helper function
   - Updated `fetchTranscript()` to parse array format
   - Added logging for verification

## Expected Results

### Before Fix
- **Stored transcript**: `[{"text":"in this video...","offset":8620,"duration":4080},...]`
- **Grok analysis**: "The provided transcript consists solely of JSON-like object notation..."
- **Search quality**: Poor (no meaningful content indexed)

### After Fix
- **Stored transcript**: `"in this video we will be talking to about how to find out the overall heat transfer coefficient inside ansys fluent..."`
- **Grok analysis**: Proper analysis of actual video content with specific concepts, formulas, and topics
- **Search quality**: Excellent (meaningful content properly indexed)

## Deployment

Run the deployment script:

```bash
deploy_transcript_fix.bat
```

Or manually:

```bash
npx supabase functions deploy load-resources-database --no-verify-jwt
```

Note: The `_shared/transcript.ts` file is automatically included when deploying any function that imports it.

## Testing

1. **Load a new video resource** using the `load-resources-database` function
2. **Check the logs** for:
   ```
   [SupaData] First 200 chars: in this video we will be talking to about how to find out the overall heat transfer coefficient...
   ```
3. **Verify in database** that the `transcript` column contains plain text, not JSON
4. **Check Grok analysis** to ensure it contains meaningful content analysis

## Verification Query

```sql
-- Check a recently loaded resource
SELECT 
  title,
  LEFT(transcript, 200) as transcript_preview,
  summary,
  key_phrases
FROM resources_from_make
ORDER BY created_at DESC
LIMIT 1;
```

The `transcript_preview` should show plain text, not JSON array notation.

## Additional Notes

- The fix handles **multiple formats**:
  - Plain text strings (already working)
  - Array of segment objects (now fixed)
  - Nested objects with text properties
- **Backward compatible**: Existing plain text transcripts continue to work
- **Robust**: Includes fallback handling for unexpected formats
- **Logged**: Added debug output to verify parsing is working correctly

