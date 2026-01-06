# Lecture Blueprint Structure Changes

## Date: January 6, 2026

## Summary
Enhanced blueprint structure generation for lecture documents to convert key_concepts into fully-featured dropdown concepts, while upgrading all embedding generation to OpenAI's text-embedding-3-large model (3072 dimensions).

## Changes Made

### 1. Embedding Model Upgrade (ALL Documents)
**Model**: `text-embedding-3-small` → `text-embedding-3-large`
**Dimensions**: 1536 → 3072
**Impact**: Improved semantic search precision for all resources, equations, and figures

**Files Modified**:
- `supabase/functions/_shared/embeddings.ts`
- `supabase/functions/generate-embedding/index.ts`
- `supabase/functions/generate-embedding/DIRECTIVES.md`
- `supabase/migrations/upgrade_embedding_dimensions_3072.sql` (NEW)

**Database Changes**:
- All `vector(1536)` columns upgraded to `vector(3072)`
- Existing embeddings invalidated (will regenerate on-demand)
- Indexes recreated for new dimensions

### 2. Lecture Structure Enhancement

#### Before (Lecture Documents):
```
Topic 1 (section level)
  └─ key_concepts: ["Concept A", "Concept B", "Concept C"] (just strings)
  └─ tutor_guidance, equations, target_resource_profile (at topic level only)
```

#### After (Lecture Documents):
```
Topic 1 (section level)
  ├─ Concept A (full learning_unit with dropdown)
  │   ├─ tutor_guidance (2-3 sentences for THIS concept)
  │   ├─ target_resource_profile (ideal video for THIS concept)
  │   ├─ target_resource_embedding (3072 dims, pre-computed)
  │   ├─ equations (relevant to THIS concept)
  │   ├─ figures (0-2 for THIS concept)
  │   └─ search_queries (3 queries for THIS concept)
  ├─ Concept B (full learning_unit)
  └─ Concept C (full learning_unit)
```

#### Homework Structure (UNCHANGED):
```
Problem 1 (section level)
  ├─ Concept A (already has full structure)
  ├─ Concept B
  └─ Walkthrough Unit
```

### 3. Concept Consolidation Logic

For lecture documents with many key_concepts:
1. **Consolidate** similar/duplicate concepts first
   - Example: "Newton's 2nd Law" + "F=ma relationship" → one concept
2. **Prioritize** most important/unique concepts
3. **Limit** to maximum 5 concepts per topic section
4. Each concept must be distinct and valuable

### 4. Prompt Updates

**File**: `supabase/functions/_shared/prompts.ts`

Added comprehensive instructions for lecture document handling:
- Detect `document_type === 'lecture'`
- Convert each `key_concept` into full `learning_unit`
- Generate complete structure for each concept
- Apply consolidation and limiting logic
- Create target_resource_profile for each concept

### 5. Type Definitions Enhanced

**File**: `supabase/functions/_shared/types.ts`

Added JSDoc comments clarifying the hierarchy:
- **LearningStructure**: Overall structure with sections
- **ContentSection**: Section level (Problem/Topic) - appears as tabs
- **LearningUnit**: Concept level - appears as dropdown items

### 6. Automatic Embedding Generation

**File**: `supabase/functions/generate-structure-legacy/index.ts`

Existing `generateTargetResourceEmbeddings()` function automatically:
- Generates embeddings for ALL learning_units
- Works for both homework and lecture documents
- Uses new text-embedding-3-large model (3072 dims)
- Stores embeddings in `target_resource_embedding` field

## Testing Requirements

### Test Case 1: Lecture with 3 Concepts
- Upload lecture document with 3 key concepts per topic
- Verify each concept becomes a full learning_unit
- Verify embeddings are 3072 dimensions
- Verify UI displays concepts as dropdowns

### Test Case 2: Lecture with 8 Concepts
- Upload lecture document with 8 key concepts in one topic
- Verify consolidation reduces to ≤5 concepts
- Verify similar concepts are merged intelligently

### Test Case 3: Homework Document
- Upload homework document
- Verify NO structural changes (except embedding dimensions)
- Verify existing functionality unchanged

### Test Case 4: Embedding Precision
- Compare search results before/after model upgrade
- Verify improved semantic matching

## Migration Instructions

### 1. Run Database Migration
```bash
# Apply the migration to upgrade vector dimensions
supabase db push

# Or manually run:
psql -f supabase/migrations/upgrade_embedding_dimensions_3072.sql
```

### 2. Deploy Updated Functions
```bash
# Deploy all functions with updated embedding model
supabase functions deploy

# Or deploy individually:
supabase functions deploy generate-embedding
supabase functions deploy generate-structure-legacy
supabase functions deploy search-resources
```

### 3. Regenerate Existing Embeddings (Optional)
Existing embeddings will be regenerated on-demand. To force regeneration:
- Delete existing blueprint_structures for test blueprints
- Re-run structure generation
- Embeddings will be created with new 3072-dim model

## Success Criteria

✅ Lecture documents generate 3-5 concepts per topic (not just string arrays)
✅ Each concept has full learning_unit structure with embeddings
✅ Homework documents remain unchanged (except embedding model)
✅ All embeddings use text-embedding-3-large model (3072 dims)
✅ UI displays lecture concepts as dropdown items with all fields
✅ Resource search works for individual lecture concepts
✅ No breaking changes to existing blueprints

## Performance Impact

### Embedding Generation
- **Time**: Slightly slower per embedding (more dimensions)
- **Cost**: Slightly higher per embedding
- **Quality**: Significantly improved semantic matching

### Token Savings (Lecture Documents)
- Concepts are generated by AI (not manually created)
- Consolidation reduces redundant concepts
- Overall structure generation time similar

### Search Precision
- 3072 dimensions provide better semantic understanding
- Improved resource matching for complex topics
- Better differentiation between similar concepts

## Rollback Plan

If issues arise:
1. Revert embedding model to text-embedding-3-small
2. Run migration to downgrade vector dimensions to 1536
3. Redeploy functions with old model
4. Regenerate embeddings

## Documentation Updated

- ✅ `FUNCTIONS_ORCHESTRATION_QUICK_REFERENCE.md`
- ✅ `supabase/functions/_shared/types.ts` (JSDoc comments)
- ✅ `supabase/functions/generate-embedding/DIRECTIVES.md`
- ✅ This file: `LECTURE_STRUCTURE_CHANGES.md`

## Related Files

### Modified:
- `supabase/functions/_shared/embeddings.ts`
- `supabase/functions/_shared/prompts.ts`
- `supabase/functions/_shared/types.ts`
- `supabase/functions/generate-embedding/index.ts`
- `supabase/functions/generate-embedding/DIRECTIVES.md`
- `FUNCTIONS_ORCHESTRATION_QUICK_REFERENCE.md`

### Created:
- `supabase/migrations/upgrade_embedding_dimensions_3072.sql`
- `LECTURE_STRUCTURE_CHANGES.md`

### Unchanged (but affected):
- `supabase/functions/generate-structure-legacy/index.ts` (uses new embeddings automatically)
- `src/pages/Blueprint.jsx` (should work without changes)
- All search functions (will use new 3072-dim embeddings)

