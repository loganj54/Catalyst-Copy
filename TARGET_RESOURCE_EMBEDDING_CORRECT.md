# Target Resource Embedding Optimization - CORRECTED

## ✅ What Was Actually Implemented (CORRECT VERSION)

Embeddings are now stored **at the unit level** inside the `structure` JSONB column, NOT in the `all_search_queries` array.

## 🎯 The Correct Approach

### Where Embeddings Are Stored

**Location:** `blueprint_structures.structure` → `learning_units[]` → each unit

**Structure:**
```json
{
  "summary": {...},
  "prerequisites_section": {
    "learning_units": [
      {
        "unit_id": "unit-1",
        "topic": "Newton's Laws",
        "target_resource_profile": "A clear, visual explanation of Newton's three laws with real-world examples...",
        "target_resource_embedding": [0.123, 0.456, ...1536 dimensions...],
        "search_queries": [...],
        "semantic_search_phrase": "..."
      }
    ]
  },
  "content_sections": [
    {
      "learning_units": [
        {
          "unit_id": "unit-2",
          "topic": "Force Diagrams",
          "target_resource_profile": "Step-by-step tutorial on drawing free body diagrams...",
          "target_resource_embedding": [0.789, 0.012, ...1536 dimensions...],
          ...
        }
      ]
    }
  ]
}
```

## 📊 Key Differences from Previous (Wrong) Approach

| Aspect | ❌ Wrong (Previous) | ✅ Correct (Now) |
|--------|---------------------|------------------|
| **Storage Location** | `all_search_queries` array | Inside each `learning_unit` |
| **What's Embedded** | Search query text | `target_resource_profile` description |
| **Field Name** | `embedding` | `target_resource_embedding` |
| **Granularity** | Per search query | Per learning unit |
| **Purpose** | Embed search text | Embed ideal resource description |

## 🔧 Implementation Details

### 1. TypeScript Interface (`generate-structure-legacy/index.ts`)

```typescript
interface LearningUnit {
  unit_id: string;
  unit_type: 'prerequisite' | 'topic' | 'walkthrough';
  topic: string;
  description?: string;
  learning_objective?: string;
  tutor_guidance: string;
  search_queries: SearchQuery[];
  semantic_search_phrase?: string;
  target_resource_profile?: string;           // NEW: Description of ideal resource
  target_resource_embedding?: number[];       // NEW: 1536-dim embedding
  // ... other fields
}
```

### 2. Embedding Generation Function

```typescript
async function generateTargetResourceEmbeddings(structure: LearningStructure): Promise<void> {
  // Process all units in prerequisites_section
  for (const unit of structure.prerequisites_section?.learning_units || []) {
    const embeddingText = unit.target_resource_profile 
      || unit.semantic_search_phrase 
      || `${unit.topic} ${unit.description || ''}`;
    
    const result = await generateEmbedding(embeddingText.trim());
    unit.target_resource_embedding = result.embedding;  // Store in unit!
  }
  
  // Process all units in content_sections
  for (const section of structure.content_sections || []) {
    for (const unit of section.learning_units || []) {
      const embeddingText = unit.target_resource_profile 
        || unit.semantic_search_phrase 
        || `${unit.topic} ${unit.description || ''}`;
      
      const result = await generateEmbedding(embeddingText.trim());
      unit.target_resource_embedding = result.embedding;  // Store in unit!
    }
  }
}
```

### 3. Frontend Usage (`Blueprint.jsx`)

```javascript
// Extract embedding directly from the unit
const targetResourceEmbedding = unit.target_resource_embedding;
const targetResourceProfile = unit.target_resource_profile;

const requestBody = {
  blueprint_id: id,
  unit_id: unitId,
  topic: unit.topic,
  // ... other fields
  target_resource_profile: targetResourceProfile,     // Pass profile text
  target_resource_embedding: targetResourceEmbedding, // Pass embedding
};
```

### 4. Search Function (`orchestrate-search-resources/index.ts`)

```typescript
// Check for pre-computed embedding from unit
if (input.target_resource_embedding && 
    Array.isArray(input.target_resource_embedding) && 
    input.target_resource_embedding.length === 1536) {
  console.log('✅ Using pre-computed target resource embedding');
  embedding = input.target_resource_embedding;
} else {
  // Fallback: generate on-demand
  const embeddingText = input.target_resource_profile 
    || input.semantic_search_phrase
    || `${input.topic} ${input.description || ''}`;
  
  const result = await callFunction('generate-embedding', {
    text: embeddingText.trim()
  }, authHeader);
  embedding = result.embedding;
}
```

## 📝 SQL Migration

**File:** `CORRECTED_SQL_MIGRATION.sql`

**What it does:**
1. Documents the `structure` column to explain the new fields
2. Creates `extract_target_resource_embeddings()` function
3. Creates `target_resource_embedding_coverage` view
4. Creates `target_embedding_optimization_stats` view

**To run:**
```sql
-- Paste into Supabase SQL Editor and run
-- See CORRECTED_SQL_MIGRATION.sql
```

## 🔍 Verification Queries

### Check embedding coverage
```sql
SELECT * FROM target_resource_embedding_coverage 
ORDER BY created_at DESC 
LIMIT 10;
```

### View overall stats
```sql
SELECT * FROM target_embedding_optimization_stats;
```

### Extract embeddings from a specific structure
```sql
SELECT * FROM extract_target_resource_embeddings('your-structure-uuid');
```

### Inspect a unit directly
```sql
SELECT 
  bs.id,
  bs.blueprint_id,
  unit->>'unit_id' as unit_id,
  unit->>'topic' as topic,
  unit->>'target_resource_profile' as profile,
  (unit->'target_resource_embedding') IS NOT NULL as has_embedding,
  CASE 
    WHEN (unit->'target_resource_embedding') IS NOT NULL 
    THEN jsonb_array_length(unit->'target_resource_embedding')
    ELSE 0
  END as embedding_dimensions
FROM 
  blueprint_structures bs,
  jsonb_array_elements(bs.structure->'content_sections') as section,
  jsonb_array_elements(section->'learning_units') as unit
WHERE bs.id = 'your-structure-uuid'
LIMIT 5;
```

## 🚀 Deployment Steps

1. **Run SQL Migration**
   ```bash
   # Paste CORRECTED_SQL_MIGRATION.sql into Supabase SQL Editor
   ```

2. **Deploy Edge Functions**
   ```bash
   supabase functions deploy generate-structure-legacy
   supabase functions deploy orchestrate-search-resources
   ```

3. **Deploy Frontend**
   ```bash
   npm run build
   # Deploy to your hosting platform
   ```

4. **Test**
   - Create a new blueprint
   - Check logs for "Pre-generating target resource embeddings"
   - Click "Find Resources" on a unit
   - Should see "Using pre-computed target resource embedding"

## ✨ Benefits

1. **Semantic Accuracy** - Embedding describes the IDEAL resource, not just search keywords
2. **Unit-Level Storage** - Each unit has its own embedding, stored with the unit data
3. **Better Context** - `target_resource_profile` provides rich context for matching
4. **Cleaner Architecture** - Embeddings live with the data they describe
5. **Backward Compatible** - Falls back to generating embeddings on-demand if missing

## 🎯 Example

**Unit:**
```json
{
  "unit_id": "unit-thermodynamics-1",
  "topic": "First Law of Thermodynamics",
  "description": "Energy conservation in thermodynamic systems",
  "target_resource_profile": "A comprehensive video explaining the first law of thermodynamics with clear visual examples of energy transfer in closed systems. Should cover heat, work, and internal energy with real-world applications like engines and refrigerators. Ideal for undergraduate engineering students.",
  "target_resource_embedding": [0.023, -0.145, 0.678, ...1533 more values...],
  "search_queries": [
    {"query": "first law thermodynamics tutorial", ...},
    {"query": "energy conservation examples", ...}
  ]
}
```

When searching for resources, the system uses `target_resource_embedding` to find videos that match the IDEAL resource description, not just keyword matches.

## 📚 Files Modified

1. ✅ `supabase/functions/generate-structure-legacy/index.ts`
2. ✅ `supabase/functions/orchestrate-search-resources/index.ts`
3. ✅ `supabase/functions/_shared/types.ts`
4. ✅ `src/pages/Blueprint.jsx`
5. ✅ `CORRECTED_SQL_MIGRATION.sql` (new)

## ✅ Status

**CORRECTED AND READY TO DEPLOY**

All code now correctly stores embeddings at the unit level, embedding the target resource profile description.

---

**Last Updated:** January 5, 2026  
**Status:** Production Ready (Corrected Implementation)

