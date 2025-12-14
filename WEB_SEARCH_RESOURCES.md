# Web Search Resources - Vector Caching System

This document describes the educational resource caching system that uses vector embeddings for semantic similarity matching to reduce redundant web searches and improve response times.

## Overview

When users request educational resources for a learning topic, the system:

1. **Generates an embedding** for the topic using OpenAI's `text-embedding-3-small`
2. **Searches the cache** using pgvector similarity search (>95% threshold)
3. **On cache hit**: Returns cached resources instantly
4. **On cache miss**: Uses Claude's web search to find new videos, stores them with embeddings

This approach significantly reduces API costs and latency over time as the resource database grows.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Request                                 │
│              Topic: "Stefan-Boltzmann Law calculations"             │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Generate Query Embedding                          │
│            OpenAI text-embedding-3-small (1536 dims)                │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 pgvector Similarity Search                           │
│     SELECT * FROM curated_resources                                  │
│     WHERE 1 - (topic_embedding <=> query) > 0.95                    │
└────────────────────┬────────────────────────────┬───────────────────┘
                     │                            │
            similarity > 0.95            similarity < 0.95
                     │                            │
                     ▼                            ▼
         ┌──────────────────┐        ┌─────────────────────────┐
         │   CACHE HIT      │        │     CACHE MISS          │
         │ Return cached    │        │ Claude Web Search       │
         │ Increment served │        │ Store with embedding    │
         └──────────────────┘        └─────────────────────────┘
```

## Database Schema

### curated_resources (Global Cache)

The master table storing all discovered educational resources:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `url` | TEXT UNIQUE | Resource URL (dedupe key) |
| `title` | TEXT | Resource title |
| `description` | TEXT | Full description |
| `platform` | TEXT | YouTube, Khan Academy, etc. |
| `channel_name` | TEXT | Creator name |
| `thumbnail_url` | TEXT | Video thumbnail |
| `duration_seconds` | INTEGER | Video length |
| `original_search_query` | TEXT | Query that found this |
| `topic_signature` | TEXT | **Detailed AI-generated topic descriptor** |
| `topic_embedding` | vector(1536) | **Semantic similarity vector** |
| `concepts_covered` | TEXT[] | List of concepts taught |
| `difficulty_level` | TEXT | beginner/intermediate/advanced |
| `quality_score` | FLOAT | AI assessment (0-1) |
| `times_served` | INTEGER | Usage counter |

### topic_responses

Tracks user comfort level with each topic:

| Column | Type | Description |
|--------|------|-------------|
| `blueprint_id` | UUID | Parent blueprint |
| `unit_id` | TEXT | Learning unit ID |
| `user_id` | UUID | User |
| `response` | TEXT | 'comfortable' or 'needs_help' |
| `searched_at` | TIMESTAMPTZ | When resources were fetched |

### blueprint_topic_resources

Junction table linking blueprints to resources:

| Column | Type | Description |
|--------|------|-------------|
| `blueprint_id` | UUID | Blueprint reference |
| `unit_id` | TEXT | Learning unit ID |
| `resource_id` | UUID | Resource reference |
| `relevance_score` | FLOAT | Match quality (0-1) |
| `from_cache` | BOOLEAN | Was this a cache hit? |

## The Topic Signature

The `topic_signature` is a key innovation. Instead of matching on short search queries, Claude generates a detailed 2-3 sentence description of exactly what each resource teaches:

**Example topic_signature:**
> "This video teaches the Stefan-Boltzmann Law for calculating blackbody radiation emission power, including derivation from Planck's law, the σT^4 relationship, and worked examples for engineering heat transfer problems involving surface emissivity and view factors."

This detailed signature enables high-precision semantic matching because:
- It captures specific concepts, not just keywords
- It includes context about difficulty and prerequisites
- It describes problem types the resource helps solve
- Future queries with similar intent will match accurately

## Similarity Threshold

We use **0.95 (95%)** cosine similarity as the cache hit threshold:

- **High precision**: Only very similar topics return cached results
- **Reduces false positives**: Students get relevant content
- **Can be tuned**: Lower to 0.90-0.93 if cache hit rate is too low

The similarity is calculated as:
```sql
1 - (topic_embedding <=> query_embedding)
```

Where `<=>` is pgvector's cosine distance operator.

## Edge Function Flow

### search-resources/index.ts

1. **Receive request**
   ```json
   {
     "blueprint_id": "uuid",
     "unit_id": "prereq_1",
     "topic": "Stefan-Boltzmann Law",
     "description": "Understanding thermal radiation emission",
     "search_queries": [
       { "query": "Stefan-Boltzmann law tutorial", "query_type": "introduction" }
     ]
   }
   ```

2. **Generate embedding** for topic + description + queries

3. **Vector search** using `search_similar_resources()` SQL function

4. **Cache hit path**:
   - Return cached resources
   - Increment `times_served` counter
   - Link to blueprint via junction table

5. **Cache miss path**:
   - Call Claude with `web_search` tool enabled
   - Claude searches and returns video metadata
   - Generate `topic_signature` for each video
   - Generate embedding for each signature
   - Store in `curated_resources`
   - Link to blueprint

## Cost Analysis

### Per-request costs

| Operation | Cost |
|-----------|------|
| OpenAI embedding (query) | ~$0.00002 |
| OpenAI embedding (per resource) | ~$0.00002 |
| Claude web search (cache miss) | ~$0.01-0.05 |

### Savings over time

As the database grows:
- Common topics (algebra, calculus basics) hit cache instantly
- Only novel/specialized topics require web search
- Expected 70-80% cache hit rate for mature system

## Environment Variables

Required in Supabase Edge Functions:

```bash
# OpenAI for embeddings
supabase secrets set OPENAI_API_KEY=sk-...

# Anthropic for Claude (already set)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## SQL Helper Function

The migration includes a helper function for vector search:

```sql
CREATE FUNCTION search_similar_resources(
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.95,
    max_results INTEGER DEFAULT 3
) RETURNS TABLE (...)
```

This abstracts the similarity calculation and filtering.

## Future Improvements

1. **User feedback loop**: Let users rate resources to improve `quality_score`
2. **Embedding model upgrade**: Switch to specialized educational embedding model
3. **Concept clustering**: Group similar resources for broader recommendations
4. **URL verification**: Periodic checks that resources still exist
5. **A/B testing thresholds**: Experiment with 0.90-0.98 thresholds

## Debugging

Check the DEBUG panel in Blueprint.jsx to see:
- Current topic responses (comfortable/needs_help)
- Cached resources per topic
- Raw learning structure

The edge function logs cache hits/misses:
```
[search-resources] Cache HIT! Found 3 resources
[search-resources] Cache MISS - performing web search...
```

## Testing Locally

1. Apply the migration:
   ```bash
   supabase db push
   ```

2. Set secrets:
   ```bash
   supabase secrets set OPENAI_API_KEY=your-key
   ```

3. Deploy edge function:
   ```bash
   supabase functions deploy search-resources
   ```

4. Test via Blueprint page UI or curl:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/search-resources \
     -H "Authorization: Bearer YOUR_JWT" \
     -H "Content-Type: application/json" \
     -d '{"blueprint_id":"...","unit_id":"prereq_1","topic":"Heat Transfer",...}'
   ```

