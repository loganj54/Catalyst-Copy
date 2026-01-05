# Functions Orchestration - Quick Reference Guide

## 📋 Overview

This document shows all 26 atomic functions, how they connect, their inputs/outputs, and the order they execute in their orchestrations.

---

## 🎯 Three Main Orchestrations

### 1. **Search Resources** → 10 functions
### 2. **Analyze Document** → 7 functions  
### 3. **Generate Structure** → 9 functions

---

## 🔍 ORCHESTRATION #1: Search Resources

**Purpose**: Find educational videos/resources for a topic

### Functions & Flow

```
User searches for "Thermodynamics" →

┌─────────────────────────────────────────────────────────────┐
│  orchestrate-search-resources                                │
│  Composes all search functions into complete workflow        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  1. get-or-generate-embedding  ⚡ OPTIMIZED!                 │
│  Input:  {                                                   │
│    text: "thermodynamics basics",                            │
│    embedding?: [pre-computed from structure generation]      │
│  }                                                           │
│  Process:                                                    │
│    - IF embedding provided (from blueprint_structures):      │
│      • Use it directly (FAST PATH - no API call!)           │
│      • Time: ~0ms                                            │
│    - ELSE (legacy/fallback):                                 │
│      • Generate embedding via OpenAI API (SLOW PATH)         │
│      • Time: ~200ms                                          │
│  Output: { embedding: [0.123, 0.456, ...] } (1536 floats)   │
│  Time:   ~0ms (cached) or ~200ms (generated)                 │
│  Optimization: 75% faster when using pre-computed embeddings │
│  See: QUERY_EMBEDDING_OPTIMIZATION.md                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. search-db-cache                                          │
│  Input:  { embedding: [...], subject: "Physics" }           │
│  Output: { results: [...], cached: true/false }             │
│  Time:   ~100ms (vector search in database)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Cache hit? → Return results]
                    [Cache miss? → Continue below]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3a. search-youtube  (parallel)                              │
│  Input:  { query: "thermodynamics", maxResults: 5 }         │
│  Output: { videos: [{videoId, title, url}...] }             │
│  Time:   ~500ms (YouTube API)                                │
│                                                              │
│  3b. search-claude-web  (parallel)                           │
│  Input:  { queries: ["thermodynamics video"] }              │
│  Output: { videos: [{title, url, source}...] }              │
│  Time:   ~2-3s (Claude with web_search tool)                │
│                                                              │
│  3c. search-grok  (parallel) [FUTURE]                        │
│  Input:  { queries: ["thermodynamics"] }                    │
│  Output: { videos: [...] }                                  │
│  Time:   ~1-2s (Grok API)                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
            [Combine all search results]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. analyze-transcript (for each video)                      │
│  Input:  { videoId: "abc123", url: "youtube.com/..." }      │
│  Process:                                                    │
│    - Fetch transcript from YouTube                           │
│    - Call Claude to analyze relevance                        │
│  Output: {                                                   │
│    relevance_score: 0.85,                                    │
│    key_topics: ["heat", "energy"],                           │
│    summary: "Covers basics..."                               │
│  }                                                           │
│  Time:   ~2-4s per video                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
            [Filter: Keep only relevant resources]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. store-resource (for each resource)                       │
│  Input:  {                                                   │
│    url: "youtube.com/watch?v=...",                           │
│    title: "Thermodynamics 101",                              │
│    resource_type: "youtube_video",                           │
│    embedding: [...]                                          │
│  }                                                           │
│  Process:                                                    │
│    - Check for duplicates (by URL)                           │
│    - Upsert to curated_resources table                       │
│  Output: { resource_id: "uuid-123" }                         │
│  Time:   ~100ms per resource                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. link-resource-to-blueprint (for each resource)           │
│  Input:  {                                                   │
│    resource_id: "uuid-123",                                  │
│    blueprint_id: "uuid-456",                                 │
│    topic_id: "uuid-789"                                      │
│  }                                                           │
│  Process:                                                    │
│    - Create junction table entry                             │
│    - Link resource to specific blueprint section             │
│  Output: { success: true, link_id: "uuid-abc" }             │
│  Time:   ~50ms per link                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  7. generate-resource-explanations                           │
│  Input:  {                                                   │
│    resources: [{id, title, summary}...],                     │
│    blueprint_topic: "Laws of Thermodynamics"                 │
│  }                                                           │
│  Process:                                                    │
│    - Call Claude to explain why each resource is relevant    │
│    - Generate learning guidance                              │
│  Output: {                                                   │
│    explanations: [{                                          │
│      resource_id: "uuid-123",                                │
│      explanation: "This video covers the first law..."       │
│    }]                                                        │
│  }                                                           │
│  Time:   ~2-3s total                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
                [Return final results to user]
```

### Summary of Search Resources Functions

| # | Function Name | Input | Output | Time |
|---|---------------|-------|--------|------|
| 1 | `generate-embedding` | text | embedding array | ~200ms |
| 2 | `search-db-cache` | embedding | cached resources | ~100ms |
| 3a | `search-youtube` | query | video results | ~500ms |
| 3b | `search-claude-web` | queries | video results | ~2-3s |
| 3c | `search-grok` | queries | video results | ~1-2s |
| 4 | `analyze-transcript` | videoId | relevance data | ~2-4s |
| 5 | `store-resource` | resource data | resource_id | ~100ms |
| 6 | `link-resource-to-blueprint` | ids | link_id | ~50ms |
| 7 | `generate-resource-explanations` | resources + topic | explanations | ~2-3s |
| 10 | `orchestrate-search-resources` | search params | final results | ~5-15s |

---

## 📄 ORCHESTRATION #2: Analyze Document

**Purpose**: Analyze uploaded document and extract learning objectives

### Functions & Flow

```
User uploads "Physics_HW_5.pdf" →

┌─────────────────────────────────────────────────────────────┐
│  orchestrate-analyze-document                                │
│  Composes all analysis functions                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  1. check-existing-analysis                                  │
│  Input:  { document_id: "uuid-123" }                         │
│  Process:                                                    │
│    - Query document_analyses table                           │
│    - Check if analysis exists                                │
│  Output: {                                                   │
│    exists: true/false,                                       │
│    analysis: {...} (if exists)                               │
│  }                                                           │
│  Time:   ~50ms                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
            [If exists and not force_reanalyze → Return cached]
            [If doesn't exist → Continue below]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. fetch-document                                           │
│  Input:  {                                                   │
│    document_url: "supabase.co/storage/class_documents/..."   │
│  }                                                           │
│  Process:                                                    │
│    - Parse URL to get bucket + path                          │
│    - Fetch with Supabase auth                                │
│    - Handle public/private buckets                           │
│    - Return as ArrayBuffer                                   │
│  Output: {                                                   │
│    buffer: ArrayBuffer,                                      │
│    content_type: "application/pdf",                          │
│    size: 1234567                                             │
│  }                                                           │
│  Time:   ~500ms-2s (depends on file size)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Is PDF? → Continue]
                    [Is image? → Skip to step 4]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. parse-pdf-to-base64                                      │
│  Input:  { buffer: ArrayBuffer }                             │
│  Process:                                                    │
│    - Convert ArrayBuffer to base64                           │
│    - Check size limits (5MB for Haiku, 10MB for Sonnet)     │
│    - Split large PDFs if needed                              │
│  Output: {                                                   │
│    base64: "JVBERi0xLjQKJ...",                               │
│    pages: 12,                                                │
│    size_mb: 2.5                                              │
│  }                                                           │
│  Time:   ~100-500ms (depends on PDF size)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. analyze-with-claude                                      │
│  Input:  {                                                   │
│    base64_pdf: "...",                                        │
│    filename: "Physics_HW_5.pdf",                             │
│    user_instructions: "Focus on thermodynamics"              │
│  }                                                           │
│  Process:                                                    │
│    - Call Claude Vision API                                  │
│    - Use analysis prompt from _shared/prompts.ts             │
│    - Extract: subject, topics, prerequisites, objectives     │
│  Output: {                                                   │
│    subject_area: "Physics",                                  │
│    specific_topic: "Thermodynamics Problems",                │
│    key_concepts: ["entropy", "heat transfer"],               │
│    document_type: "problem_set",                             │
│    prerequisites: ["calculus", "basic physics"],             │
│    learning_objectives: ["Solve entropy problems"],          │
│    questions_count: 5,                                       │
│    metadata: {...}                                           │
│  }                                                           │
│  Time:   ~8-15s (Claude with vision)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. store-analysis                                           │
│  Input:  {                                                   │
│    document_id: "uuid-123",                                  │
│    analysis: {...from step 4...}                             │
│  }                                                           │
│  Process:                                                    │
│    - Insert into document_analyses table                     │
│    - Link to original document                               │
│    - Calculate derived fields                                │
│  Output: {                                                   │
│    analysis_id: "uuid-456",                                  │
│    success: true                                             │
│  }                                                           │
│  Time:   ~100ms                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. generate-blueprint-name                                  │
│  Input:  {                                                   │
│    analysis: {...},                                          │
│    filename: "Physics_HW_5.pdf"                              │
│  }                                                           │
│  Process:                                                    │
│    - Call Claude with naming prompt                          │
│    - Generate user-friendly blueprint name                   │
│  Output: {                                                   │
│    name: "Thermodynamics Problem Set 5 - Entropy & Heat"    │
│  }                                                           │
│  Time:   ~1-2s                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
            [Return analysis + blueprint name to user]
```

### Summary of Analyze Document Functions

| # | Function Name | Input | Output | Time |
|---|---------------|-------|--------|------|
| 11 | `check-existing-analysis` | document_id | exists + analysis | ~50ms |
| 12 | `fetch-document` | document_url | file buffer | ~500ms-2s |
| 13 | `parse-pdf-to-base64` | buffer | base64 string | ~100-500ms |
| 14 | `analyze-with-claude` | base64 + filename | analysis object | ~8-15s |
| 15 | `store-analysis` | analysis data | analysis_id | ~100ms |
| 16 | `generate-blueprint-name` | analysis | blueprint name | ~1-2s |
| 17 | `orchestrate-analyze-document` | document info | full analysis | ~10-20s |

---

## 🏗️ ORCHESTRATION #3: Generate Structure

**Purpose**: Create learning structure (units, sections, resources) for document

### Functions & Flow

```
User requests "Generate Blueprint" →

┌─────────────────────────────────────────────────────────────┐
│  orchestrate-generate-structure                              │
│  Composes all structure generation functions                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  1. fetch-analysis                                           │
│  Input:  {                                                   │
│    blueprint_id?: "uuid-123",                                │
│    document_id?: "uuid-456"                                  │
│  }                                                           │
│  Process:                                                    │
│    - Try multiple strategies to find analysis:               │
│      1) Direct by document_id                                │
│      2) Via blueprint_id                                     │
│      3) By filename match                                    │
│  Output: {                                                   │
│    analysis_id: "uuid-789",                                  │
│    analysis: {subject, topics, objectives...}                │
│  }                                                           │
│  Time:   ~100-200ms                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. check-structure-cache  ⚡ NEW!                           │
│  Input:  {                                                   │
│    analysis: {...},                                          │
│    similarity_threshold: 0.92                                │
│  }                                                           │
│  Process:                                                    │
│    - Generate embeddings for subject/topics                  │
│    - Vector search in cached_blueprint_structures            │
│    - Find similar structures (92%+ similarity)               │
│  Output: {                                                   │
│    hit: true/false,                                          │
│    cached_structure: {...},                                  │
│    similarity: 0.95,                                         │
│    cache_id: "uuid-abc"                                      │
│  }                                                           │
│  Time:   ~500ms                                              │
│  Savings: ~24,000 tokens if cache hit! 🎉                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Cache hit? → Go to step 3]
                    [Cache miss? → Go to step 4]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. adapt-cached-structure  (IF CACHE HIT)                   │
│  Input:  {                                                   │
│    cached_structure: {...},                                  │
│    new_analysis: {...}                                       │
│  }                                                           │
│  Note: After adaptation, embeddings are generated for        │
│        all search queries (see step 5a)                      │
│  Process:                                                    │
│    - Keep learning flow and structure                        │
│    - Update titles to match new document                     │
│    - Adapt section IDs                                       │
│    - Update prerequisites based on new analysis              │
│    - Adjust search queries for new topics                    │
│  Output: {                                                   │
│    structure: {                                              │
│      summary: {...},                                         │
│      prerequisites: [...],                                   │
│      learning_units: [{                                      │
│        id: "unit-1-new",                                     │
│        title: "Understanding Thermodynamics",                │
│        sections: [...]                                       │
│      }],                                                     │
│      from_cache: true,                                       │
│      cache_similarity: 0.95                                  │
│    }                                                         │
│  }                                                           │
│  Time:   ~200-500ms                                          │
│                                                              │
│  → SKIP TO STEP 5                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. generate-structure-with-ai  (IF CACHE MISS)              │
│  Input:  {                                                   │
│    analysis: {subject, topics, prerequisites...}             │
│  }                                                           │
│  Process:                                                    │
│    - Call Claude with structure generation prompt            │
│    - Use JSON mode for structured output                     │
│    - Request: summary, prerequisites, learning units         │
│    - Each unit has: title, objectives, sections              │
│    - Each section has: title, content, resources, queries    │
│  Output: {                                                   │
│    structure: {                                              │
│      summary: {                                              │
│        title: "Thermodynamics Problem Set",                  │
│        overview: "This problem set covers...",               │
│        estimated_time: 120,                                  │
│        difficulty: "intermediate"                            │
│      },                                                      │
│      prerequisites: [{                                       │
│        topic: "Calculus",                                    │
│        importance: "high",                                   │
│        resources: [...]                                      │
│      }],                                                     │
│      learning_units: [{                                      │
│        id: "unit-1",                                         │
│        title: "First Law of Thermodynamics",                 │
│        order: 1,                                             │
│        sections: [{                                          │
│          id: "section-1-1",                                  │
│          title: "Energy Conservation",                       │
│          objectives: ["Understand energy transfer"],         │
│          content: "...",                                     │
│          resource_queries: ["first law video"],              │
│          estimated_time: 30                                  │
│        }]                                                    │
│      }]                                                      │
│    }                                                         │
│  }                                                           │
│  Time:   ~10-20s (Claude Haiku with 12k tokens)              │
│  Cost:   ~24,000 tokens (~$0.06)                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5a. generate-query-embeddings  ⚡ NEW OPTIMIZATION!         │
│  Input:  {                                                   │
│    all_search_queries: [{                                    │
│      unit_id, query, target_content, semantic_search_phrase │
│    }]                                                        │
│  }                                                           │
│  Process:                                                    │
│    - For each search query:                                  │
│      • Use semantic_search_phrase (preferred) or construct   │
│        from topic + target_content + query                   │
│      • Generate 1536-dim embedding via OpenAI API            │
│      • Attach embedding to query object                      │
│    - Store embeddings in blueprint_structures table          │
│  Output: {                                                   │
│    all_search_queries: [{ ...query, embedding: [1536 dims] }]│
│  }                                                           │
│  Time:   ~2-5s (depends on number of queries)                │
│  Benefit: Eliminates redundant embedding generation during   │
│           resource search (75% faster searches!)             │
│  See: QUERY_EMBEDDING_OPTIMIZATION.md for details           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5b. process-equations                                       │
│  Input:  {                                                   │
│    structure: {...with all units/sections...},              │
│    analysis: {...}                                           │
│  }                                                           │
│  Process:                                                    │
│    - Extract equations from content                          │
│    - For each equation:                                      │
│      • Store in equations table                              │
│      • Link to learning_units                                │
│      • Link to sections                                      │
│  Output: {                                                   │
│    equations: [{                                             │
│      id: "eq-1",                                             │
│      latex: "E = mc^2",                                      │
│      description: "Mass-energy equivalence",                 │
│      unit_id: "unit-1",                                      │
│      section_id: "section-1-1"                               │
│    }]                                                        │
│  }                                                           │
│  Time:   ~200-500ms                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. source-figures                                           │
│  Input:  {                                                   │
│    structure: {...},                                         │
│    key_concepts: ["heat transfer", "entropy"]                │
│  }                                                           │
│  Process:                                                    │
│    - Search Wikimedia Commons for relevant figures           │
│    - Use _shared/figure-sourcing.ts                          │
│    - For each section, find 1-2 figures                      │
│    - Store in figures table                                  │
│    - Link to sections                                        │
│  Output: {                                                   │
│    figures: [{                                               │
│      id: "fig-1",                                            │
│      title: "Heat Transfer Diagram",                         │
│      url: "commons.wikimedia.org/...",                       │
│      caption: "Illustration of...",                          │
│      section_id: "section-1-1",                              │
│      license: "CC-BY-SA"                                     │
│    }]                                                        │
│  }                                                           │
│  Time:   ~1-3s (depends on number of sections)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  7. store-structure                                          │
│  Input:  {                                                   │
│    blueprint_id: "uuid-123",                                 │
│    structure: {...entire structure...},                      │
│    from_cache: true/false,                                   │
│    cache_source_id?: "uuid-abc"                              │
│  }                                                           │
│  Process:                                                    │
│    - Store in blueprint_structures table                     │
│    - Store all_search_queries with embeddings ⚡ NEW!        │
│    - Calculate metrics:                                      │
│      • Total units                                           │
│      • Total sections                                        │
│      • Estimated completion time                             │
│      • Difficulty level                                      │
│    - Store metadata (from_cache, similarity, model_used)     │
│  Output: {                                                   │
│    structure_id: "uuid-def",                                 │
│    metrics: {                                                │
│      units: 5,                                               │
│      sections: 23,                                           │
│      estimated_time: 180,                                    │
│      difficulty: "intermediate"                              │
│    }                                                         │
│  }                                                           │
│  Time:   ~100-300ms                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  8. cache-structure  (IF GENERATED WITH AI)                  │
│  Input:  {                                                   │
│    structure: {...},                                         │
│    analysis: {...}                                           │
│  }                                                           │
│  Process:                                                    │
│    - Generate embeddings:                                    │
│      • Subject area embedding                                │
│      • Topics embedding                                      │
│      • Characteristics embedding                             │
│    - Store in cached_blueprint_structures                    │
│    - Initialize: times_used=0, quality_score=1.0             │
│  Output: {                                                   │
│    cache_id: "uuid-xyz",                                     │
│    cached: true                                              │
│  }                                                           │
│  Time:   ~500ms                                              │
│  Future Benefit: Enable cache hits for similar documents!    │
└─────────────────────────────────────────────────────────────┘
                            ↓
        [Return complete structure to user with sections]
        [Frontend displays blueprint with all sections]
```

### Summary of Generate Structure Functions

| # | Function Name | Input | Output | Time |
|---|---------------|-------|--------|------|
| 18 | `fetch-analysis` | document/blueprint id | analysis object | ~100-200ms |
| 19 | `check-structure-cache` | analysis | cache hit/miss | ~500ms |
| 20 | `adapt-cached-structure` | cached + new analysis | adapted structure | ~200-500ms |
| 21 | `generate-structure-with-ai` | analysis | full structure | ~10-20s |
| 22 | `process-equations` | structure | equation links | ~200-500ms |
| 23 | `source-figures` | structure + concepts | figure links | ~1-3s |
| 24 | `store-structure` | structure data | structure_id | ~100-300ms |
| 25 | `cache-structure` | structure + analysis | cache_id | ~500ms |
| 26 | `orchestrate-generate-structure` | blueprint_id | complete structure | ~2-25s |

---

## 📊 Performance Comparison

### With Cache Hit (80-90% of similar documents)
```
Total Time: ~2-5 seconds
Total Tokens: ~2,000-3,000
Total Cost: ~$0.005-0.008

Flow: fetch-analysis → check-cache → adapt → process-equations → 
      source-figures → store → done ✅
```

### With Cache Miss (first time seeing this topic)
```
Total Time: ~15-30 seconds
Total Tokens: ~24,000-28,000
Total Cost: ~$0.06-0.08

Flow: fetch-analysis → check-cache → generate-with-AI → process-equations → 
      source-figures → store → cache-structure → done ✅
```

---

## 🔄 Complete User Journey Example

### Student uploads "Physics_Chapter_5_Thermodynamics.pdf"

```
STEP 1: Document Upload
├─ File stored in Supabase Storage
├─ Document record created
└─ Time: ~1-2s

STEP 2: Document Analysis (Orchestration #2)
├─ check-existing-analysis → not found
├─ fetch-document → got PDF
├─ parse-pdf-to-base64 → converted
├─ analyze-with-claude → extracted topics
├─ store-analysis → saved
└─ generate-blueprint-name → "Thermodynamics Chapter 5"
└─ Time: ~10-20s

STEP 3: Generate Structure (Orchestration #3)
├─ fetch-analysis → found analysis
├─ check-structure-cache → CACHE HIT! (another student did similar chapter)
├─ adapt-cached-structure → adapted to new document
├─ process-equations → linked 12 equations
├─ source-figures → found 8 figures
├─ store-structure → saved to database
└─ Time: ~3-5s ⚡ (saved ~24,000 tokens!)

STEP 4: Resource Finding (Orchestration #1) - Per Section
User clicks "Find Resources" on Section 1.1
├─ generate-embedding → created embedding for "First Law Thermodynamics"
├─ search-db-cache → found 3 cached videos
├─ (Skip external searches - cache hit)
├─ generate-resource-explanations → explained why relevant
└─ Time: ~2-3s

User clicks "Find Resources" on Section 1.2 (no cache)
├─ generate-embedding → created embedding
├─ search-db-cache → no results
├─ search-youtube (parallel) → found 5 videos
├─ search-claude-web (parallel) → found 3 videos
├─ analyze-transcript × 8 → analyzed all videos
├─ store-resource × 8 → stored in database
├─ link-resource-to-blueprint × 8 → linked to section
└─ generate-resource-explanations → explained relevance
└─ Time: ~8-12s

TOTAL TIME: 23-40 seconds (with caching)
WITHOUT CACHING: 40-60 seconds
TOKEN SAVINGS: ~24,000 tokens (~$0.06)
```

---

## 🎯 Key Insights

### Parallel Execution
- Search functions (YouTube, Claude, Grok) run **in parallel**
- Transcript analysis runs **in parallel** for multiple videos
- Figure sourcing can run **in parallel** for sections

### Caching Layers
1. **Structure Cache** - Saves ~24,000 tokens per similar document
2. **Resource Cache** - Saves ~2-3s per section with cached resources
3. **Analysis Cache** - Prevents re-analyzing same document

### Error Handling
- All functions wrapped with `withSelfHealing()`
- Errors logged to `function_errors` table
- Self-healing agent auto-updates DIRECTIVES.md
- Graceful degradation (e.g., skip figure sourcing if fails)

### Cost Breakdown
- **Generate Structure (with AI)**: ~$0.06
- **Generate Structure (cached)**: ~$0.005
- **Analyze Document**: ~$0.02-0.03
- **Search Resources**: ~$0.01-0.02 per section
- **Total per document**: ~$0.08-0.15 (first time), ~$0.03-0.05 (cached)

---

## 📝 Quick Command Reference

### Deploy Functions
```bash
# Deploy single function
supabase functions deploy generate-embedding

# Deploy all functions
supabase functions deploy --project-ref your-project-ref

# Test function locally
supabase functions serve generate-embedding
```

### Test Function
```bash
curl -i --location --request POST \
  'https://your-project.supabase.co/functions/v1/generate-embedding' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"text":"thermodynamics basics"}'
```

### Check Logs
```sql
-- View recent errors
SELECT * FROM function_errors 
ORDER BY created_at DESC 
LIMIT 10;

-- View cache statistics
SELECT * FROM cache_statistics;

-- View most used cached structures
SELECT subject_area, specific_topic, times_used, times_used * 24000 as tokens_saved
FROM cached_blueprint_structures
ORDER BY times_used DESC
LIMIT 10;
```

---

## ✅ Status of Implementation

| Orchestration | Status | Functions Complete |
|---------------|--------|-------------------|
| Search Resources | ✅ LIVE | 9/9 complete (Grok pending) |
| Analyze Document | ✅ LIVE | 6/6 complete |
| Generate Structure | ✅ LIVE + CACHED | 8/8 complete |

**All infrastructure complete**: Self-healing, error tracking, types, shared utilities

---

**Document Version**: 1.0  
**Last Updated**: January 5, 2026  
**Author**: System Documentation

