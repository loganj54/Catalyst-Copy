# Embedding Format Fix Explained

## The Problem in Simple Terms

The database expected an **array of numbers** for the vector embedding:
```json
[0.123, 0.456, 0.789, ...]
```

But we were giving it an **object containing an array**:
```json
{
  "embedding": [0.123, 0.456, 0.789, ...],
  "tokens_used": 123
}
```

PostgreSQL's `VECTOR` type can only accept raw arrays, not JSON objects.

## Where It Came From

The `generateEmbedding()` function in `embeddings.ts` returns a response object:

```typescript
export interface EmbeddingResponse {
  embedding: number[];  // ← The actual vector
  tokens_used: number;  // ← Metadata
}
```

This is useful because it gives us both the embedding AND token usage info.

## The Bug

In `section-embeddings.ts`, we were storing the entire response:

```typescript
// ❌ WRONG - stores the whole object
const embedding = await generateEmbedding(text);

return {
  section_id: section.section_id,
  embedding,  // ← This is {embedding: [...], tokens_used: 123}
  // ...
};
```

Then when we tried to insert into the database:

```typescript
const cacheEntry = {
  primary_embedding: sectionToCache.section_embedding,
  // ↑ This was {embedding: [...], tokens_used: 123}
  // But PostgreSQL expected just [...]
};

await supabase.from('cached_blueprint_structures').insert([cacheEntry]);
// ❌ ERROR: invalid input syntax for type vector
```

## The Fix

Extract just the embedding array:

```typescript
// ✅ CORRECT - extract just the array
const embeddingResponse = await generateEmbedding(text);
const embedding = embeddingResponse.embedding;  // ← Just the array

return {
  section_id: section.section_id,
  embedding,  // ← This is [0.123, 0.456, ...]
  // ...
};
```

Now when we insert:

```typescript
const cacheEntry = {
  primary_embedding: sectionToCache.section_embedding,
  // ↑ This is [0.123, 0.456, ...]
};

await supabase.from('cached_blueprint_structures').insert([cacheEntry]);
// ✅ SUCCESS!
```

## Why This Happened

The `generateEmbedding()` function was designed to return metadata (token usage) along with the embedding. This is great for logging and monitoring, but we forgot to extract just the array part when storing in the database.

## The One-Line Fix

**Before:**
```typescript
const embedding = await generateEmbedding(text);
```

**After:**
```typescript
const embeddingResponse = await generateEmbedding(text);
const embedding = embeddingResponse.embedding;
```

That's it! Just one extra line to extract the array from the response object.

---

**Lesson Learned:** Always check the data type when working with PostgreSQL vectors. They're strict about format! 🎯

