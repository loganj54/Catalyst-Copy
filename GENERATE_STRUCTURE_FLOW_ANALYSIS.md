# Generate Structure Flow Analysis & Issue Investigation

**Date**: January 5, 2026  
**Issue**: Random failures when clicking "Generate Structure" button - sometimes works, sometimes fails, sometimes says success but nothing appears in DB

---

## 🔍 Executive Summary

The "Generate Structure" feature has **critical architectural inconsistencies** that explain the random behavior:

1. **Function Name Mismatch**: UI calls `generate-structure` but only `generate-structure-legacy` exists
2. **No Orchestration**: The modern orchestrator `orchestrate-generate-structure` is not being used
3. **Monolithic Legacy Function**: Using a 1,235-line legacy function with complex caching logic
4. **Multiple Failure Points**: Analysis lookup, cache checks, AI generation, and DB storage can all fail silently
5. **Inconsistent Error Handling**: Some errors update blueprint status, others don't

---

## 📊 Current Flow (When User Clicks "Generate Structure")

### **Step 1: UI Button Click**
**Location**: `src/pages/Blueprint.jsx` line 1194-1218

```javascript
const runStructureStep = async () => {
  setGenerating(true);
  setGenerationStatus('generating');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ blueprint_id: id }),
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  
  setStructureGenerationResult(data);
  await fetchBlueprint();
}
```

**What happens**: 
- UI sends POST request to `/functions/v1/generate-structure`
- Expects response with `{ success: true, structure: {...} }`
- Updates UI state and refetches blueprint data

---

### **Step 2: Edge Function Routing** ⚠️ **ISSUE #1: Function Name Mismatch**

**Problem**: UI calls `generate-structure` but this function **does not exist**

**Available functions**:
- ✅ `generate-structure-legacy/index.ts` (1,235 lines)
- ✅ `orchestrate-generate-structure/index.ts` (218 lines, modern atomic approach)
- ❌ `generate-structure/index.ts` (DOES NOT EXIST)

**Hypothesis**: Either:
1. `generate-structure-legacy` is deployed as `generate-structure` (symlink or deployment config)
2. The function call is failing silently and returning cached/stale data
3. There's a routing layer we're not seeing

**Impact**: This explains why behavior is inconsistent - the routing might be unreliable

---

### **Step 3: Legacy Function Execution**
**Location**: `supabase/functions/generate-structure-legacy/index.ts`

Assuming the legacy function is being called, here's what happens:

#### **3.1 Input Validation** (lines 760-770)
```typescript
const { blueprint_id, analysis, input_type } = await req.json();

if (!blueprint_id && !analysis) {
  return error response
}
```

#### **3.2 Fetch Blueprint** (lines 772-788)
```typescript
const { data: blueprint, error: bpError } = await supabase
  .from('blueprints')
  .select('*, class:classes(*)')
  .eq('id', blueprint_id)
  .single();
```

**Failure Point #1**: If blueprint not found, returns error

#### **3.3 Find Document Analysis** ⚠️ **ISSUE #2: Complex Lookup Logic**
**Location**: lines 790-890

The function tries **FOUR different strategies** to find the analysis:

1. **By document_id** (lines 798-810)
   ```typescript
   if (documentId) {
     const { data: docMatch } = await supabase
       .from('document_analyses')
       .eq('document_id', documentId)
   }
   ```

2. **By blueprint_id** (lines 817-829)
   ```typescript
   const { data: bpMatch } = await supabase
     .from('document_analyses')
     .eq('blueprint_id', blueprint_id)
   ```

3. **By filename** (lines 839-855)
   ```typescript
   const { data: filenameMatch } = await supabase
     .from('document_analyses')
     .eq('class_id', blueprint.class_id)
     .ilike('file_name', `%${fileName}%`)
   ```

4. **By class_id** (lines 863-875)
   ```typescript
   const { data: classMatch } = await supabase
     .from('document_analyses')
     .eq('class_id', blueprint.class_id)
     .order('created_at', { descending: true })
     .limit(1)
   ```

**Failure Point #2**: If none of these find an analysis, function fails with error:
```
"No document analysis found. Please analyze the document first."
```

**Why this causes random failures**:
- If document_id is null but analysis exists under blueprint_id → works
- If document_id exists but analysis was created with different blueprint_id → fails
- If multiple blueprints share same document → might get wrong analysis
- If class has multiple documents → might get wrong analysis

---

#### **3.4 Delete Existing Structure** (lines 900-907)
```typescript
await supabase
  .from('blueprint_structures')
  .delete()
  .eq('blueprint_id', blueprint_id);
```

**Failure Point #3**: If this fails, continues anyway (error logged but not thrown)

---

#### **3.5 Check Structure Cache** ⚠️ **ISSUE #3: Cache Logic Complexity**
**Location**: lines 926-976

```typescript
const cacheCheck = await checkStructureCache(
  analysisData.raw_analysis,
  0.92 // 92% similarity threshold
);

if (cacheCheck.hit) {
  // Adapt cached structure (lines 933-976)
  const adaptedStructure = await adaptCachedStructure(
    cacheCheck.cached_structure,
    analysisData.raw_analysis
  );
  
  // Process equations from cache
  // Process figures from cache
  // Store adapted structure
}
```

**Failure Point #4**: Cache adaptation can fail if:
- Cached structure has incompatible schema
- Equation/figure processing fails
- Adaptation logic throws error

**Why this causes "success but nothing appears"**:
- Cache hit might return success response
- But storing adapted structure might fail silently
- UI shows success, but DB has no data

---

#### **3.6 Generate New Structure with AI** (if cache miss)
**Location**: lines 1047-1128

```typescript
const claudeResponse = await callClaudeJSON(
  PROMPTS.GENERATE_STRUCTURE,
  analysisData.raw_analysis,
  'claude-3-5-haiku-20241022'
);

const structure = claudeResponse.structure;
```

**Failure Point #5**: AI generation can fail if:
- Claude API timeout (10-20s)
- Invalid JSON response
- Rate limiting
- Token limit exceeded

**Why this causes random failures**:
- Claude might be slow/timeout → user sees "generating" forever
- Invalid JSON → error thrown
- Rate limit → fails for some users but not others

---

#### **3.7 Process Equations** (lines 1094-1117)
```typescript
const equationResults = await processEquationsForCaching(
  structure,
  analysisData.raw_analysis.subject_area,
  blueprint_id,
  blueprint.user_id
);
```

**Failure Point #6**: Equation processing can fail but is caught and logged

---

#### **3.8 Process Figures** (lines 1128-1128)
```typescript
const figureResults = await processSuggestedFigures(
  structure,
  analysisData.raw_analysis.subject_area,
  blueprint_id,
  blueprint.user_id
);
```

**Failure Point #7**: Figure processing can fail but is caught and logged

---

#### **3.9 Store Structure in Database** ⚠️ **ISSUE #4: Critical Failure Point**
**Location**: lines 1145-1158

```typescript
const { data: newStructure, error: insertError } = await supabase
  .from('blueprint_structures')
  .insert({
    blueprint_id: blueprint_id,
    user_id: blueprint.user_id,
    analysis_id: analysisId,
    structure: structure,
    model_used: 'claude-3-5-haiku-20241022',
    total_prerequisites: structure.prerequisites_section?.learning_units?.length || 0,
    total_sections: structure.content_sections?.length || 0,
    total_learning_units: totalUnits,
    total_search_queries: totalQueries,
    from_cache: false,
  })
  .select()
  .single();

if (insertError) {
  console.error('[generate-structure] Database insert error:', insertError);
  throw insertError;
}
```

**Failure Point #8**: Database insert can fail if:
- Structure JSON is too large (>1MB JSONB limit)
- Invalid structure format
- Foreign key constraint violation (analysis_id doesn't exist)
- RLS policy blocks insert
- Unique constraint violation

**Why this causes "success but nothing appears"**:
- If this fails AFTER cache/AI generation
- Error might be caught by outer try/catch
- Response might still return success: true
- But no data in database

---

#### **3.10 Cache Structure for Future** (lines 1168-1178)
```typescript
await cacheNewStructure(
  structure,
  analysisData.raw_analysis,
  analysisId
);
```

**Failure Point #9**: Caching can fail but is caught and logged (non-critical)

---

#### **3.11 Update Blueprint Status** (lines 1180-1180)
```typescript
await supabase
  .from('blueprints')
  .update({ generation_status: 'completed' })
  .eq('id', blueprint_id);
```

**Failure Point #10**: Status update can fail silently

---

### **Step 4: Response to UI**

**Success Response** (lines 1182-1202):
```typescript
return new Response(JSON.stringify({
  success: true,
  structure_id: newStructure?.id,
  structure: structure,
  metrics: { ... },
  equations: { ... },
  figures: { ... },
  from_cache: false,
  model_used: 'claude-3-5-haiku-20241022',
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  status: 200,
});
```

**Error Response** (lines 1204-1231):
```typescript
return new Response(JSON.stringify({ 
  success: false, 
  error: error?.message || 'Unknown error occurred',
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  status: 500,
});
```

---

## 🐛 Root Causes of Random Failures

### **Issue #1: Function Routing Ambiguity**
- UI calls `generate-structure` 
- Only `generate-structure-legacy` exists
- Unclear which function actually executes
- **Impact**: Unpredictable behavior

### **Issue #2: Analysis Lookup Fragility**
- 4 different lookup strategies
- Can return wrong analysis or no analysis
- Depends on how blueprint was created
- **Impact**: "No analysis found" errors even when analysis exists

### **Issue #3: Cache Adaptation Failures**
- Cache hit returns success
- But adapted structure might fail to store
- Error handling is inconsistent
- **Impact**: "Success but nothing appears"

### **Issue #4: Database Insert Failures**
- Structure might be too large
- Foreign key constraints might fail
- RLS policies might block
- **Impact**: "Success but nothing appears"

### **Issue #5: Timing Issues**
- AI generation takes 10-20s
- User might refresh page
- Multiple requests might conflict
- **Impact**: Race conditions, duplicate structures

### **Issue #6: Error Handling Inconsistency**
- Some errors update blueprint status
- Some errors are logged but ignored
- Some errors throw, some don't
- **Impact**: Inconsistent user feedback

---

## 🎯 Recommended Fixes

### **Priority 1: Fix Function Routing**
1. **Option A**: Rename `generate-structure-legacy` to `generate-structure`
2. **Option B**: Update UI to call `orchestrate-generate-structure` (preferred)
3. **Option C**: Create symlink/alias from `generate-structure` to legacy

### **Priority 2: Improve Analysis Lookup**
1. Standardize on **document_id** as primary lookup
2. Always set document_id when creating blueprints
3. Add fallback to blueprint_id only
4. Remove filename and class_id lookups (too unreliable)

### **Priority 3: Add Transaction Safety**
1. Wrap structure storage in transaction
2. If any step fails, rollback all changes
3. Always update blueprint status (success or failure)

### **Priority 4: Add Better Error Handling**
1. Always return consistent error format
2. Always update blueprint.generation_status
3. Add detailed error logging
4. Add timeout handling (30s max)

### **Priority 5: Migrate to Orchestrator**
1. Use `orchestrate-generate-structure` instead of legacy
2. Atomic functions are more reliable
3. Better error handling and logging
4. Easier to debug and maintain

---

## 📋 Debugging Checklist

When investigating a failure, check:

1. **Which function was called?**
   - Check Supabase logs for function name
   - Verify `generate-structure` vs `generate-structure-legacy`

2. **Was analysis found?**
   - Check `document_analyses` table
   - Verify document_id matches blueprint.document_id
   - Check if analysis exists for blueprint_id

3. **Did cache hit or miss?**
   - Check logs for "CACHE HIT" or "Cache miss"
   - Verify cached structure is valid

4. **Did structure store successfully?**
   - Check `blueprint_structures` table for blueprint_id
   - Verify structure JSON is valid
   - Check for foreign key errors

5. **What's the blueprint status?**
   - Check `blueprints.generation_status`
   - Should be 'completed' or 'failed'
   - Check `blueprints.generation_error` for error message

6. **Check for timing issues**
   - Look for multiple requests for same blueprint_id
   - Check if user refreshed during generation
   - Verify no race conditions

---

## 🔧 Immediate Action Items

1. **Verify which function is actually deployed**
   ```bash
   supabase functions list
   ```

2. **Check Supabase logs for recent failures**
   - Look for "generate-structure" errors
   - Check for "No analysis found" messages
   - Look for database insert errors

3. **Add logging to UI**
   ```javascript
   console.log('[Blueprint] Calling generate-structure with:', { blueprint_id: id });
   console.log('[Blueprint] Response:', data);
   ```

4. **Test each failure scenario**
   - Blueprint without document_id
   - Blueprint with missing analysis
   - Blueprint with large structure (>1MB)
   - Multiple rapid clicks on generate button

5. **Consider emergency fix**
   - Update UI to call `orchestrate-generate-structure` directly
   - This is the modern, atomic approach
   - Better error handling and reliability

---

## 📊 Comparison: Legacy vs Orchestrator

| Aspect | Legacy Function | Orchestrator |
|--------|----------------|--------------|
| **Lines of code** | 1,235 lines | 218 lines |
| **Architecture** | Monolithic | Atomic functions |
| **Error handling** | Inconsistent | Standardized |
| **Logging** | Scattered | Structured |
| **Testability** | Difficult | Easy |
| **Maintainability** | Hard | Easy |
| **Reliability** | ⚠️ Issues | ✅ Better |
| **Current usage** | ❓ Maybe | ❌ Not used |

---

## 🎬 Next Steps

1. **Investigate function deployment** - Which function is actually running?
2. **Add comprehensive logging** - Track every step of the flow
3. **Standardize error handling** - Always update blueprint status
4. **Migrate to orchestrator** - Use modern atomic approach
5. **Add integration tests** - Test all failure scenarios

---

**End of Analysis**

