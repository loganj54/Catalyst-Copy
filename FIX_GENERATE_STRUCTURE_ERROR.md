# Fix: "No analysis found for this blueprint/document" Error

**Date**: January 5, 2026  
**Error**: `[orchestrate-generate-structure] Error: fetch-analysis failed: No analysis found for this blueprint/document`

---

## 🎯 Root Cause

You're clicking **"2. Generate Structure"** button without first clicking **"1. Analyze"** button.

The structure generation workflow requires a document analysis to exist in the database first. This is a **two-step process**:

### Step 1: Analyze Document
- **Button**: "1. Analyze" 
- **Function**: `analyze-document`
- **What it does**: Analyzes your uploaded document/text and stores the analysis in the `document_analyses` table
- **Duration**: ~5-10 seconds

### Step 2: Generate Structure
- **Button**: "2. Generate Structure"
- **Function**: `orchestrate-generate-structure`
- **What it does**: Fetches the analysis from Step 1, then generates the learning structure
- **Duration**: ~10-20 seconds (or ~2-5 seconds if cache hit)

---

## ✅ Quick Fix: Follow the Correct Order

### On the Blueprint Page:

1. **First, click "1. Analyze"**
   - Wait for it to complete (you'll see a green checkmark)
   - The button will show "✓ Analysis Complete"

2. **Then, click "2. Generate Structure"**
   - This will now work because the analysis exists
   - You'll see a progress panel showing the 7 steps

---

## 🔍 Why This Happens

Looking at the code flow:

```
orchestrate-generate-structure (line 164-171)
  ↓
  STEP 1: fetch-analysis
    ↓
    Query: SELECT * FROM document_analyses WHERE blueprint_id = ?
    ↓
    ❌ NO ROWS FOUND → Error: "No analysis found"
```

The `fetch-analysis` function (first step of orchestration) looks for a record in `document_analyses` table:

```typescript
// supabase/functions/fetch-analysis/index.ts (lines 48-73)
const result = await supabase
  .from('document_analyses')
  .select('*')
  .eq('blueprint_id', input.blueprint_id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (!result.data) {
  return errorResponse({
    error: 'No analysis found for this blueprint/document',
    code: 'NOT_FOUND',
  });
}
```

This record is **only created** when you run the `analyze-document` function (Step 1).

---

## 🎨 Optional: Improve UX to Prevent This

The UI already has some logic to disable the "Generate Structure" button when no analysis exists, but it might not be working correctly. Here's what the code does:

### Current Button Logic (Blueprint.jsx line 1657-1658)

```javascript
<button
  onClick={runStructureStep}
  disabled={
    (!documentAnalysis && generationStatus === 'pending' || 
     generationStatus === 'analyzing' || 
     generationStatus === 'failed') || 
    (generating && generationStatus === 'generating')
  }
  // ... button content
>
```

**Issue**: The condition `!documentAnalysis && generationStatus === 'pending'` should have parentheses to work correctly.

### Suggested Fix

The button should be disabled when:
- No analysis exists (`!documentAnalysis`)
- OR currently analyzing
- OR currently generating

---

## 🔧 Code Fix (Optional)

If you want to improve the button logic, update `src/pages/Blueprint.jsx` line 1658:

**Before:**
```javascript
disabled={(!documentAnalysis && generationStatus === 'pending' || generationStatus === 'analyzing' || generationStatus === 'failed') || (generating && generationStatus === 'generating')}
```

**After:**
```javascript
disabled={
  !documentAnalysis || 
  generationStatus === 'analyzing' || 
  (generating && generationStatus === 'generating')
}
```

This will ensure the "Generate Structure" button is always disabled until Step 1 (Analyze) is complete.

---

## 📊 Complete Workflow Diagram

```
User creates blueprint with document/text
  ↓
Blueprint page loads
  ↓
[1. Analyze] ← Click this first
  ↓
analyze-document function
  ↓
Stores analysis in document_analyses table
  ↓
✓ Analysis Complete
  ↓
[2. Generate Structure] ← Now click this
  ↓
orchestrate-generate-structure function
  ↓
  Step 1: fetch-analysis (finds the analysis from Step 1)
  Step 2: check-structure-cache
  Step 3: adapt-cached-structure OR generate-structure-with-ai
  Step 4: process-equations
  Step 5: source-figures
  Step 6: store-structure
  Step 7: cache-structure
  ↓
✓ Structure Generated
```

---

## 🚀 Summary

**To fix your immediate issue:**
1. Go to your blueprint page
2. Click "1. Analyze" first
3. Wait for completion
4. Then click "2. Generate Structure"

**To prevent this in the future:**
- Always follow the 1-2 order
- Or apply the optional code fix to disable the button until Step 1 is done

---

## 🔍 Debugging: Check if Analysis Exists

If you want to verify whether an analysis exists for your blueprint, run this SQL query:

```sql
SELECT 
  id,
  blueprint_id,
  created_at,
  raw_analysis->>'subject_area' as subject_area,
  raw_analysis->>'difficulty_level' as difficulty_level
FROM document_analyses
WHERE blueprint_id = 'YOUR_BLUEPRINT_ID_HERE'
ORDER BY created_at DESC
LIMIT 1;
```

If this returns no rows, you need to run Step 1 (Analyze) first.

---

**Status**: Issue identified and solution provided ✅

