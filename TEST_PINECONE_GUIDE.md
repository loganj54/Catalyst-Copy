# Test Pinecone Browser Guide

## Overview

The `test-pinecone.html` page now has expanded capabilities to search and inspect all your Pinecone namespaces!

## Features

### 1. Store Test Vector
**Purpose**: Add a test vector to the `test` namespace
**How to use**:
1. Enter any text (e.g., "Newton's Laws of Motion")
2. Click "Store Vector in Pinecone"
3. A 3072-dimensional embedding will be created and stored

### 2. Search Test Namespace
**Purpose**: Search for similar vectors in the `test` namespace
**How to use**:
1. Enter a search query (e.g., "force and acceleration")
2. Click "Search Pinecone"
3. See matching test vectors with similarity scores

### 3. Search Target Profiles Namespace ⭐ NEW
**Purpose**: Search for target resource profiles from your blueprints
**How to use**:
1. First, generate a blueprint in your app (this creates target profiles)
2. Enter a search query (e.g., "Newton's Laws explanation")
3. Click "Search Target Profiles"
4. See matching target profiles with:
   - Blueprint ID
   - Topic name
   - Unit type (topic/walkthrough)
   - Section type (problem/prerequisite)
   - Target profile text

**What you'll see**:
```
Match 1:
  ID: target-bp123-problem1-concept-a
  Similarity: 94.23%
  Topic: Newton's Second Law
  Unit Type: topic
  Section: problem
  Blueprint ID: bp123
  Target Profile: A clear explanation of F=ma with real-world examples...
```

### 4. Search Resources Namespace ⭐ NEW
**Purpose**: Search for cached educational resources
**How to use**:
1. First, search for resources in your app (this caches them)
2. Enter a search query (e.g., "physics tutorial")
3. Click "Search Resources"
4. See matching resources with:
   - Title
   - Platform (YouTube, Khan Academy, etc.)
   - URL
   - Topic signature

**What you'll see**:
```
Match 1:
  ID: resource-1704123456789-x7k2p
  Similarity: 96.78%
  Title: Understanding Newton's Second Law
  Platform: YouTube
  URL: https://youtube.com/watch?v=...
  Signature: Explains F=ma with examples of acceleration...
```

### 5. Get Index Statistics
**Purpose**: See total vector counts per namespace
**How to use**:
1. Click "Get Stats"
2. See breakdown by namespace:
   - `target_profiles`: Vectors from blueprints
   - `resources`: Cached resources
   - `test`: Test vectors

**What you'll see**:
```json
{
  "namespaces": {
    "target_profiles": { "vectorCount": 15 },
    "resources": { "vectorCount": 8 },
    "test": { "vectorCount": 1 }
  },
  "dimension": 3072,
  "indexFullness": 0.00001
}
```

## Testing Workflow

### Test 1: Verify Blueprint Integration
```
1. Generate a blueprint in your app
   → Upload a document
   → Wait for blueprint to generate

2. Open test-pinecone.html
   → Click "Get Stats"
   → Check target_profiles count (should match # of concepts)

3. Search for a concept
   → Enter concept name (e.g., "Newton's Laws")
   → Click "Search Target Profiles"
   → Should find matching target profiles
```

### Test 2: Verify Resource Caching
```
1. Search for resources in your app
   → Open a blueprint
   → Click "Search Resources" for any concept
   → Wait for results

2. Open test-pinecone.html
   → Click "Get Stats"
   → Check resources count (should be 3+ per search)

3. Search for similar resources
   → Enter related query (e.g., "physics tutorial")
   → Click "Search Resources"
   → Should find cached resources
```

### Test 3: End-to-End Flow
```
1. Start fresh
   → Click "Get Stats" - note current counts

2. Generate blueprint
   → Upload document in app
   → Wait for completion
   → Click "Get Stats" again
   → target_profiles should increase

3. Search for resources
   → Search for resources for a concept
   → Click "Get Stats" again
   → resources should increase by 3

4. Verify similarity search
   → Search target_profiles for concept
   → Search resources for similar content
   → Both should return results
```

## Interpreting Results

### Similarity Scores
- **95-100%**: Excellent match (cache hit)
- **85-95%**: Good match (related content)
- **70-85%**: Moderate match (somewhat related)
- **Below 70%**: Weak match (probably not relevant)

### Vector IDs
- `target-{blueprint_id}-{section}-{unit}`: Target profile
- `resource-{timestamp}-{random}`: Cached resource
- `test-{timestamp}`: Test vector

### Metadata Fields

**Target Profiles**:
- `blueprint_id`: Which blueprint this came from
- `unit_id`: Concept identifier
- `topic`: Concept name
- `section_type`: problem/prerequisite/topic
- `target_profile`: Description of ideal resource

**Resources**:
- `url`: Resource link
- `title`: Resource title
- `platform`: YouTube/Khan Academy/etc.
- `topic_signature`: Rich content description

## Troubleshooting

### "No matches found"
- **Target profiles**: Generate a blueprint first
- **Resources**: Search for resources in the app first
- **Test**: Store a test vector first

### "Pinecone credentials not configured"
- Check Supabase secrets are set
- Verify `PINECONE_API_KEY` and `PINECONE_INDEX_HOST`

### Low similarity scores
- Try more specific queries
- Ensure you're searching the right namespace
- Check that vectors were actually stored (use "Get Stats")

## Advanced Usage

### Compare Namespaces
1. Search for "Newton's Laws" in target_profiles
2. Search for "Newton's Laws" in resources
3. Compare results - target profiles are "what you want", resources are "what you found"

### Monitor Growth
1. Note initial stats
2. Use your app normally
3. Check stats periodically
4. Watch namespaces grow over time

### Debug Cache Misses
1. Generate blueprint → check target_profiles
2. Search resources → check resources
3. Search again → should hit cache (check similarity scores)

---

**Your test page is now a full Pinecone inspector!** 🔍

Use it to verify that:
- ✅ Blueprints create target profiles
- ✅ Resource searches cache properly
- ✅ Similarity search works across namespaces
- ✅ Vector counts grow as expected

