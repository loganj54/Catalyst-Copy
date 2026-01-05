# Function: fetch-analysis

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Retrieve document analysis from database by blueprint_id or document_id with fallback strategies.

## Responsibility
This function fetches existing analysis using multiple search strategies. It ONLY retrieves - it does NOT create, analyze, or modify data. Tries multiple lookup methods.

## Input Contract

### TypeScript Interface
```typescript
interface FetchAnalysisInput {
  blueprint_id?: string;
  document_id?: string;
}
```

### Example Input
```json
{
  "blueprint_id": "bp-uuid-123"
}
```

### Input Validation Rules
- At least one of `blueprint_id` or `document_id` must be provided
- Tries blueprint_id first, then document_id

## Output Contract

### TypeScript Interface
```typescript
interface FetchAnalysisOutput {
  analysis: AnalysisResult;
  analysis_id: string;
  metadata?: {
    fetch_time_ms: number;
  };
}
```

### Example Output (Success)
```json
{
  "analysis": {
    "document_type": "problem_set",
    "subject_area": "thermodynamics",
    "sections": [...]
  },
  "analysis_id": "analysis-uuid",
  "metadata": {
    "fetch_time_ms": 45
  }
}
```

### Example Output (Error)
```json
{
  "error": "No analysis found for this blueprint/document",
  "code": "NOT_FOUND"
}
```

## Behavior Specification

### Normal Flow
1. Validate at least one ID is provided
2. Try fetching by blueprint_id if provided
3. If not found, try document_id if provided
4. If not found, try by filename match (fallback)
5. Return analysis or NOT_FOUND error

### Edge Cases
- **Multiple Analyses**: Returns most recent
- **No IDs**: Returns INVALID_INPUT error
- **Not Found**: Returns NOT_FOUND error

### Performance Requirements
- **Timeout**: 3 seconds
- **Retries**: 1 retry for transient failures
- **Idempotency**: Safe to retry (read-only)

## Dependencies

### External APIs
- None

### Database Tables
- `document_analyses`: Read analysis records

### Internal Functions
- None (atomic function)

### Environment Variables
- `SUPABASE_URL`: Required
- `SUPABASE_SERVICE_ROLE_KEY`: Required

## Error Handling

### Error Codes
- `INVALID_INPUT`: No IDs provided
- `NOT_FOUND`: No analysis exists
- `DATABASE_ERROR`: Query failed

### Error Recovery Strategies
- **DATABASE_ERROR**: Retry once
- **NOT_FOUND**: Return error (expected case)

### Fallback Behavior
- Try multiple search strategies before giving up

## Testing Examples

### Test Case 1: Found by blueprint_id
**Input:** Valid blueprint_id
**Expected Output:** Complete analysis

### Test Case 2: Found by document_id
**Input:** Valid document_id
**Expected Output:** Complete analysis

### Test Case 3: Not Found
**Input:** Non-existent IDs
**Expected Output:** NOT_FOUND error

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

