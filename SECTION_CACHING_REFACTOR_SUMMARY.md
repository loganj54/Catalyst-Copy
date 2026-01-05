# Section Caching Schema Refactor - Summary

## Problem Identified

The initial implementation was creating **ONE ROW** for the entire structure generation instead of **ONE ROW PER SECTION**. Additionally, the database columns were unclear and included unnecessary fields.

## Solution Implemented

### 1. Database Schema Refactor ✅

**File:** `supabase/migrations/refactor_section_caching_schema.sql`

#### Removed Unnecessary Columns:
- `subject_embedding` - Not needed with section-level caching
- `topics_embedding` - Not needed with section-level caching
- `characteristics_embedding` - Not needed with section-level caching
- `topics` - Replaced by `concepts_tested`
- `num_sections` - Not relevant for individual sections
- `num_problems` - Not relevant for individual sections
- `has_equations` - Can be derived from cached_unit
- `user_satisfaction` - Redundant with quality_score

#### Added Clear, Meaningful Columns:

**Section Identification:**
- `section_title` TEXT - The title/name (e.g., "Problem 1: Thermodynamics")

**Problem-Specific Fields** (for `section_type = 'problem'`):
- `problem_statement_text` TEXT - The complete problem statement
- `problem_statement_embedding` VECTOR(1536) - Embedding of the problem

**Topic-Specific Fields** (for `section_type = 'topic'`):
- `topic_summary_text` TEXT - The topic summary
- `topic_summary_embedding` VECTOR(1536) - Embedding of summary + concepts

**Common Fields:**
- `concepts_tested` TEXT[] - Array of concepts covered
- `primary_embedding` VECTOR(1536) - Main embedding for similarity search (renamed from `section_embedding`)

**Existing Fields Kept:**
- `section_id` - Original section ID from analysis
- `section_type` - "problem" or "topic"
- `cached_unit` - The generated learning unit(s)
- `subject_area`, `specific_topic`, `document_type`, `course_level` - Metadata
- `times_used`, `quality_score` - Quality metrics
- `embedding_source` - Transparency about what was embedded
- `source_analysis_id` - Link to original analysis
- `created_at`, `last_used_at` - Timestamps

### 2. Updated Indexes ✅

- `cached_structures_primary_embedding_idx` - Main similarity search
- `cached_structures_problem_embedding_idx` - Problem-specific searches
- `cached_structures_topic_embedding_idx` - Topic-specific searches
- `cached_structures_section_title_idx` - Title searches
- `cached_structures_concepts_tested_idx` - GIN index for array searches

### 3. Data Integrity Constraints ✅

```sql
-- Ensure problem sections have required fields
CHECK (section_type != 'problem' OR (
  problem_statement_text IS NOT NULL AND
  problem_statement_embedding IS NOT NULL
))

-- Ensure topic sections have required fields
CHECK (section_type != 'topic' OR (
  topic_summary_text IS NOT NULL AND
  topic_summary_embedding IS NOT NULL
))
```

### 4. Updated Functions ✅

**`search_similar_sections()`**
- Now returns full section details including text fields
- Uses `primary_embedding` for similarity search
- Returns `section_title`, `problem_statement_text`, `topic_summary_text`, `concepts_tested`

**`get_section_cache_details()`** (NEW)
- Helper function to retrieve detailed section information by ID

### 5. Updated Views ✅

**`section_cache_statistics`**
- Added embedding counts
- Shows problems vs topics with embeddings

**`section_cache_performance`**
- Added `common_concepts` aggregation
- Shows most frequent concepts per subject/type

**`section_cache_inspection`** (NEW)
- Debugging view with content previews
- Shows embedding status for each section
- Displays first 100 chars of content

### 6. Application Code Updates ✅

**`cache-structure/index.ts`**
- Updated `cacheSingleSection()` to populate ALL new columns
- Properly handles problem vs topic fields
- Creates ONE ROW PER SECTION
- Includes detailed logging for debugging

**`section-embeddings.ts`**
- Updated `prepareSectionsForCache()` to include `original_section` data
- Ensures all section details are passed to cache function
- Handles multiple units per section gracefully

**`types.ts`**
- Updated `SectionToCache` interface to include `original_section`
- Supports both single units and multiple units per section

## How It Works Now

### Caching Flow

1. **Generate Structure** - AI generates learning units for cache-missed sections
2. **Prepare for Cache** - `prepareSectionsForCache()` combines:
   - Section embeddings
   - Generated learning units
   - Original section data (problem_statement, topic_summary, concepts_tested)
3. **Cache Each Section** - `cacheSingleSection()` creates ONE ROW per section:
   ```typescript
   {
     section_id: "Problem 1",
     section_type: "problem",
     section_title: "Problem 1: Thermodynamics",
     problem_statement_text: "A 2000 kg car accelerates...",
     problem_statement_embedding: [0.123, 0.456, ...],
     primary_embedding: [0.123, 0.456, ...], // Same as problem_statement_embedding
     concepts_tested: ["Newton's Laws", "Kinematics"],
     cached_unit: { unit_id: "...", topic: "...", ... },
     subject_area: "Physics",
     document_type: "problem_set",
     times_used: 0,
     quality_score: 1.0
   }
   ```

### Database Result

**Before (WRONG):**
```
cached_blueprint_structures
- 1 row containing all sections combined
```

**After (CORRECT):**
```
cached_blueprint_structures
- Row 1: Problem 1 with its problem_statement_text and embedding
- Row 2: Problem 2 with its problem_statement_text and embedding
- Row 3: Topic 1 with its topic_summary_text and embedding
- Row 4: Topic 2 with its topic_summary_text and embedding
... (one row per section)
```

## Verification Queries

### Check Individual Cached Sections

```sql
-- View all cached sections with details
SELECT 
  section_id,
  section_type,
  section_title,
  CASE 
    WHEN section_type = 'problem' THEN substring(problem_statement_text, 1, 100)
    WHEN section_type = 'topic' THEN substring(topic_summary_text, 1, 100)
  END as content_preview,
  concepts_tested,
  times_used,
  created_at
FROM cached_blueprint_structures
ORDER BY created_at DESC;
```

### Count Rows Per Generation

```sql
-- Should see multiple rows per generation (one per section)
SELECT 
  source_analysis_id,
  COUNT(*) as sections_cached,
  array_agg(section_id) as section_ids
FROM cached_blueprint_structures
GROUP BY source_analysis_id
ORDER BY MAX(created_at) DESC;
```

### Inspect Cache Content

```sql
-- Use the inspection view
SELECT * FROM section_cache_inspection
ORDER BY created_at DESC
LIMIT 20;
```

## Testing Checklist

- [ ] Apply database migration
- [ ] Deploy updated Edge Functions
- [ ] Generate a blueprint with 3-5 sections
- [ ] Verify multiple rows are created in `cached_blueprint_structures`
- [ ] Check that each row has:
  - [ ] Correct `section_id` and `section_type`
  - [ ] Populated `section_title`
  - [ ] Populated `problem_statement_text` OR `topic_summary_text`
  - [ ] Populated `problem_statement_embedding` OR `topic_summary_embedding`
  - [ ] Populated `primary_embedding`
  - [ ] Populated `concepts_tested` array
  - [ ] Populated `cached_unit` JSONB
- [ ] Generate another similar blueprint
- [ ] Verify cache hits retrieve individual sections correctly
- [ ] Check cache statistics views show correct counts

## Benefits of This Refactor

1. **Clarity** - Each column has a clear, specific purpose
2. **One Row Per Section** - Proper granular caching
3. **Searchability** - Can search by problem text, topic text, or concepts
4. **Debugging** - Easy to inspect what's cached
5. **Performance** - Specific indexes for problems vs topics
6. **Data Integrity** - Constraints ensure required fields are populated
7. **Transparency** - Can see exactly what text was embedded

## Migration Path

1. **Apply Migration** - Run `refactor_section_caching_schema.sql`
2. **Deploy Functions** - Deploy updated `cache-structure` and `section-embeddings`
3. **Test** - Generate a test blueprint and verify multiple rows
4. **Monitor** - Use inspection views to verify data quality
5. **Clean Up** - Optionally remove old rows that don't follow new schema

---

**Status:** Complete - Ready for Testing  
**Date:** January 5, 2026  
**Impact:** Critical - Fixes fundamental caching behavior

