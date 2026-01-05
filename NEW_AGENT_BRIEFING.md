# NEW AGENT BRIEFING: Complete 26 Atomic Functions

## TL;DR - What You Need to Do

Create 24 remaining atomic edge functions (2 already done). All infrastructure is complete. Just extract code from existing monoliths, wrap with self-healing, and write DIRECTIVES.md for each.

## Files You MUST Read First

1. **`HANDOFF_COMPLETE_FUNCTIONS.md`** - Complete specifications for all 26 functions
2. **`QUICKSTART_CREATE_FUNCTION.md`** - Step-by-step template for creating each function
3. **`generate-embedding/DIRECTIVES.md`** - Perfect example of DIRECTIVES format
4. **`generate-embedding/index.ts`** - Perfect example of implementation
5. **`_shared/types.ts`** - All TypeScript interfaces already defined

## What's Already Complete (Do NOT recreate these)

### Infrastructure (100% Done)
- ✅ Database tables for self-healing
- ✅ All TypeScript types in `_shared/types.ts`
- ✅ Self-healing agent system
- ✅ Production lock mechanism
- ✅ Error wrapper with mode detection

### Example Functions (Templates)
- ✅ `generate-embedding/` - Complete function
- ✅ `search-db-cache/DIRECTIVES.md` - Specification ready

## Your Task: Create These 24 Functions

### Phase 1: Search Functions (8 remaining)
1. ⏳ `search-db-cache` - Need index.ts only (DIRECTIVES done)
2. ⏳ `search-youtube`
3. ⏳ `search-grok` (NEW)
4. ⏳ `search-claude-web`
5. ⏳ `analyze-transcript`
6. ⏳ `store-resource`
7. ⏳ `link-resource-to-blueprint`
8. ⏳ `generate-resource-explanations`

### Phase 2: Orchestrator
9. ⏳ `orchestrate-search-resources` - Composes above 8 functions

### Phase 3: Analysis Functions (6 remaining)
10. ⏳ `fetch-document`
11. ⏳ `parse-pdf-to-base64`
12. ⏳ `analyze-with-claude`
13. ⏳ `store-analysis`
14. ⏳ `generate-blueprint-name`
15. ⏳ `check-existing-analysis`

### Phase 4: Orchestrator
16. ⏳ `orchestrate-analyze-document` - Composes above 6 functions

### Phase 5: Structure Functions (8 remaining)
17. ⏳ `fetch-analysis`
18. ⏳ `check-structure-cache`
19. ⏳ `adapt-cached-structure`
20. ⏳ `generate-structure-with-ai`
21. ⏳ `process-equations`
22. ⏳ `source-figures`
23. ⏳ `store-structure`
24. ⏳ `cache-structure`

### Phase 6: Orchestrator
25. ⏳ `orchestrate-generate-structure` - Composes above 8 functions

## How to Work Efficiently

### Strategy 1: Batch Similar Functions
Create 3-4 similar functions at a time:
- Group 1: Database operations (search-db-cache, store-resource, store-analysis)
- Group 2: API calls (search-youtube, search-claude-web, search-grok)
- Group 3: AI analysis (analyze-transcript, analyze-with-claude, generate-resource-explanations)
- Group 4: Orchestrators (compose the atomic functions)

### Strategy 2: Extract Then Refactor
For each function:
1. Find the code in the monolith (line numbers in HANDOFF doc)
2. Copy the relevant section
3. Refactor to match the function signature from types.ts
4. Wrap with `withSelfHealing()`
5. Write DIRECTIVES.md

### Strategy 3: Copy-Paste-Modify Template
1. Copy `generate-embedding/` directory
2. Rename to new function name
3. Update DIRECTIVES.md (search & replace function name)
4. Replace the implementation logic
5. Test

## Key Files to Reference

### Source Code (Extract From)
- `supabase/functions/search-resources/index.ts` - Search functions
- `supabase/functions/analyze-document/index.ts` - Analysis functions
- `supabase/functions/generate-structure/index.ts` - Structure functions

### Infrastructure (Already Done)
- `supabase/functions/_shared/types.ts` - All interfaces
- `supabase/functions/_shared/error-wrapper.ts` - withSelfHealing()
- `supabase/functions/_shared/cors.ts` - CORS headers
- `supabase/functions/_shared/supabase-client.ts` - DB helpers

### Templates (Copy From)
- `generate-embedding/DIRECTIVES.md` - Documentation template
- `generate-embedding/index.ts` - Implementation template

## Critical Requirements

Every function MUST have:

1. **DIRECTIVES.md** with these sections:
   - Metadata
   - Purpose (1 sentence)
   - Responsibility  
   - Input Contract (TypeScript + JSON example)
   - Output Contract (TypeScript + success/error examples)
   - Behavior Specification
   - Dependencies
   - Error Handling
   - Testing Examples (3-4 cases)
   - Known Issues (empty initially)
   - Change History

2. **index.ts** with:
   ```typescript
   import { withSelfHealing } from '../_shared/error-wrapper.ts';
   import type { Input, Output } from '../_shared/types.ts';
   
   const handler = async (req: Request) => { /* logic */ };
   
   serve(withSelfHealing('function-name', handler));
   ```

3. **Error handling**:
   - CORS preflight (OPTIONS request)
   - Input validation
   - Standard error codes (INVALID_INPUT, API_ERROR, DATABASE_ERROR, etc.)
   - Try-catch wrapper

4. **Type safety**:
   - Import types from _shared/types.ts
   - Type input parameters
   - Type output response

## Validation Checklist

Before marking a function as complete:
- [ ] DIRECTIVES.md exists and is complete
- [ ] index.ts exists and compiles
- [ ] Wrapped with withSelfHealing()
- [ ] Types match _shared/types.ts
- [ ] CORS handled
- [ ] Error codes used correctly
- [ ] Console logs use `[function-name]` prefix
- [ ] Can be called with sample input (even if not deployed)

## Expected Output

When done, you should have:
- 26 directories in `supabase/functions/`
- Each with DIRECTIVES.md + index.ts
- All following the same pattern
- Ready to deploy with `supabase functions deploy {name}`

## Time Estimate

- Per function: 10-20 minutes (with extraction)
- Total: 24 functions × 15 min = ~6 hours
- With batching: Could be done in 4-5 hours

## Success Criteria

You've succeeded when:
1. All 26 function directories exist
2. Each has complete DIRECTIVES.md
3. Each has working index.ts
4. All functions can be deployed
5. Orchestrators compose their atomic functions correctly

## Questions?

Refer back to:
- `HANDOFF_COMPLETE_FUNCTIONS.md` - Detailed specs
- `QUICKSTART_CREATE_FUNCTION.md` - How-to guide
- `generate-embedding/` - Working example

## Start Here

I recommend starting with:
1. **search-db-cache** (DIRECTIVES done, just need index.ts)
2. **store-resource** (simple database write)
3. **search-youtube** (API call, similar to generate-embedding pattern)

Then move to orchestrators once you have a few atomic functions working.

Good luck! The foundation is solid - you're just building the rest of the house.

