# Pinecone Namespace Organization Guide

## Overview

Your Pinecone index uses **namespaces** to organize different types of vectors. Think of namespaces like folders - they keep different types of data separate and organized.

## Namespace Structure

```
catalyst-resources (Pinecone Index)
├── target_profiles/     ← Target resource profiles from blueprints
├── resources/           ← Actual found resources (videos, articles)
├── blueprints/          ← Full blueprint sections (future)
├── equations/           ← Mathematical equations (future)
├── figures/             ← Diagrams and figures (future)
└── test/                ← Test vectors
```

## Active Namespaces

### 1. `target_profiles` Namespace
**What**: Target resource profiles from each learning unit in blueprints
**When stored**: During blueprint generation (Step 2)
**Vector ID format**: `target-{blueprint_id}-{section_id}-{unit_id}`

**Example vectors**:
- `target-abc123-prereq-unit1` - Prerequisite unit target profile
- `target-abc123-problem1-concept-a` - Problem 1, Concept A target profile
- `target-abc123-topic2-concept-b` - Topic 2, Concept B target profile

**Metadata stored**:
```json
{
  "blueprint_id": "abc123",
  "section_id": "problem1",
  "unit_id": "concept-a",
  "unit_type": "topic",
  "topic": "Newton's Second Law",
  "section_type": "problem",
  "target_profile": "A clear explanation of F=ma with real-world examples...",
  "type": "target_profile"
}
```

**Purpose**: 
- Each concept in your blueprint has an "ideal resource profile"
- These get stored in Pinecone for future matching
- When searching for resources, we can match against these profiles

### 2. `resources` Namespace
**What**: Actual educational resources found via web search
**When stored**: During resource search (Step 3)
**Vector ID format**: `resource-{timestamp}-{random}`

**Example vectors**:
- `resource-1704123456789-x7k2p` - YouTube video about Newton's Laws
- `resource-1704123457890-m9n4q` - Khan Academy article on forces

**Metadata stored**:
```json
{
  "url": "https://youtube.com/watch?v=...",
  "title": "Understanding Newton's Second Law",
  "platform": "YouTube",
  "topic_signature": "Explains F=ma with examples of acceleration...",
  "type": "resource"
}
```

**Purpose**:
- Cache found resources for reuse
- When another student needs similar content, return cached resources
- Avoid redundant web searches

### 3. `test` Namespace
**What**: Test vectors for debugging
**When stored**: Manual testing via `test-pinecone.html`
**Vector ID format**: `test-{timestamp}`

**Purpose**: Safe testing without affecting production data

## How They Work Together

### Blueprint Generation Flow:
```
1. User uploads document
2. Document analyzed → blueprint structure created
3. For each learning unit:
   a. Generate target resource profile
   b. Create 3072-dim embedding
   c. Store in Pinecone (namespace: target_profiles)
   d. Store in blueprint structure (Supabase)
```

### Resource Search Flow:
```
1. User clicks "Search Resources" for a concept
2. Get target profile from blueprint
3. Query Pinecone:
   a. Search target_profiles namespace for similar profiles
   b. Search resources namespace for cached resources
4. If cache miss:
   a. Perform web search
   b. Store new resources in Pinecone (namespace: resources)
5. Return resources to user
```

## Example: Complete Flow

### Step 1: Blueprint Generation
```
Document: "Physics Homework on Forces"

Generated Learning Units:
- Problem 1, Concept A: "Newton's Second Law"
  → Target profile: "Clear explanation of F=ma with examples"
  → Stored in Pinecone: target-bp123-problem1-concept-a
  
- Problem 1, Concept B: "Free Body Diagrams"
  → Target profile: "Visual guide to drawing force diagrams"
  → Stored in Pinecone: target-bp123-problem1-concept-b
```

**Pinecone after Step 1**:
- `target_profiles` namespace: 2 vectors
- `resources` namespace: 0 vectors

### Step 2: Resource Search (First Time)
```
User clicks "Search Resources" for Concept A

1. Query target_profiles: Find similar target profiles (none yet)
2. Query resources: Find cached resources (none yet)
3. Cache MISS → Perform web search
4. Find 3 YouTube videos about F=ma
5. Store each video in Pinecone (namespace: resources)
```

**Pinecone after Step 2**:
- `target_profiles` namespace: 2 vectors
- `resources` namespace: 3 vectors

### Step 3: Resource Search (Second Time - Different Student)
```
Another student uploads similar physics homework

1. Query target_profiles: Find similar target profiles
   → Match found! Similar to target-bp123-problem1-concept-a
2. Query resources: Find cached resources
   → Match found! 3 videos about F=ma
3. Cache HIT → Return cached resources (no web search needed)
```

## Future Namespaces

### `blueprints` Namespace (Not Yet Implemented)
**Purpose**: Store entire blueprint sections for cross-document search
**Use case**: "Find all blueprints that cover Newton's Laws"

### `equations` Namespace (Not Yet Implemented)
**Purpose**: Store mathematical equations separately
**Use case**: "Find resources that explain this specific equation"

### `figures` Namespace (Not Yet Implemented)
**Purpose**: Store diagrams and visual aids
**Use case**: "Find similar diagrams to this free body diagram"

## Monitoring Your Namespaces

### Via Pinecone Dashboard:
1. Go to https://app.pinecone.io
2. Click on `catalyst-resources` index
3. View "Namespaces" tab
4. See vector counts per namespace:
   - `target_profiles`: Should grow with each blueprint
   - `resources`: Should grow with each resource search
   - `test`: Only test vectors

### Via Test Function:
```javascript
// In test-pinecone.html, click "Get Stats"
// You'll see:
{
  "namespaces": {
    "target_profiles": { "vectorCount": 15 },
    "resources": { "vectorCount": 8 },
    "test": { "vectorCount": 1 }
  }
}
```

## Key Takeaways

✅ **Namespaces = Folders**: Organize different types of vectors

✅ **target_profiles**: What you're looking for (from blueprints)

✅ **resources**: What you've found (from web searches)

✅ **Separate but connected**: Target profiles help find better resources

✅ **Automatic**: Everything happens during normal blueprint/search flow

## Testing

To verify it's working:

1. **Upload a document** and generate a blueprint
2. **Check Pinecone dashboard**:
   - `target_profiles` namespace should have new vectors
   - Count should match number of learning units in blueprint
3. **Search for resources** for a concept
4. **Check Pinecone dashboard again**:
   - `resources` namespace should have new vectors
   - Count should increase by 3 (one per resource found)

---

**Your Pinecone is now fully integrated!** Every blueprint and resource search automatically populates the appropriate namespace. 🚀

