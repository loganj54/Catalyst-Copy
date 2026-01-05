# HANDOFF: Complete Remaining 26 Atomic Functions

## Mission

Create 26 atomic edge functions for a modular architecture with self-healing capabilities. Infrastructure is 100% complete. Need to create functions following established patterns.

## What's Already Complete ✅

### 1. Self-Healing Infrastructure (All Done)
- `supabase/migrations/20260105_create_self_healing_tables.sql` - Database tables
- `supabase/functions/_shared/types.ts` - All TypeScript interfaces for 26 functions
- `supabase/functions/_shared/self-healing-config.ts` - Mode toggle system
- `supabase/functions/_shared/production-lock.ts` - Snapshot verification
- `supabase/functions/_shared/error-wrapper.ts` - Automatic error handling
- `supabase/functions/_shared/self-healing-agent.ts` - AI-powered fixes

### 2. Example Functions (Templates to Follow)
- ✅ `generate-embedding/` - Complete with DIRECTIVES.md + index.ts
- ✅ `search-db-cache/DIRECTIVES.md` - Specification ready

### 3. Existing Monolithic Functions (Source Material)
These contain the working code to extract from:
- `search-resources/index.ts` (~1345 lines)
- `analyze-document/index.ts` (~638 lines)
- `generate-structure/index.ts` (~1233 lines)

## Required Pattern for Every Function

### File Structure
```
supabase/functions/{function-name}/
├── DIRECTIVES.md    (Complete specification)
└── index.ts         (Implementation with self-healing)
```

### index.ts Template
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSelfHealing } from '../_shared/error-wrapper.ts';
import type { FunctionInput, FunctionOutput } from '../_shared/types.ts';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const input: FunctionInput = await req.json();
    
    // 1. Validate input
    // 2. Perform operation
    // 3. Return output
    
    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      code: 'INTERNAL_ERROR',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(withSelfHealing('function-name', handler));
```

### DIRECTIVES.md Template
See `generate-embedding/DIRECTIVES.md` for the complete template. Must include:
- Metadata (version, status)
- Purpose (one sentence)
- Responsibility (what it does/doesn't do)
- Input Contract (TypeScript + JSON example + validation rules)
- Output Contract (TypeScript + success/error examples)
- Behavior Specification (normal flow, edge cases, performance)
- Dependencies (APIs, database tables, env vars)
- Error Handling (error codes, recovery strategies)
- Testing Examples (3-4 test cases)
- Known Issues & Fixes (empty initially, filled by self-healing)
- Change History

## Functions to Create (26 Total)

### Category A: Search Resource Functions (10 functions)

#### 1. ✅ generate-embedding (DONE - use as template)
**Already complete** - generates embeddings from text

#### 2. search-db-cache (DIRECTIVES done, need index.ts)
**Extract from**: search-resources/index.ts lines 893-907
**Purpose**: Vector similarity search in curated_resources table
**Key logic**: Call `search_similar_resources` RPC with embedding

#### 3. search-youtube
**Extract from**: search-resources/index.ts lines 169-294
**Purpose**: Search YouTube Data API v3
**Key logic**: Build queries, call YouTube API, parse results
**Env vars**: YOUTUBE_API_KEY

#### 4. search-grok (NEW - create from scratch)
**Similar to**: search-claude-web pattern
**Purpose**: Search using Grok AI API
**Key logic**: Call Grok API with queries, parse video results
**Env vars**: GROK_API_KEY

#### 5. search-claude-web
**Extract from**: search-resources/index.ts lines 304-616
**Purpose**: Use Claude web search tool to find videos
**Key logic**: Call Claude with web_search tool enabled
**Env vars**: ANTHROPIC_API_KEY

#### 6. analyze-transcript
**Extract from**: search-resources/index.ts lines 997-1067
**Purpose**: Fetch YouTube transcript and analyze with AI
**Key logic**: Fetch transcript, call Claude for analysis
**Dependencies**: Uses _shared/transcript.ts, _shared/content-analyzer.ts

#### 7. store-resource
**Extract from**: search-resources/index.ts lines 1121-1180
**Purpose**: Store resource with embedding in curated_resources table
**Key logic**: Upsert resource, handle duplicates by URL

#### 8. link-resource-to-blueprint
**Extract from**: search-resources/index.ts lines 1210-1234
**Purpose**: Create junction table entry linking resource to blueprint
**Key logic**: Upsert to blueprint_topic_resources table

#### 9. generate-resource-explanations
**Extract from**: search-resources/index.ts lines 664-825
**Purpose**: Generate AI explanations for resource relevance
**Key logic**: Call Claude to explain why each resource is relevant

#### 10. orchestrate-search-resources
**Purpose**: Compose all 9 search functions into complete workflow
**Flow**: 
1. Call generate-embedding
2. Call search-db-cache
3. If cache miss, call search-youtube or search-claude-web
4. Call analyze-transcript for each resource
5. Call store-resource for each
6. Call link-resource-to-blueprint for each
7. Call generate-resource-explanations
8. Return results

### Category B: Document Analysis Functions (7 functions)

#### 11. fetch-document
**Extract from**: analyze-document/index.ts lines 299-441
**Purpose**: Download document from Supabase storage
**Key logic**: Parse URL, fetch with auth, handle public/private buckets

#### 12. parse-pdf-to-base64
**Extract from**: analyze-document/index.ts lines 394-408
**Purpose**: Convert PDF ArrayBuffer to base64 for Claude vision
**Key logic**: Convert buffer to base64, check size limits

#### 13. analyze-with-claude
**Extract from**: analyze-document/index.ts lines 454-462
**Purpose**: Call Claude with vision for document analysis
**Key logic**: Use callClaudeWithPDFAndText helper from _shared
**Dependencies**: Uses _shared/prompts.ts

#### 14. store-analysis
**Extract from**: analyze-document/index.ts lines 489-522
**Purpose**: Store analysis in document_analyses table
**Key logic**: Insert analysis with derived fields

#### 15. generate-blueprint-name
**Extract from**: analyze-document/index.ts lines 527-565
**Purpose**: Generate AI name for blueprint based on analysis
**Key logic**: Call Claude with naming prompt

#### 16. check-existing-analysis
**Extract from**: analyze-document/index.ts lines 224-238
**Purpose**: Check if document already has analysis
**Key logic**: Query document_analyses by document_id

#### 17. orchestrate-analyze-document
**Purpose**: Compose all 6 analysis functions
**Flow**:
1. Call check-existing-analysis
2. If exists and not force_reanalyze, return cached
3. Call fetch-document
4. If PDF, call parse-pdf-to-base64
5. Call analyze-with-claude
6. Call store-analysis
7. Call generate-blueprint-name
8. Return analysis

### Category C: Structure Generation Functions (9 functions)

#### 18. fetch-analysis
**Extract from**: generate-structure/index.ts lines 772-894
**Purpose**: Get document analysis by blueprint_id or document_id
**Key logic**: Try multiple search strategies (document_id, blueprint_id, filename)

#### 19. check-structure-cache
**Extract from**: generate-structure/index.ts line 929
**Purpose**: Check for similar cached structure using vector similarity
**Dependencies**: Uses _shared/structure-cache.ts checkStructureCache()

#### 20. adapt-cached-structure
**Extract from**: generate-structure/index.ts line 938
**Purpose**: Adapt cached structure to new document
**Dependencies**: Uses _shared/structure-cache.ts adaptCachedStructure()

#### 21. generate-structure-with-ai
**Extract from**: generate-structure/index.ts lines 1066-1077
**Purpose**: Generate learning structure from scratch with Claude
**Key logic**: Call callClaudeJSON with structure generation prompt
**Dependencies**: Uses _shared/prompts.ts

#### 22. process-equations
**Extract from**: generate-structure/index.ts lines 1095-1116
**Purpose**: Find/create equations and link to units
**Key logic**: Already extracted to function processStructureEquations()

#### 23. source-figures
**Extract from**: generate-structure/index.ts lines 1119-1127
**Purpose**: Find/create figures from Wikimedia
**Dependencies**: Uses _shared/figure-sourcing.ts

#### 24. store-structure
**Extract from**: generate-structure/index.ts lines 1129-1157
**Purpose**: Store structure in blueprint_structures table
**Key logic**: Insert with metrics calculated

#### 25. cache-structure
**Extract from**: generate-structure/index.ts line 1168
**Purpose**: Store structure for future reuse
**Dependencies**: Uses _shared/structure-cache.ts cacheNewStructure()

#### 26. orchestrate-generate-structure
**Purpose**: Compose all 8 structure functions
**Flow**:
1. Call fetch-analysis
2. Call check-structure-cache
3. If cache hit, call adapt-cached-structure
4. If cache miss, call generate-structure-with-ai
5. Call process-equations
6. Call source-figures
7. Call store-structure
8. Call cache-structure
9. Return structure

## Critical Implementation Details

### Error Handling
Every function MUST:
- Be wrapped with `withSelfHealing('function-name', handler)`
- Return proper error codes: INVALID_INPUT, API_ERROR, DATABASE_ERROR, TIMEOUT, etc.
- Handle CORS preflight (OPTIONS request)

### Type Safety
- Import types from `_shared/types.ts`
- Use TypeScript interfaces for input/output
- All 26 function types are already defined in types.ts

### Environment Variables
Commonly used:
- `ANTHROPIC_API_KEY` - Claude API
- `OPENAI_API_KEY` - OpenAI embeddings
- `YOUTUBE_API_KEY` - YouTube Data API
- `SUPABASE_URL` - Database URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service key

### Shared Utilities Available
Located in `supabase/functions/_shared/`:
- `cors.ts` - CORS headers
- `embeddings.ts` - Embedding generation helpers
- `supabase-client.ts` - Database client creation
- `prompts.ts` - AI prompts for Claude
- `transcript.ts` - YouTube transcript fetching
- `content-analyzer.ts` - Transcript analysis
- `structure-cache.ts` - Structure caching
- `figure-sourcing.ts` - Wikimedia figure search
- `section-cache.ts` - Section-level caching

## Success Criteria

Each function must have:
1. ✅ DIRECTIVES.md with all sections filled
2. ✅ index.ts with implementation
3. ✅ Wrapped with withSelfHealing()
4. ✅ Proper error handling and validation
5. ✅ TypeScript types from _shared/types.ts
6. ✅ CORS handling
7. ✅ Clear logging with function name prefix

## Testing After Creation

For each function:
1. Deploy to Supabase: `supabase functions deploy {function-name}`
2. Test with curl or Postman
3. Verify errors are logged to function_errors table
4. Check self-healing triggers in development mode

## Order of Implementation

Recommended order:
1. **Search functions first** (most interconnected)
2. **Orchestrate-search-resources** (validates search functions work together)
3. **Analysis functions** (simpler, good practice)
4. **Orchestrate-analyze-document**
5. **Structure functions** (most complex)
6. **Orchestrate-generate-structure**

## Quick Reference

### Where to find existing code:
- Search logic: `search-resources/index.ts`
- Analysis logic: `analyze-document/index.ts`
- Structure logic: `generate-structure/index.ts`

### Templates to copy:
- DIRECTIVES: `generate-embedding/DIRECTIVES.md`
- Implementation: `generate-embedding/index.ts`

### Types already defined:
- All in `_shared/types.ts` - just import what you need

## Final Notes

- **Don't reinvent** - extract working code from monoliths
- **Keep functions small** - single responsibility only
- **Use existing helpers** - _shared/ has many utilities
- **Follow the template** - consistency is key
- **Self-healing will help** - errors automatically improve docs

Good luck! The infrastructure is solid, patterns are established, now it's just systematic extraction and wrapping.

