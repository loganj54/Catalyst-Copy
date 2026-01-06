# Dual Embedding System Explained

## Overview

Your application now uses **TWO different embedding dimensions** for different purposes. This is intentional and optimized for each use case!

## 🎯 The Two Systems

### 1. **Section Caching** (1536 dimensions)
**Storage**: Supabase `cached_sections` table (pgvector)
**Model**: `text-embedding-3-large` with `dimensions=1536`
**Purpose**: Cache blueprint sections to reuse for similar problems

**Flow**:
```
Student A uploads homework
  ↓
Document analyzed → Problem 1: "A 5kg block slides down..."
  ↓
Generate 1536-dim embedding of problem statement
  ↓
Store in Supabase cached_sections table
  ↓
Student B uploads similar homework
  ↓
Search cached_sections with 1536-dim embedding
  ↓
Cache HIT! Reuse Problem 1 structure
```

**Why 1536 dims?**
- Supabase pgvector has 2000-dim limit
- Section caching doesn't need ultra-high precision
- Faster queries
- Already working great

### 2. **Target Profiles & Resources** (3072 dimensions)
**Storage**: Pinecone (namespaces: `target_profiles`, `resources`)
**Model**: `text-embedding-3-large` with `dimensions=3072`
**Purpose**: Match resources to concepts with high precision

**Flow**:
```
Blueprint generated
  ↓
Concept: "Newton's Second Law"
Target Profile: "Clear explanation of F=ma with examples"
  ↓
Generate 3072-dim embedding
  ↓
Store in Pinecone (target_profiles namespace)
  ↓
Later: Search for resources
  ↓
Query Pinecone with 3072-dim embedding
  ↓
Find highly relevant YouTube videos
```

**Why 3072 dims?**
- 2x more semantic information
- Better resource matching
- Pinecone supports unlimited dimensions
- Worth the extra precision for resource quality

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Document Upload                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Document Analysis                               │
│  Extracts: Problems, Topics, Concepts                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Blueprint Generation                                │
│                                                                  │
│  For each section (Problem/Topic):                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Section Caching (1536 dims → Supabase)                 │    │
│  │ • Generate embedding of problem statement               │    │
│  │ • Check cached_sections for similar problems           │    │
│  │ • If cache miss: Generate new structure                │    │
│  │ • Store in cached_sections with 1536-dim embedding     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  For each concept in section:                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Target Profiles (3072 dims → Pinecone)                 │    │
│  │ • Generate target resource profile                      │    │
│  │ • Generate 3072-dim embedding                           │    │
│  │ • Store in Pinecone (target_profiles namespace)         │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Resource Search (User clicks button)                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Query Pinecone (3072 dims)                              │    │
│  │ • Get target profile embedding from blueprint           │    │
│  │ • Search resources namespace for cached resources       │    │
│  │ • If cache hit: Return resources                        │    │
│  │ • If cache miss: Perform web search                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  If web search performed:                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Store Resources (3072 dims → Pinecone)                  │    │
│  │ • Fetch transcripts                                      │    │
│  │ • Analyze content                                        │    │
│  │ • Generate 3072-dim embedding                            │    │
│  │ • Store in Pinecone (resources namespace)                │    │
│  │ • Store metadata in Supabase                             │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Technical Implementation

### Function: `generateEmbedding1536(text)`
**File**: `supabase/functions/_shared/embeddings.ts`
**Used by**: Section caching system
**Returns**: 1536-dimensional vector
```typescript
{
  model: 'text-embedding-3-large',
  dimensions: 1536,
  input: "A 5kg block slides down a frictionless incline..."
}
```

### Function: `generateEmbedding(text)`
**File**: `supabase/functions/_shared/embeddings.ts`
**Used by**: Target profiles, resource caching
**Returns**: 3072-dimensional vector
```typescript
{
  model: 'text-embedding-3-large',
  dimensions: 3072,
  input: "Clear explanation of F=ma with real-world examples..."
}
```

## 📦 Storage Locations

### Supabase (1536 dims)
```
cached_sections table:
├── section_id
├── section_type (problem/topic)
├── section_embedding (vector(1536))  ← 1536 dimensions
├── cached_unit (JSONB)
└── metadata...
```

### Pinecone (3072 dims)
```
target_profiles namespace:
├── target-{blueprint_id}-{section}-{unit}
│   ├── values: [3072-dim vector]
│   └── metadata: { topic, target_profile, ... }

resources namespace:
├── resource-{timestamp}-{random}
│   ├── values: [3072-dim vector]
│   └── metadata: { url, title, platform, ... }
```

## 💡 Why This Design?

### Benefits of Dual System:
1. **Optimized for each use case**
   - Section caching: Fast, good enough precision
   - Resource matching: High precision, better quality

2. **Works within constraints**
   - Supabase pgvector: 2000-dim limit
   - Pinecone: Unlimited dimensions

3. **Cost-effective**
   - Section caching: Less frequent, 1536 dims cheaper
   - Resource matching: More critical, worth 3072 dims

4. **Backwards compatible**
   - Existing section cache continues working
   - New Pinecone system adds capabilities

### Alternative Considered (Rejected):
**Move everything to Pinecone (3072 dims)**
- ❌ Section caching already works great in Supabase
- ❌ Would require migration of existing cache
- ❌ Adds complexity without clear benefit
- ❌ Pinecone costs more than Supabase pgvector

## 🧪 Testing

### Test Section Caching (1536 dims):
1. Upload a homework document
2. Check logs for: `"Generating 1536-dim embedding for section caching"`
3. Check Supabase `cached_sections` table
4. Upload similar homework → should hit cache

### Test Target Profiles (3072 dims):
1. Generate a blueprint
2. Check logs for: `"Upserting X target profile vectors to Pinecone"`
3. Open `test-pinecone.html`
4. Search target_profiles namespace → should find vectors

### Test Resource Caching (3072 dims):
1. Search for resources for a concept
2. Check logs for: `"Stored vector in Pinecone: resource-..."`
3. Open `test-pinecone.html`
4. Search resources namespace → should find vectors

## 📝 Summary

| Feature | Dimensions | Storage | Model | Purpose |
|---------|-----------|---------|-------|---------|
| **Section Caching** | 1536 | Supabase pgvector | text-embedding-3-large | Reuse blueprint sections |
| **Target Profiles** | 3072 | Pinecone | text-embedding-3-large | Match resources to concepts |
| **Resource Caching** | 3072 | Pinecone | text-embedding-3-large | Cache found resources |

**Key Insight**: Same model (`text-embedding-3-large`), different dimensions based on use case and storage constraints!

---

✅ **Your error is now fixed!** Section caching uses 1536 dims (Supabase compatible), while resource matching uses 3072 dims (Pinecone, higher precision).

