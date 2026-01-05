# Generate Structure: Complete Workflow Guide

**Date**: January 5, 2026  
**Purpose**: Visual guide to understand the two-step structure generation process

---

## 🎯 The Two-Step Process

```
┌─────────────────────────────────────────────────────────────────┐
│                     BLUEPRINT PAGE                               │
│                                                                  │
│  ┌────────────────┐              ┌────────────────┐            │
│  │  1. ANALYZE    │  ──────────► │ 2. GENERATE    │            │
│  │                │   (required)  │   STRUCTURE    │            │
│  └────────────────┘              └────────────────┘            │
│         │                                  │                     │
│         │ Creates analysis                 │ Uses analysis       │
│         ▼                                  ▼                     │
│  ┌────────────────┐              ┌────────────────┐            │
│  │ document_      │              │ learning_      │            │
│  │ analyses       │              │ structures     │            │
│  │ table          │              │ table          │            │
│  └────────────────┘              └────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step 1: Analyze Document

### What Happens

```
User clicks "1. Analyze"
  ↓
Frontend calls: analyze-document function
  ↓
┌─────────────────────────────────────────────────────────────┐
│ analyze-document Edge Function                               │
│                                                              │
│ 1. Fetch blueprint data                                     │
│ 2. Get document content (text or file)                      │
│ 3. Call Claude AI to analyze:                               │
│    - Subject area                                            │
│    - Difficulty level                                        │
│    - Key topics                                              │
│    - Learning objectives                                     │
│    - Prerequisites                                           │
│ 4. Store in document_analyses table:                        │
│    {                                                         │
│      blueprint_id: "uuid-123",                              │
│      raw_analysis: { subject_area, difficulty, ... },       │
│      created_at: "2026-01-05T..."                           │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
  ↓
✓ Analysis stored in database
  ↓
Button shows: "✓ Analysis Complete"
```

### Duration
- **5-10 seconds** (depends on document length)

### Output
- Record in `document_analyses` table
- Analysis includes:
  - Subject area (e.g., "Thermodynamics")
  - Difficulty level (e.g., "Undergraduate")
  - Key topics
  - Learning objectives
  - Prerequisites

---

## 🏗️ Step 2: Generate Structure

### What Happens

```
User clicks "2. Generate Structure"
  ↓
Frontend shows: Progress Panel
  ↓
Frontend calls: orchestrate-generate-structure function
  ↓
┌─────────────────────────────────────────────────────────────┐
│ orchestrate-generate-structure Edge Function                │
│ (Orchestrates 7 atomic functions)                           │
│                                                              │
│ STEP 1: fetch-analysis                                      │
│   ├─ Query: document_analyses WHERE blueprint_id = ?        │
│   ├─ ❌ If not found → ERROR (your issue!)                  │
│   └─ ✓ Returns: analysis object                             │
│                                                              │
│ STEP 2: check-structure-cache                               │
│   ├─ Search for similar structures (92%+ match)             │
│   └─ Returns: cache_hit (true/false)                        │
│                                                              │
│ STEP 3a: adapt-cached-structure (if cache hit)              │
│   ├─ Adapt cached structure to new analysis                 │
│   └─ ⚡ Saves ~24,000 tokens (~90% cost reduction)          │
│                                                              │
│ STEP 3b: generate-structure-with-ai (if cache miss)         │
│   ├─ Call Claude Haiku 4.5 to generate structure            │
│   └─ Creates: modules, topics, subtopics                    │
│                                                              │
│ STEP 4: process-equations (non-critical)                    │
│   ├─ Extract equations from structure                       │
│   └─ Store in equations table                               │
│                                                              │
│ STEP 5: source-figures (non-critical)                       │
│   ├─ Find relevant diagrams/figures                         │
│   └─ Store in figures table                                 │
│                                                              │
│ STEP 6: store-structure                                     │
│   ├─ Save structure to learning_structures table            │
│   └─ Returns: structure_id                                  │
│                                                              │
│ STEP 7: cache-structure (non-critical)                      │
│   ├─ Cache structure for future reuse                       │
│   └─ Store in structure_cache table                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
  ↓
✓ Structure stored in database
  ↓
Button shows: "✓ Generated"
```

### Duration
- **Cache hit**: ~2-5 seconds (90% faster!)
- **Cache miss**: ~10-20 seconds (full AI generation)

### Output
- Record in `learning_structures` table
- Structure includes:
  - Modules (major sections)
  - Topics (within modules)
  - Subtopics (within topics)
  - Learning objectives
  - Estimated time per section

---

## ❌ Common Error: Skipping Step 1

### What You Did
```
User clicks "2. Generate Structure" directly
  ↓
orchestrate-generate-structure called
  ↓
STEP 1: fetch-analysis
  ↓
Query: SELECT * FROM document_analyses WHERE blueprint_id = ?
  ↓
❌ NO ROWS FOUND
  ↓
Error: "No analysis found for this blueprint/document"
```

### Why It Fails
The `fetch-analysis` function (first step of orchestration) **requires** a record in the `document_analyses` table. This record is **only created** by running Step 1 (Analyze Document) first.

---

## ✅ Correct Workflow

### First Time (New Blueprint)
```
1. Create blueprint (upload document or paste text)
   ↓
2. Click "1. Analyze" → Wait for completion (5-10s)
   ↓
3. Click "2. Generate Structure" → Wait for completion (2-20s)
   ↓
4. ✓ Structure is ready!
```

### Subsequent Times (Same Blueprint)
If you already ran both steps once:
- The analysis is **cached** in the database
- The structure is **cached** in the database
- You can regenerate if needed (will use cache for speed)

---

## 🔍 Database Tables Involved

### 1. `blueprints`
```sql
CREATE TABLE blueprints (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT,
  input_text TEXT,
  document_url TEXT,
  generation_status TEXT, -- 'pending', 'analyzing', 'analyzed', 'generating', 'complete'
  created_at TIMESTAMP
);
```

### 2. `document_analyses` (Created by Step 1)
```sql
CREATE TABLE document_analyses (
  id UUID PRIMARY KEY,
  blueprint_id UUID REFERENCES blueprints(id),
  document_id UUID REFERENCES class_documents(id),
  raw_analysis JSONB, -- Full analysis from Claude
  created_at TIMESTAMP
);
```

### 3. `learning_structures` (Created by Step 2)
```sql
CREATE TABLE learning_structures (
  id UUID PRIMARY KEY,
  blueprint_id UUID REFERENCES blueprints(id),
  analysis_id UUID REFERENCES document_analyses(id),
  structure JSONB, -- Full structure (modules, topics, subtopics)
  from_cache BOOLEAN,
  cache_source_id UUID,
  created_at TIMESTAMP
);
```

### 4. `structure_cache` (Created by Step 2, Step 7)
```sql
CREATE TABLE structure_cache (
  id UUID PRIMARY KEY,
  analysis_id UUID REFERENCES document_analyses(id),
  structure JSONB,
  embedding VECTOR(1536), -- For similarity search
  created_at TIMESTAMP
);
```

---

## 🎨 UI Improvements (Applied)

### Before (Buggy)
```javascript
// Button could be clicked even without analysis
disabled={
  (!documentAnalysis && generationStatus === 'pending' || 
   generationStatus === 'analyzing' || 
   generationStatus === 'failed') || 
  (generating && generationStatus === 'generating')
}
```

**Issue**: Operator precedence made the condition confusing and unreliable.

### After (Fixed) ✅
```javascript
// Button is always disabled until analysis exists
disabled={
  !documentAnalysis || 
  generationStatus === 'analyzing' || 
  (generating && generationStatus === 'generating')
}
```

**Improvement**: Clear and simple - button is disabled if:
1. No analysis exists (`!documentAnalysis`)
2. OR currently analyzing
3. OR currently generating

---

## 🚀 Quick Reference

| Action | Button | Function | Duration | Creates |
|--------|--------|----------|----------|---------|
| **Step 1** | "1. Analyze" | `analyze-document` | 5-10s | `document_analyses` record |
| **Step 2** | "2. Generate Structure" | `orchestrate-generate-structure` | 2-20s | `learning_structures` record |

**Remember**: Always do Step 1 before Step 2! 🎯

---

## 🐛 Debugging Commands

### Check if analysis exists
```sql
SELECT id, blueprint_id, created_at 
FROM document_analyses 
WHERE blueprint_id = 'YOUR_BLUEPRINT_ID'
ORDER BY created_at DESC;
```

### Check if structure exists
```sql
SELECT id, blueprint_id, from_cache, created_at 
FROM learning_structures 
WHERE blueprint_id = 'YOUR_BLUEPRINT_ID'
ORDER BY created_at DESC;
```

### Check blueprint status
```sql
SELECT id, name, generation_status, created_at 
FROM blueprints 
WHERE id = 'YOUR_BLUEPRINT_ID';
```

---

**Status**: Workflow documented and UI fixed ✅

