# Function: check-structure-cache

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Check for similar cached learning structure using vector similarity on analysis embeddings.

## Responsibility
This function searches for reusable structures. It ONLY checks cache - it does NOT generate, adapt, or store structures. Delegates to shared helper.

## Input Contract

### TypeScript Interface
```typescript
interface CheckStructureCacheInput {
  analysis: AnalysisResult;
  threshold: number;
}
```

### Example Input
```json
{
  "analysis": {
    "document_type": "problem_set",
    "subject_area": "thermodynamics",
    "specific_topic": "heat transfer"
  },
  "threshold": 0.92
}
```

### Input Validation Rules
- `analysis`: Must be AnalysisResult object
- `threshold`: Must be between 0 and 1 (typically 0.90-0.95)

## Output Contract

### TypeScript Interface
```typescript
interface CheckStructureCacheOutput {
  cache_hit: boolean;
  cached_structure?: LearningStructure;
  similarity?: number;
  cache_id?: string;
  times_used?: number;
  quality_score?: number;
}
```

### Example Output (Cache Hit)
```json
{
  "cache_hit": true,
  "cached_structure": {
    "summary": {...},
    "prerequisites_section": {...},
    "content_sections": [...]
  },
  "similarity": 0.94,
  "cache_id": "cache-uuid",
  "times_used": 5,
  "quality_score": 0.88
}
```

### Example Output (Cache Miss)
```json
{
  "cache_hit": false
}
```

## Behavior Specification

### Normal Flow
1. Validate input
2. Call `checkStructureCache()` from _shared/structure-cache.ts
3. Return cache hit status and structure if found

### Edge Cases
- **No Cache**: Returns cache_hit: false
- **Low Similarity**: Returns cache_hit: false if below threshold
- **Multiple Matches**: Returns highest similarity

### Performance Requirements
- **Timeout**: 5 seconds
- **Idempotency**: Safe to retry (read-only)

## Dependencies

### External APIs
- None

### Database Tables
- `cached_structures`: Read cached structures
- Uses RPC function for vector similarity

### Internal Functions
- `checkStructureCache()` from `_shared/structure-cache.ts`

### Environment Variables
- `SUPABASE_URL`: Required
- `SUPABASE_SERVICE_ROLE_KEY`: Required

## Error Handling

### Error Codes
- `INVALID_INPUT`: Invalid analysis or threshold
- `DATABASE_ERROR`: Cache query failed

### Error Recovery Strategies
- **DATABASE_ERROR**: Return cache_hit: false as fallback

### Fallback Behavior
- On error, assume cache miss

## Testing Examples

### Test Case 1: Cache Hit
**Input:** Analysis similar to existing cached structure
**Expected Output:** cache_hit: true with structure

### Test Case 2: Cache Miss
**Input:** Novel analysis
**Expected Output:** cache_hit: false

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

