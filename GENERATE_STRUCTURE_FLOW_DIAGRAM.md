# Generate Structure Flow - Visual Diagram

## 🎯 Current Flow (With Issues Highlighted)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER CLICKS BUTTON                          │
│                    "Generate Structure" (Step 2)                    │
│                     Location: Blueprint.jsx                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         UI SENDS REQUEST                            │
│   POST /functions/v1/generate-structure                            │
│   Body: { blueprint_id: "uuid-123" }                               │
│   Headers: { Authorization: "Bearer token" }                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ⚠️  ISSUE #1: FUNCTION ROUTING  ⚠️
┌─────────────────────────────────────────────────────────────────────┐
│              Which function actually executes?                      │
│                                                                     │
│   Option A: generate-structure (DOES NOT EXIST ❌)                 │
│   Option B: generate-structure-legacy (EXISTS ✅)                  │
│   Option C: orchestrate-generate-structure (EXISTS ✅ NOT USED)    │
│                                                                     │
│   🔍 UNCLEAR - Need to check deployment config                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
          Assuming generate-structure-legacy is called...
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 1: FETCH BLUEPRINT                          │
│   SELECT * FROM blueprints WHERE id = blueprint_id                 │
│                                                                     │
│   ✅ Success → Continue                                            │
│   ❌ Failure → Return 500 error                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ⚠️  ISSUE #2: ANALYSIS LOOKUP  ⚠️
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 2: FIND DOCUMENT ANALYSIS                         │
│          (Tries 4 different strategies!)                            │
│                                                                     │
│   Strategy 1: By document_id                                       │
│   ├─ SELECT * FROM document_analyses                               │
│   └─ WHERE document_id = blueprint.document_id                     │
│                                                                     │
│   Strategy 2: By blueprint_id                                      │
│   ├─ SELECT * FROM document_analyses                               │
│   └─ WHERE blueprint_id = blueprint_id                             │
│                                                                     │
│   Strategy 3: By filename (fuzzy match!)                           │
│   ├─ SELECT * FROM document_analyses                               │
│   ├─ WHERE class_id = blueprint.class_id                           │
│   └─ AND file_name ILIKE '%filename%'                              │
│                                                                     │
│   Strategy 4: By class_id (gets most recent!)                      │
│   ├─ SELECT * FROM document_analyses                               │
│   ├─ WHERE class_id = blueprint.class_id                           │
│   ├─ ORDER BY created_at DESC                                      │
│   └─ LIMIT 1                                                       │
│                                                                     │
│   ✅ Found → Continue                                              │
│   ❌ Not Found → Return error "No analysis found"                  │
│                                                                     │
│   🐛 WHY THIS FAILS:                                               │
│   • Multiple blueprints share same document → wrong analysis       │
│   • document_id is null → relies on fuzzy match                    │
│   • Class has multiple documents → gets wrong one                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 3: DELETE EXISTING STRUCTURE                      │
│   DELETE FROM blueprint_structures                                 │
│   WHERE blueprint_id = blueprint_id                                │
│                                                                     │
│   ⚠️  Failure logged but ignored - continues anyway               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 4: CHECK STRUCTURE CACHE                          │
│   Generate embedding for analysis                                  │
│   Vector search in cached_blueprint_structures                     │
│   Similarity threshold: 92%                                        │
│                                                                     │
│   Time: ~500ms                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
         ✅ CACHE HIT (92%+)          ❌ CACHE MISS
                    │                           │
                    ▼                           │
    ┌───────────────────────────────┐          │
    │  STEP 5A: ADAPT CACHED        │          │
    │  STRUCTURE                    │          │
    │                               │          │
    │  • Keep learning flow         │          │
    │  • Update titles              │          │
    │  • Adjust section IDs         │          │
    │  • Update search queries      │          │
    │                               │          │
    │  Time: ~200-500ms             │          │
    │  Token savings: ~24k tokens   │          │
    └───────────────────────────────┘          │
                    │                           │
                    │                           ▼
                    │         ┌─────────────────────────────────┐
                    │         │  STEP 5B: GENERATE WITH AI      │
                    │         │                                 │
                    │         │  Call Claude Haiku 4.5          │
                    │         │  Prompt: GENERATE_STRUCTURE     │
                    │         │  Input: Analysis JSON           │
                    │         │  Output: Structure JSON         │
                    │         │                                 │
                    │         │  Time: ~10-20 seconds           │
                    │         │  Cost: ~24k tokens (~$0.06)     │
                    │         │                                 │
                    │         │  ⚠️  FAILURE POINTS:            │
                    │         │  • API timeout                  │
                    │         │  • Invalid JSON response        │
                    │         │  • Rate limiting                │
                    │         │  • Token limit exceeded         │
                    │         └─────────────────────────────────┘
                    │                           │
                    └───────────┬───────────────┘
                                │
                                ▼
                    ⚠️  ISSUE #3: CACHE FAILURES  ⚠️
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 6: PROCESS EQUATIONS                              │
│   Extract equations from structure                                 │
│   Check curated_equations cache                                    │
│   Create new equations if needed                                   │
│   Link to blueprint_unit_equations                                 │
│                                                                     │
│   ⚠️  Failures caught and logged - continues anyway               │
│                                                                     │
│   🐛 WHY THIS CAUSES ISSUES:                                       │
│   • Equation processing fails silently                             │
│   • Structure saved without equations                              │
│   • User sees incomplete structure                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 7: SOURCE FIGURES                                 │
│   Extract figure suggestions from structure                        │
│   Search Wikimedia Commons                                         │
│   Check curated_figures cache                                      │
│   Link to blueprint_unit_figures                                   │
│                                                                     │
│   ⚠️  Failures caught and logged - continues anyway               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ⚠️  ISSUE #4: CRITICAL FAILURE  ⚠️
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 8: STORE STRUCTURE IN DATABASE                    │
│                                                                     │
│   INSERT INTO blueprint_structures (                               │
│     blueprint_id,                                                  │
│     user_id,                                                       │
│     analysis_id,  ← Foreign key constraint!                        │
│     structure,    ← JSONB (max 1MB!)                               │
│     model_used,                                                    │
│     total_prerequisites,                                           │
│     total_sections,                                                │
│     total_learning_units,                                          │
│     total_search_queries,                                          │
│     from_cache                                                     │
│   )                                                                │
│                                                                     │
│   ⚠️  FAILURE POINTS:                                              │
│   • Structure JSON > 1MB → Postgres limit exceeded                 │
│   • analysis_id doesn't exist → Foreign key violation              │
│   • RLS policy blocks insert → Permission denied                   │
│   • Unique constraint → Duplicate entry                            │
│                                                                     │
│   🐛 WHY THIS CAUSES "SUCCESS BUT NOTHING APPEARS":                │
│   • If this fails AFTER AI generation/cache adaptation             │
│   • Error might be caught by outer try/catch                       │
│   • Response might still return { success: true }                  │
│   • But NO DATA in database!                                       │
│                                                                     │
│   ✅ Success → Continue                                            │
│   ❌ Failure → Throw error (but might be caught!)                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 9: CACHE STRUCTURE FOR FUTURE                     │
│   INSERT INTO cached_blueprint_structures                          │
│   Generate embeddings                                              │
│   Store for future reuse                                           │
│                                                                     │
│   ⚠️  Failures caught and logged - non-critical                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 10: UPDATE BLUEPRINT STATUS                       │
│   UPDATE blueprints                                                │
│   SET generation_status = 'completed'                              │
│   WHERE id = blueprint_id                                          │
│                                                                     │
│   ⚠️  Can fail silently - no error thrown                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RETURN RESPONSE TO UI                            │
│                                                                     │
│   Success Response (200):                                          │
│   {                                                                │
│     success: true,                                                 │
│     structure_id: "uuid-456",                                      │
│     structure: { ... },                                            │
│     metrics: { ... },                                              │
│     from_cache: true/false                                         │
│   }                                                                │
│                                                                     │
│   Error Response (500):                                            │
│   {                                                                │
│     success: false,                                                │
│     error: "Error message"                                         │
│   }                                                                │
│                                                                     │
│   🐛 ISSUE: Error handling is inconsistent!                        │
│   • Some errors update blueprint.generation_status                 │
│   • Some errors don't                                              │
│   • Some errors return 500, some return 200                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UI RECEIVES RESPONSE                             │
│                                                                     │
│   if (data.success) {                                              │
│     setStructureGenerationResult(data);                            │
│     await fetchBlueprint(); ← Fetches from DB                      │
│   } else {                                                         │
│     throw new Error(data.error);                                   │
│   }                                                                │
│                                                                     │
│   🐛 ISSUE: UI trusts success flag!                                │
│   • If success=true but DB insert failed                           │
│   • fetchBlueprint() returns no structure                          │
│   • User sees "success" but empty page                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔥 Failure Scenarios Explained

### Scenario 1: "Didn't work at all"
```
User clicks button
  → Function can't find analysis (Issue #2)
  → Returns error immediately
  → UI shows error message
  → User sees failure
```

### Scenario 2: "Worked 2 minutes later"
```
First attempt:
  → Analysis lookup fails (wrong strategy)
  → Returns error
  
Second attempt (2 min later):
  → Different lookup strategy succeeds
  → Finds analysis
  → Generates structure
  → Success!
```

### Scenario 3: "Worked first try but structure was wrong"
```
User clicks button
  → Analysis lookup uses Strategy 4 (by class_id)
  → Gets MOST RECENT analysis for class
  → But that's for a DIFFERENT document!
  → Generates structure for wrong document
  → User sees wrong content
```

### Scenario 4: "Said success but nothing appeared"
```
User clicks button
  → Finds analysis ✅
  → Generates structure with AI ✅
  → Processes equations ✅
  → Tries to insert into DB ❌ (structure too large / FK violation)
  → Error caught by outer try/catch
  → Returns { success: true } anyway (bug!)
  → UI shows success
  → But no data in database
  → User sees empty page
```

---

## 🎯 The Modern Flow (Orchestrator - Not Currently Used)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER CLICKS BUTTON                               │
│              "Generate Structure" (Step 2)                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              UI SENDS REQUEST (UPDATED)                             │
│   POST /functions/v1/orchestrate-generate-structure                │
│   Body: { blueprint_id: "uuid-123" }                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ORCHESTRATOR (218 lines, atomic)                       │
│                                                                     │
│   Step 1: fetch-analysis (atomic function)                         │
│   Step 2: check-structure-cache (atomic function)                  │
│   Step 3a: adapt-cached-structure (if cache hit)                   │
│   Step 3b: generate-structure-with-ai (if cache miss)              │
│   Step 4: process-equations (atomic function)                      │
│   Step 5: source-figures (atomic function)                         │
│   Step 6: store-structure (atomic function)                        │
│   Step 7: cache-structure (atomic function)                        │
│                                                                     │
│   ✅ BENEFITS:                                                      │
│   • Each step is isolated and testable                             │
│   • Consistent error handling                                      │
│   • Better logging                                                 │
│   • Easier to debug                                                │
│   • Can retry individual steps                                     │
│   • Transaction safety                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Comparison Table

| Aspect | Legacy (Current) | Orchestrator (Better) |
|--------|-----------------|----------------------|
| **Function Name** | generate-structure-legacy | orchestrate-generate-structure |
| **Lines of Code** | 1,235 lines | 218 lines |
| **Architecture** | Monolithic | Atomic functions |
| **Analysis Lookup** | 4 strategies (unreliable) | 1 strategy (reliable) |
| **Error Handling** | Inconsistent | Standardized |
| **Transaction Safety** | ❌ No | ✅ Yes |
| **Logging** | Scattered | Structured |
| **Testability** | Hard | Easy |
| **Debugging** | Difficult | Easy |
| **Reliability** | ⚠️ Random failures | ✅ Consistent |
| **Currently Used** | ✅ Yes (maybe?) | ❌ No |

---

## 🚀 Recommended Migration Path

```
PHASE 1: Immediate Fix (1 hour)
  → Update Blueprint.jsx to call orchestrate-generate-structure
  → Test with existing blueprints
  → Deploy

PHASE 2: Verify (1 day)
  → Monitor logs for errors
  → Test all failure scenarios
  → Confirm reliability improvement

PHASE 3: Cleanup (1 week)
  → Remove generate-structure-legacy
  → Update documentation
  → Add integration tests
```

---

**End of Flow Diagram**

