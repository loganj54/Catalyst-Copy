# Section-Level Caching Architecture (Problem-by-Problem)

## 🎯 Core Concept

Instead of caching entire document structures, we cache **individual problem/section learning structures**. This means:

✅ **Problem 1 from Homework A** can reuse the cached structure from **Problem 3 from Homework B** if they're similar
✅ **Higher cache hit rates** - don't need identical documents, just similar problems
✅ **Granular token savings** - ~3,000 tokens saved per section cache hit
✅ **Works perfectly with existing resource cache** - resources are already cached by keywords

---

## 🏗️ Architecture Flow

```
Document Analysis
    ↓
Sections Array [Problem 1, Problem 2, ..., Problem 7]
    ↓
For Each Section:
    ├─ Check Section Cache (88% similarity)
    │   ├─ Concepts: "Fourier Transform, Signal Processing"
    │   ├─ Problem Type: "calculation problem, uses equations"
    │   └─ Context: "difficulty 7/10, 30 minutes"
    │
    ├─ ✅ CACHE HIT? → Adapt & Use (~3,000 tokens saved)
    │
    └─ ❌ CACHE MISS? → Generate with AI → Cache for future
    
Final Structure = Prerequisites + All Sections (mix of cached & generated)
```

---

## 📊 Example: 7-Problem Homework

**Homework 1** (first time, cache building):
- Problem 1: Fourier Transform → AI Generate → **Cache it**
- Problem 2: Laplace Transform → AI Generate → **Cache it**
- Problem 3: Convolution → AI Generate → **Cache it**
- Problem 4: Z-Transform → AI Generate → **Cache it**
- Problem 5: Transfer Functions → AI Generate → **Cache it**
- Problem 6: Bode Plots → AI Generate → **Cache it**
- Problem 7: Nyquist Stability → AI Generate → **Cache it**

**Total**: 0 cache hits, 7 generated, ~21,000 tokens used

---

**Homework 2** (different problems, but some similar):
- Problem 1: Discrete Fourier Transform → **CACHE HIT!** (similar to HW1-P1)
- Problem 2: Continuous-Time Signals → AI Generate → Cache it
- Problem 3: Sampling Theory → AI Generate → Cache it
- Problem 4: Z-Transform Analysis → **CACHE HIT!** (similar to HW1-P4)
- Problem 5: Digital Filters → AI Generate → Cache it
- Problem 6: Frequency Response → **CACHE HIT!** (similar to HW1-P6)
- Problem 7: System Stability → **CACHE HIT!** (similar to HW1-P7)

**Total**: 4 cache hits (57%), 3 generated, ~9,000 tokens used, **~12,000 tokens saved!**

---

## 💾 Database Schema

### `cached_section_structures` Table

```sql
CREATE TABLE cached_section_structures (
  -- Vector embeddings for matching
  concepts_embedding VECTOR(1536),      -- 50% weight: Main concepts
  problem_type_embedding VECTOR(1536),  -- 30% weight: Problem type/category
  context_embedding VECTOR(1536),       -- 20% weight: Difficulty, time, etc.
  
  -- Metadata for filtering
  subject_area TEXT,                    -- 'Physics', 'Math', etc.
  section_type TEXT,                    -- 'problem' or 'topic'
  concepts JSONB,                       -- ['Fourier Transform', 'Signal Processing']
  problem_category TEXT,                -- 'calculation', 'derivation', 'conceptual'
  difficulty_level TEXT,                -- 'introductory', 'intermediate', 'advanced'
  
  -- The cached learning structure (just for this section)
  learning_structure JSONB,             -- { learning_units: [...] }
  
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  quality_score FLOAT DEFAULT 0.5,
  last_used_at TIMESTAMP
);
```

---

## 🔍 Matching Algorithm

**Weighted Vector Similarity:**
- **Concepts** (50%): Main concepts tested/taught
- **Problem Type** (30%): Calculation vs derivation vs conceptual
- **Context** (20%): Difficulty, time estimate, has diagrams, etc.

**Threshold**: 88% similarity (lower than document-level because sections are more focused)

**Filters**:
1. Exact match on `subject_area` (Physics, Math, etc.)
2. Exact match on `section_type` (problem vs topic)
3. Vector similarity >= 88%
4. Sort by: similarity DESC, quality DESC, usage DESC

---

## 📈 Expected Cache Hit Rates

### By Scenario

**Same course, weekly homework sets**:
- Week 1: 0% hit rate (building cache)
- Week 2: 20-30% hit rate (some similar problem types)
- Week 3-4: 40-50% hit rate (common patterns emerging)
- Weeks 5+: 50-65% hit rate (mature cache)

**Multiple students, same assignments**:
- Student 1: 0% hit rate (first to do it)
- Student 2: 70-85% hit rate (very similar problems)
- Students 3+: 75-90% hit rate (cache is mature)

**Same student, different chapters**:
- 30-50% hit rate (concepts overlap but problems vary)

---

## 🚀 Implementation Files

### New Files Created:
1. ✅ `supabase/migrations/add_section_level_caching.sql`
   - Database schema for section-level caching
   - Search function with weighted similarity
   - Usage tracking and statistics views

2. ✅ `supabase/functions/_shared/section-cache.ts`
   - `checkSectionCache()` - Check cache for individual section
   - `adaptCachedSectionStructure()` - Adapt to new section
   - `cacheSectionStructure()` - Store new section structure
   - `incrementSectionCacheUsage()` - Track usage

3. ✅ `supabase/functions/_shared/section-by-section-generator.ts`
   - `generateStructureSectionBySection()` - Main orchestrator
   - Processes each section individually
   - Checks cache first, generates with AI on miss
   - Returns complete structure + cache statistics

### Files to Modify:
- `supabase/functions/generate-structure/index.ts`
  - Replace current generation with section-by-section approach
  - Use `generateStructureSectionBySection()` function

---

## 🎯 Integration with Existing System

### Works perfectly with current resource cache:
```
Section Structure Cache (NEW)    Resource Cache (EXISTING)
         ↓                                ↓
  [Learning Units]              [YouTube Videos, etc.]
         ↓                                ↓
    Search Queries ──────────────────→ Find Resources
```

- Section cache: Stores the **learning units** and **search queries**
- Resource cache: Stores actual **YouTube videos** found by those queries
- **Both work together** - section cache generates queries, resource cache finds videos

---

## 💰 Token Savings

### Per Section Cache Hit:
- **Saved**: ~3,000 tokens (~$0.0075)
- **Time saved**: ~5-10 seconds

### Example Savings (7-problem homework):
- **0 cache hits**: 21,000 tokens (~$0.053)
- **3 cache hits** (43%): 12,000 tokens (~$0.030) = **$0.023 saved**
- **5 cache hits** (71%): 6,000 tokens (~$0.015) = **$0.038 saved**
- **7 cache hits** (100%): 0 tokens (~$0.000) = **$0.053 saved**

### Over time (100 students, 10 homeworks each):
- Without cache: 21M tokens (~$525)
- With 60% hit rate: 8.4M tokens (~$210) = **$315 saved!**

---

## 🔧 Deployment Steps

### 1. Deploy New Migration
```sql
-- Run in Supabase SQL Editor
supabase/migrations/add_section_level_caching.sql
```

### 2. Deploy New Shared Functions
- Upload `section-cache.ts`
- Upload `section-by-section-generator.ts`

### 3. Update generate-structure Function
- Import and use `generateStructureSectionBySection()`
- Remove old document-level caching code

### 4. Test
- Upload 7-problem homework → All AI generated (cache building)
- Upload similar homework → Some cache hits!
- Check logs for cache hit messages

---

## 🎉 Benefits Summary

1. **Higher Cache Hit Rates**: 50-70% vs 20-30% with document-level
2. **More Granular**: Works across different documents
3. **Flexible**: Mix of cached and generated sections in same document
4. **Scalable**: Cache grows with every section, not just documents
5. **Cost Effective**: ~$0.0075 saved per section cache hit
6. **Fast**: Cached sections return instantly
7. **Quality Maintained**: Adaptation ensures relevance to new problems
8. **Works with Existing System**: Integrates perfectly with resource cache

---

## ✅ Ready to Implement!

The architecture is designed, code is written, just need to:
1. Deploy migration
2. Update generate-structure to use section-by-section approach
3. Test and monitor cache performance

