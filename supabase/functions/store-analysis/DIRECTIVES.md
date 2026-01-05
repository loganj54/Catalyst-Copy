# Function: store-analysis

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Store document analysis in document_analyses table with derived metadata fields.

## Responsibility
This function stores analysis results in the database. It ONLY stores - it does NOT analyze documents, generate names, or fetch content. Calculates derived fields from analysis.

## Input Contract

### TypeScript Interface
```typescript
interface StoreAnalysisInput {
  analysis: AnalysisResult;
  document_id: string;
  user_id: string;
  blueprint_id?: string;
  class_id?: string;
  source_filename?: string;
  source_type?: 'pdf' | 'text' | 'both';
}
```

### Example Input
```json
{
  "analysis": {
    "document_type": "problem_set",
    "subject_area": "thermodynamics",
    "specific_topic": "heat transfer",
    "course_level": "intermediate",
    "sections": [...],
    "prerequisites": [...],
    "key_equations": [...]
  },
  "document_id": "doc-uuid",
  "user_id": "user-uuid",
  "blueprint_id": "bp-uuid",
  "source_filename": "homework.pdf",
  "source_type": "pdf"
}
```

### Input Validation Rules
- `analysis`: Must be object with required fields
- `document_id`: Must be non-empty string
- `user_id`: Must be non-empty string
- Optional fields can be null/undefined

## Output Contract

### TypeScript Interface
```typescript
interface StoreAnalysisOutput {
  analysis_id: string;
  metadata?: {
    stored_at: string;
  };
}
```

### Example Output (Success)
```json
{
  "analysis_id": "analysis-uuid-123",
  "metadata": {
    "stored_at": "2026-01-05T12:00:00Z"
  }
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
1. Validate required input fields
2. Extract derived fields from analysis
3. Insert into document_analyses table
4. Return analysis_id

### Edge Cases
- **Duplicate document_id**: Database constraint may fail
- **Missing Analysis Fields**: Uses safe defaults
- **Large Analysis**: Stores as JSONB (compressed)

### Performance Requirements
- **Timeout**: Must complete within 3 seconds
- **Memory**: Max 50MB for large analyses
- **Idempotency**: Not idempotent (creates new row each time)

## Dependencies

### External APIs
- None

### Database Tables
- `document_analyses`: Stores analysis records

### Internal Functions
- None (atomic function)

### Environment Variables
- `SUPABASE_URL`: Required
- `SUPABASE_SERVICE_ROLE_KEY`: Required

## Error Handling

### Error Codes
- `INVALID_INPUT`: Missing required fields
- `DATABASE_ERROR`: Insert failed
- `DUPLICATE_ENTRY`: document_id already has analysis

### Error Recovery Strategies
- **DATABASE_ERROR**: No retry (likely constraint violation)
- **INVALID_INPUT**: Return error immediately

### Fallback Behavior
- No fallback - storage must succeed or fail explicitly

## Testing Examples

### Test Case 1: Store New Analysis
**Input:** Complete analysis with all fields
**Expected Output:** analysis_id returned

### Test Case 2: Missing document_id
**Input:** Analysis without document_id
**Expected Output:** INVALID_INPUT error

### Test Case 3: Minimal Analysis
**Input:** Analysis with only required fields
**Expected Output:** Stores successfully with defaults

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

