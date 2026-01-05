# Quick Start: Create a New Atomic Function

## Copy This Checklist for Each Function

### Step 1: Create Directory
```bash
mkdir -p supabase/functions/{function-name}
```

### Step 2: Copy DIRECTIVES Template
```bash
cp supabase/functions/generate-embedding/DIRECTIVES.md \
   supabase/functions/{function-name}/DIRECTIVES.md
```

### Step 3: Update DIRECTIVES.md

Replace these sections:
- Line 1: `# Function: {function-name}`
- Purpose section: What this specific function does
- Input Contract: Specific input fields from `_shared/types.ts`
- Output Contract: Specific output fields from `_shared/types.ts`
- Dependencies: APIs, database tables this function uses
- Testing Examples: 3-4 realistic test cases

### Step 4: Create index.ts

Use this starter template:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import type { 
  {FunctionName}Input, 
  {FunctionName}Output,
  FunctionError 
} from '../_shared/types.ts';

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. Parse input
    const input: {FunctionName}Input = await req.json();
    
    // 2. Validate input
    if (!input.requiredField) {
      return errorResponse({
        error: 'Required field missing',
        code: 'INVALID_INPUT',
        details: { field: 'requiredField' },
      });
    }

    // 3. Perform operation
    // ... your logic here ...
    
    // 4. Return success response
    const output: {FunctionName}Output = {
      // ... result fields ...
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[{function-name}] Error:', error);
    return errorResponse({
      error: error.message || 'Internal error',
      code: 'INTERNAL_ERROR',
    });
  }
};

function errorResponse(error: FunctionError): Response {
  return new Response(JSON.stringify(error), {
    status: error.code === 'INVALID_INPUT' ? 400 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Wrap with self-healing
serve(withSelfHealing('{function-name}', handler));
```

### Step 5: Extract Logic from Existing Code

**For search functions**: Look in `search-resources/index.ts`
**For analysis functions**: Look in `analyze-document/index.ts`
**For structure functions**: Look in `generate-structure/index.ts`

Find the relevant section (line numbers in HANDOFF_COMPLETE_FUNCTIONS.md) and extract it into your handler.

### Step 6: Test Locally

```bash
supabase functions serve {function-name}
```

Test with curl:
```bash
curl -X POST http://localhost:54321/functions/v1/{function-name} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"field": "value"}'
```

### Step 7: Deploy

```bash
supabase functions deploy {function-name}
```

## Common Patterns

### Database Query
```typescript
const supabase = createSupabaseClient();
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('field', value);

if (error) throw new Error(`Database error: ${error.message}`);
```

### API Call with Retry
```typescript
async function callAPIWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) await sleep(Math.pow(2, i) * 1000);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

### Call Claude AI
```typescript
import { callClaudeJSON } from '../_shared/supabase-client.ts';

const result = await callClaudeJSON<OutputType>(
  systemPrompt,
  userPrompt,
  { temperature: 0.3, maxTokens: 4096 }
);
```

## Checklist Before Marking Complete

- [ ] DIRECTIVES.md has all sections filled out
- [ ] Input/output types match _shared/types.ts
- [ ] Function wrapped with withSelfHealing()
- [ ] CORS preflight handled (OPTIONS)
- [ ] Error responses use standard error codes
- [ ] Tested locally with sample input
- [ ] Console logs use `[function-name]` prefix
- [ ] Deployed successfully to Supabase

## Getting Help

If stuck:
1. Check `generate-embedding/` for complete example
2. Check existing monoliths for working code
3. Check `_shared/types.ts` for correct interfaces
4. Look at `_shared/` utilities for helpers
5. Self-healing will document errors automatically!

