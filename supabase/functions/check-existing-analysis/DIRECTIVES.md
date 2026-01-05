# Function: check-existing-analysis

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Check if a document already has an analysis in the document_analyses table.

## Responsibility
This function queries for existing analysis by document_id. It ONLY checks existence - it does NOT create, update, or analyze documents. Returns analysis if found.

## Input Contract

### TypeScript Interface
```typescript
interface CheckExistingAnalysisInput {
  document_id: string;
}
```

### Example Input
```json
{
  "document_id": "doc-uuid-123"
}
```

### Input Validation Rules
- `document_id`: Must be non-empty string (UUID)

## Output Contract

### TypeScript Interface
```typescript
interface CheckExistingAnalysisOutput {
  exists: boolean;
  analysis_id?: string;
  analysis?: AnalysisResult;
  metadata?: {
    created_at?: string;
  };
}
```

### Example Output (Found)
```json
{
  "exists": true,
  "analysis_id": "analysis-uuid",
  "analysis": {
    "document_type": "problem_set",
    "subject_area": "thermodynamics",
    "sections": [...]
  },
  "metadata": {
    "created_at": "2026-01-05T10:00:00Z"
  }
}
```

### Example Output (Not Found)
```json
{
  "exists": false
}
```

### Example Output (Error)
```json
{
  "error": "document_id is required",
  "code": "INVALID_INPUT"
}
```

## Behavior Specification

### Normal Flow
1. Validate document_id is provided
2. Query document_analyses table by document_id
3. Return exists flag and analysis if found

### Edge Cases
- **No Analysis**: Returns exists: false
- **Multiple Analyses**: Returns most recent one
- **Invalid UUID**: Database query returns empty

### Performance Requirements
- **Timeout**: Must complete within 2 seconds
- **Idempotency**: Safe to retry (read-only)
- **Memory**: Max 10MB usage

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
- `INVALID_INPUT`: document_id missing or invalid
- `DATABASE_ERROR`: Database query failed

### Error Recovery Strategies
- **DATABASE_ERROR**: Retry once after 500ms
- **INVALID_INPUT**: Return error immediately

### Fallback Behavior
- On error, assume no analysis exists and return exists: false

## Testing Examples

### Test Case 1: Analysis Exists
**Input:**
```json
{
  "document_id": "existing-doc-id"
}
```
**Expected Output:** exists: true with full analysis

### Test Case 2: No Analysis
**Input:**
```json
{
  "document_id": "new-doc-id"
}
```
**Expected Output:** exists: false

### Test Case 3: Missing document_id
**Input:**
```json
{}
```
**Expected Output:** INVALID_INPUT error

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

