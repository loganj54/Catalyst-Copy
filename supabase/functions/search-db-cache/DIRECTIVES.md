# Function: search-db-cache

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Search for semantically similar educational resources in the curated_resources table using vector similarity.

## Responsibility
This function performs vector similarity search against cached educational resources. It ONLY searches the database - it does NOT generate embeddings, fetch new resources, or store anything. It returns matching resources above a similarity threshold.

## Input Contract

### TypeScript Interface
```typescript
interface SearchDbCacheInput {
  embedding: number[];     // 1536-dimensional query embedding
  threshold: number;       // Similarity threshold (0.0-1.0), typically 0.95
  max_results: number;     // Maximum number of results to return
}
```

### Example Input
```json
{
  "embedding": [0.0023, -0.0154, ...],
  "threshold": 0.95,
  "max_results": 3
}
```

### Input Validation Rules
- `embedding`: Must be array of exactly 1536 numbers
- `threshold`: Must be between 0.0 and 1.0
- `max_results`: Must be positive integer between 1 and 20

## Output Contract

### TypeScript Interface
```typescript
interface SearchDbCacheOutput {
  resources: Resource[];      // Matching resources
  cache_hit: boolean;        // True if any results found
  similarity_scores: number[]; // Similarity score for each resource
  metadata?: {
    search_time_ms: number;
    total_matches: number;
  };
}
```

### Example Output (Cache Hit)
```json
{
  "resources": [
    {
      "id": "uuid",
      "url": "https://youtube.com/watch?v=abc",
      "title": "Thermodynamics Tutorial",
      "description": "...",
      "platform": "YouTube",
      "similarity": 0.97,
      "from_cache": true
    }
  ],
  "cache_hit": true,
  "similarity_scores": [0.97, 0.96],
  "metadata": {
    "search_time_ms": 45,
    "total_matches": 2
  }
}
```

### Example Output (Cache Miss)
```json
{
  "resources": [],
  "cache_hit": false,
  "similarity_scores": [],
  "metadata": {
    "search_time_ms": 38,
    "total_matches": 0
  }
}
```

### Example Output (Error)
```json
{
  "error": "Invalid embedding dimension: expected 1536, got 512",
  "code": "INVALID_INPUT",
  "details": {
    "field": "embedding",
    "expected": 1536,
    "received": 512
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate input parameters (embedding dimension, threshold range, max_results)
2. Format embedding vector for PostgreSQL
3. Call `search_similar_resources` RPC function
4. Map database results to Resource objects
5. Return results with cache_hit flag and metadata

### Edge Cases
- **No Matches**: Returns empty array with `cache_hit: false`
- **Threshold Too High**: May return no results (e.g., 0.99 threshold)
- **Database Error**: Returns DATABASE_ERROR with details
- **Invalid Embedding**: Returns INVALID_INPUT error

### Performance Requirements
- **Timeout**: Must complete within 5 seconds
- **Max Retries**: 1 retry for transient database errors
- **Idempotency**: Safe to retry (read-only operation)
- **Memory**: Max 100MB usage

## Dependencies

### External APIs
- None (database-only function)

### Database Tables
- `curated_resources` (read-only)
- Uses RPC function: `search_similar_resources(query_embedding, similarity_threshold, max_results)`

### Internal Functions
- None (atomic function)

### Environment Variables
- `SUPABASE_URL`: Required - Database URL
- `SUPABASE_SERVICE_ROLE_KEY`: Required - Service key

## Error Handling

### Error Codes
- `INVALID_INPUT`: Input validation failed
- `DATABASE_ERROR`: Database query failed
- `TIMEOUT`: Query exceeded 5 second limit

### Error Recovery Strategies
- **DATABASE_ERROR**: Retry once after 1 second delay
- **TIMEOUT**: Return error immediately (no retry)
- **INVALID_INPUT**: Return error immediately (client issue)

### Fallback Behavior
- No fallback - if database unavailable, return error
- Caller should handle cache miss and fall back to web search

## Testing Examples

### Test Case 1: Cache Hit - Multiple Results
**Input:**
```json
{
  "embedding": [0.0023, ...],
  "threshold": 0.95,
  "max_results": 3
}
```
**Expected Output:**
```json
{
  "resources": [{...}, {...}],
  "cache_hit": true,
  "similarity_scores": [0.97, 0.96],
  "metadata": { "total_matches": 2 }
}
```

### Test Case 2: Cache Miss - No Results
**Input:**
```json
{
  "embedding": [0.0023, ...],
  "threshold": 0.99,
  "max_results": 3
}
```
**Expected Output:**
```json
{
  "resources": [],
  "cache_hit": false,
  "similarity_scores": [],
  "metadata": { "total_matches": 0 }
}
```

### Test Case 3: Invalid Embedding Dimension
**Input:**
```json
{
  "embedding": [0.1, 0.2, 0.3],
  "threshold": 0.95,
  "max_results": 3
}
```
**Expected Output:**
```json
{
  "error": "Invalid embedding dimension",
  "code": "INVALID_INPUT",
  "details": { "expected": 1536, "received": 3 }
}
```

## Known Issues & Fixes

(This section will be populated by the self-healing agent as errors are encountered and fixed)

## Change History
- **2026-01-05**: Initial implementation - manual

