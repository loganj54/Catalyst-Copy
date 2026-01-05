# Function: cache-structure

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Store learning structure in cache for future reuse.

## Responsibility
This function caches structures. It ONLY stores in cache - it does NOT generate, adapt, or fetch. Delegates to shared helper.

## Input Contract

### TypeScript Interface
```typescript
interface CacheStructureInput {
  structure: LearningStructure;
  analysis: AnalysisResult;
  analysis_id: string;
}
```

### Example Input
```json
{
  "structure": {
    "summary": {...},
    "prerequisites_section": {...},
    "content_sections": [...]
  },
  "analysis": {
    "document_type": "problem_set",
    "subject_area": "thermodynamics"
  },
  "analysis_id": "analysis-uuid"
}
```

### Input Validation Rules
- `structure`: Must be valid LearningStructure
- `analysis`: Must be valid AnalysisResult
- `analysis_id`: Must be non-empty string

## Output Contract

### TypeScript Interface
```typescript
interface CacheStructureOutput {
  cache_id: string;
  metadata?: {
    cached_at: string;
  };
}
```

### Example Output (Success)
```json
{
  "cache_id": "cache-uuid-123",
  "metadata": {
    "cached_at": "2026-01-05T12:00:00Z"
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate inputs
2. Call `cacheNewStructure()` from _shared/structure-cache.ts
3. Return cache_id

### Edge Cases
- **Duplicate Structure**: Updates existing cache entry
- **Large Structure**: Compresses for storage

### Performance Requirements
- **Timeout**: 3 seconds
- **Memory**: Max 50MB

## Dependencies

### External APIs
- OpenAI API (for embedding generation)

### Database Tables
- `cached_structures`: Stores cached structures

### Internal Functions
- `cacheNewStructure()` from `_shared/structure-cache.ts`

### Environment Variables
- `OPENAI_API_KEY`: Required for embeddings

## Error Handling

### Error Codes
- `INVALID_INPUT`: Missing required fields
- `DATABASE_ERROR`: Cache storage failed

### Error Recovery Strategies
- **DATABASE_ERROR**: Retry once

### Fallback Behavior
- If caching fails, log error but don't block workflow

## Testing Examples

### Test Case 1: Cache New Structure
**Input:** Complete structure with analysis
**Expected Output:** cache_id returned

### Test Case 2: Missing analysis_id
**Input:** Structure without analysis_id
**Expected Output:** INVALID_INPUT error

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

