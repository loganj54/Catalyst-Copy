# CORS Fix for Edge Functions

## Problem

The `analyze-document` (and potentially other) edge functions were failing with a CORS error on the first request:

```
Access to fetch at 'https://breeiehhmibttsugorly.supabase.co/functions/v1/analyze-document' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

The request would eventually succeed after retrying, but this caused unnecessary delays and error messages.

## Root Cause

The CORS configuration was incomplete. While we had:
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Headers`

We were missing:
- `Access-Control-Allow-Methods` - **Critical for preflight requests**
- `Access-Control-Max-Age` - Improves performance by caching preflight responses

Additionally, the CORS preflight response (OPTIONS request) was returning status 200 instead of the standard 204 (No Content).

## Solution

### 1. Updated CORS Headers (`supabase/functions/_shared/cors.ts`)

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',  // ✅ ADDED
  'Access-Control-Max-Age': '86400', // ✅ ADDED - Cache preflight for 24 hours
};
```

### 2. Updated OPTIONS Response in All Edge Functions

Changed from:
```typescript
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

To:
```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, { 
    status: 204,  // ✅ Standard status for OPTIONS
    headers: corsHeaders 
  });
}
```

### 3. Files Modified

- ✅ `supabase/functions/_shared/cors.ts`
- ✅ `supabase/functions/analyze-document/index.ts`
- ✅ `supabase/functions/generate-structure/index.ts`
- ✅ `supabase/functions/search-resources/index.ts`
- ✅ `supabase/functions/search-problem-walkthroughs/index.ts`

## How CORS Works

When the browser makes a cross-origin request (e.g., from `localhost:5173` to Supabase), it first sends a **preflight OPTIONS request** to check if the actual request is allowed.

The preflight request asks:
1. "What origins are allowed?" → `Access-Control-Allow-Origin`
2. "What headers can I send?" → `Access-Control-Allow-Headers`
3. "What HTTP methods are allowed?" → `Access-Control-Allow-Methods` ⭐
4. "How long can I cache this response?" → `Access-Control-Max-Age`

Without `Access-Control-Allow-Methods`, the browser couldn't verify that POST requests were allowed, causing the CORS error.

## Deployment

Run one of these scripts to deploy the fix:

**Windows:**
```batch
deploy_cors_fix.bat
```

**Mac/Linux:**
```bash
chmod +x deploy_cors_fix.sh
./deploy_cors_fix.sh
```

**Manual deployment:**
```bash
supabase functions deploy analyze-document --no-verify-jwt
supabase functions deploy generate-structure --no-verify-jwt
supabase functions deploy search-resources --no-verify-jwt
supabase functions deploy search-problem-walkthroughs --no-verify-jwt
```

## Testing

After deployment:

1. Open your app at `http://localhost:5173`
2. Try to analyze a document
3. Open browser DevTools → Network tab
4. You should see:
   - ✅ First request: OPTIONS (preflight) - Status 204
   - ✅ Second request: POST (actual request) - Status 200
   - ✅ No CORS errors
   - ✅ No retries needed

The preflight response will be cached for 24 hours, so subsequent requests won't even need the OPTIONS call.

## Benefits

- ✅ **First-try success**: Requests work immediately without retries
- ✅ **Better performance**: Preflight responses cached for 24 hours
- ✅ **Standards compliant**: Using proper HTTP status codes
- ✅ **Better UX**: No error messages or delays for users
- ✅ **Future-proof**: All HTTP methods are explicitly allowed

## Why It Worked After Retrying

The browser was caching the failed preflight result. On retry, it might have:
1. Bypassed the preflight check (some browsers do this after failures)
2. Successfully received CORS headers on the actual POST response
3. Used a different request pattern that didn't trigger preflight

But now with proper CORS configuration, it works correctly from the start! 🎉

