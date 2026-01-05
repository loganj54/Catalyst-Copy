# Modular Function Architecture - Complete Implementation Plan

## ✅ Phase 1 COMPLETE: Infrastructure (100%)

### Database & Configuration
- ✅ `20260105_create_self_healing_tables.sql` - All tables created
- ✅ Self-healing system ready for both development and production modes

### Shared Infrastructure Files
- ✅ `_shared/types.ts` - All 26 function interfaces defined
- ✅ `_shared/self-healing-config.ts` - Mode detection & toggle
- ✅ `_shared/production-lock.ts` - Snapshot creation & integrity verification  
- ✅ `_shared/error-wrapper.ts` - Automatic error logging & healing trigger
- ✅ `_shared/self-healing-agent.ts` - AI-powered error analysis & fixes

### Example Function Created
- ✅ `generate-embedding/DIRECTIVES.md` - Complete specification
- ✅ `generate-embedding/index.ts` - Full implementation with self-healing wrapper

## 📋 Remaining Work: 25 More Functions

You now have a **complete template** in `generate-embedding/` that shows the exact pattern to follow for all other functions. Each function needs:

1. **DIRECTIVES.md** - Copy the template structure, update for specific function
2. **index.ts** - Implement logic, wrap with `withSelfHealing(functionName, handler)`

### Pattern to Follow

```typescript
// index.ts structure:
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import type { FunctionInput, FunctionOutput } from '../_shared/types.ts';

const handler = async (req: Request): Promise<Response> => {
  // 1. Parse input
  // 2. Validate input
  // 3. Perform operation
  // 4. Return formatted output
};

serve(withSelfHealing('function-name', handler));
```

## 🎯 Next Steps - Choose Your Approach

### Option A: Manual Creation (Recommended for Learning)
Use `generate-embedding/` as your template and create each function one-by-one. Benefits:
- Full control and understanding
- Can test each function thoroughly
- Learn the architecture deeply

### Option B: Batch Generation with AI
Provide the template to an AI code generator and create multiple functions at once. Benefits:
- Faster completion
- Consistent structure
- Can generate 3-5 functions at a time

### Option C: Extract from Existing Code
Since you have working monoliths, extract and refactor existing logic:
1. Copy relevant code from `search-resources/index.ts`
2. Split into atomic pieces
3. Wrap each with `withSelfHealing()`
4. Write DIRECTIVES.md for each

## 📊 Function Checklist

### Search Resource Functions (9 remaining)
- ✅ `generate-embedding` - **COMPLETE** (template)
- ⏳ `search-db-cache` - Extract from search-resources L893-907
- ⏳ `search-youtube` - Extract from search-resources L169-294
- ⏳ `search-grok` - **NEW** (create from scratch, similar to search-claude-web)
- ⏳ `search-claude-web` - Extract from search-resources L304-616
- ⏳ `analyze-transcript` - Extract from search-resources L997-1067
- ⏳ `store-resource` - Extract from search-resources L1121-1180
- ⏳ `link-resource-to-blueprint` - Extract from search-resources L1210-1234
- ⏳ `generate-resource-explanations` - Extract from search-resources L664-825

### Orchestrator
- ⏳ `orchestrate-search-resources` - Compose all 9 search functions

### Document Analysis Functions (6 remaining)
- ⏳ `fetch-document` - Extract from analyze-document L299-441
- ⏳ `parse-pdf-to-base64` - Extract from analyze-document L394-408
- ⏳ `analyze-with-claude` - Extract from analyze-document L454-462
- ⏳ `store-analysis` - Extract from analyze-document L489-522
- ⏳ `generate-blueprint-name` - Extract from analyze-document L527-565
- ⏳ `check-existing-analysis` - Extract from analyze-document L224-238

### Orchestrator
- ⏳ `orchestrate-analyze-document` - Compose all 6 analysis functions

### Structure Generation Functions (8 remaining)
- ⏳ `fetch-analysis` - Extract from generate-structure L772-894
- ⏳ `check-structure-cache` - Extract from generate-structure L929 (uses _shared/structure-cache.ts)
- ⏳ `adapt-cached-structure` - Extract from generate-structure L938 (uses _shared/structure-cache.ts)
- ⏳ `generate-structure-with-ai` - Extract from generate-structure L1066-1077
- ⏳ `process-equations` - Extract from generate-structure L1095 (uses existing helper)
- ⏳ `source-figures` - Extract from generate-structure L1119 (uses _shared/figure-sourcing.ts)
- ⏳ `store-structure` - Extract from generate-structure L1129-1157
- ⏳ `cache-structure` - Extract from generate-structure L1168 (uses _shared/structure-cache.ts)

### Orchestrator
- ⏳ `orchestrate-generate-structure` - Compose all 8 structure functions

## 🚀 Quick Start Guide

### To Create a New Function:

1. **Create directory**: `supabase/functions/{function-name}/`

2. **Copy DIRECTIVES template**: 
   ```bash
   cp supabase/functions/generate-embedding/DIRECTIVES.md \
      supabase/functions/{function-name}/DIRECTIVES.md
   ```

3. **Update DIRECTIVES.md**: Change all function-specific details

4. **Create index.ts**: Follow the pattern in `generate-embedding/index.ts`

5. **Test**: The function is automatically wrapped with self-healing!

## 💡 Key Benefits Already Active

- ✅ **Self-healing enabled**: Any error in any function is automatically logged
- ✅ **Development mode**: Errors trigger AI analysis and DIRECTIVES updates
- ✅ **Production toggle**: Can switch to locked mode anytime with snapshot
- ✅ **Type safety**: All interfaces defined in `_shared/types.ts`
- ✅ **Consistent error handling**: All functions use same error codes

## 📈 Estimated Time

- **Per function**: 15-30 minutes (using template)
- **Total remaining**: 25 functions × 20 min = ~8 hours
- **With AI assistance**: Could be reduced to 3-4 hours

## Current Status

```
Infrastructure:     ████████████████████ 100% ✅
Functions Created:  █░░░░░░░░░░░░░░░░░░░   4% (1/26)
Orchestrators:      ░░░░░░░░░░░░░░░░░░░░   0% (0/3)
Frontend Integration: Not started
Testing:            Not started
```

## Next Immediate Action

**I recommend**: Create 3-4 more search functions next since they're similar to `generate-embedding` and will establish the pattern. Start with:

1. `search-db-cache` - Simple database query
2. `store-resource` - Simple database write
3. `search-youtube` - API call with retries (similar pattern to generate-embedding)

Would you like me to create these next 3 functions?

