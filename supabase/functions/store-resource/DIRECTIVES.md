# Function: store-resource

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Store educational resource with embedding in curated_resources table, handling duplicates by URL.

## Responsibility
This function takes a resource object and its embedding vector and stores it in the database. It ONLY stores resources - it does NOT search, analyze, or link to blueprints. Handles URL-based deduplication automatically via upsert.

## Input Contract

### TypeScript Interface
```typescript
interface StoreResourceInput {
  resource: Resource;
  embedding: number[];
  user_id?: string;
}
```

### Example Input
```json
{
  "resource": {
    "url": "https://www.youtube.com/watch?v=abc123",
    "title": "Introduction to Thermodynamics",
    "description": "Learn the basics of heat transfer",
    "platform": "YouTube",
    "channel_name": "Physics Academy",
    "thumbnail_url": "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    "duration_seconds": 900,
    "topic_signature": "This video teaches fundamental thermodynamics concepts...",
    "concepts_covered": ["heat transfer", "first law"],
    "difficulty_level": "intermediate",
    "quality_score": 0.85,
    "from_cache": false
  },
  "embedding": [0.0023, -0.0154, ...],
  "user_id": "user-uuid"
}
```

### Input Validation Rules
- `resource.url`: Must be non-empty string (unique identifier)
- `resource.title`: Must be non-empty string
- `embedding`: Must be array of exactly 1536 numbers
- `user_id`: Optional string for attribution

## Output Contract

### TypeScript Interface
```typescript
interface StoreResourceOutput {
  resource_id: string;
  created: boolean;
  metadata?: {
    stored_at: string;
  };
}
```

### Example Output (Success - New Resource)
```json
{
  "resource_id": "uuid-123",
  "created": true,
  "metadata": {
    "stored_at": "2026-01-05T12:00:00Z"
  }
}
```

### Example Output (Success - Updated Existing)
```json
{
  "resource_id": "uuid-456",
  "created": false,
  "metadata": {
    "stored_at": "2026-01-05T12:00:00Z"
  }
}
```

### Example Output (Error)
```json
{
  "error": "Resource URL is required",
  "code": "INVALID_INPUT",
  "details": {
    "field": "resource.url",
    "received": ""
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate input resource has required fields
2. Validate embedding is 1536-dimensional vector
3. Format embedding for PostgreSQL vector type
4. Upsert to curated_resources table (on conflict: url)
5. Return resource_id and whether it was newly created or updated

### Edge Cases
- **Duplicate URL**: Updates existing resource, returns created: false
- **Missing Optional Fields**: Stores with null values for optional fields
- **Invalid Embedding**: Returns error with code `INVALID_INPUT`
- **Database Error**: Returns error with code `DATABASE_ERROR`

### Performance Requirements
- **Timeout**: Must complete within 5 seconds
- **Idempotency**: Same URL always results in same resource_id
- **Memory**: Max 10MB usage

## Dependencies

### External APIs
- None

### Database Tables
- `curated_resources`: Stores resources with embeddings

### Internal Functions
- `formatVectorForPostgres` from `_shared/embeddings.ts`

### Environment Variables
- `SUPABASE_URL`: Required for database access
- `SUPABASE_SERVICE_ROLE_KEY`: Required for database access

## Error Handling

### Error Codes
- `INVALID_INPUT`: Input validation failed (missing required fields)
- `DATABASE_ERROR`: Database operation failed
- `INTERNAL_ERROR`: Unexpected error occurred

### Error Recovery Strategies
- **DATABASE_ERROR**: Retry once after 1 second delay
- **INVALID_INPUT**: Return error immediately (no retry)

### Fallback Behavior
- No fallback - storage must succeed or fail explicitly

## Testing Examples

### Test Case 1: Store New Resource - Success
**Input:**
```json
{
  "resource": {
    "url": "https://youtube.com/watch?v=test1",
    "title": "Test Video",
    "description": "Test description",
    "platform": "YouTube",
    "topic_signature": "Test topic",
    "concepts_covered": ["concept1"],
    "difficulty_level": "beginner",
    "quality_score": 0.8,
    "from_cache": false
  },
  "embedding": [0.1, 0.2, ...1536 numbers total]
}
```
**Expected Output:**
```json
{
  "resource_id": "uuid-xxx",
  "created": true,
  "metadata": {
    "stored_at": "2026-01-05T12:00:00Z"
  }
}
```

### Test Case 2: Update Existing Resource (Duplicate URL)
**Input:** Same URL as Test Case 1 but different title
**Expected Output:**
```json
{
  "resource_id": "uuid-xxx",
  "created": false,
  "metadata": {
    "stored_at": "2026-01-05T12:01:00Z"
  }
}
```

### Test Case 3: Missing Required Field - Error
**Input:**
```json
{
  "resource": {
    "url": "",
    "title": "Test"
  },
  "embedding": [...]
}
```
**Expected Output:**
```json
{
  "error": "Resource URL is required",
  "code": "INVALID_INPUT",
  "details": { "field": "resource.url" }
}
```

### Test Case 4: Invalid Embedding Dimension
**Input:** Embedding with only 512 dimensions
**Expected Output:**
```json
{
  "error": "Embedding must be a 1536-dimensional vector",
  "code": "INVALID_INPUT",
  "details": { "length": 512, "expected": 1536 }
}
```

## Known Issues & Fixes

(This section will be populated by the self-healing agent as errors are encountered and fixed)

## Change History
- **2026-01-05**: Initial implementation - manual

