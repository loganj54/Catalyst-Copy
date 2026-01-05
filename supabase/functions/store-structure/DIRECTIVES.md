# Function: store-structure

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Store learning structure in blueprint_structures table.

## Responsibility
This function stores structures in database. It ONLY stores - it does NOT generate, cache, or fetch. Calculates metrics from structure.

## Input Contract

### TypeScript Interface
```typescript
interface StoreStructureInput {
  structure: LearningStructure;
  blueprint_id: string;
  analysis_id: string;
  document_id?: string;
  user_id: string;
  from_cache?: boolean;
  cache_source_id?: string;
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
  "blueprint_id": "bp-uuid",
  "analysis_id": "analysis-uuid",
  "user_id": "user-uuid",
  "from_cache": false
}
```

### Input Validation Rules
- `structure`: Must be valid LearningStructure
- `blueprint_id`: Must be non-empty string
- `analysis_id`: Must be non-empty string
- `user_id`: Must be non-empty string

## Output Contract

### TypeScript Interface
```typescript
interface StoreStructureOutput {
  structure_id: string;
  metadata?: {
    stored_at: string;
  };
}
```

### Example Output (Success)
```json
{
  "structure_id": "structure-uuid-123",
  "metadata": {
    "stored_at": "2026-01-05T12:00:00Z"
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate inputs
2. Calculate metrics (unit counts, time estimates)
3. Insert into blueprint_structures table
4. Return structure_id

### Edge Cases
- **Duplicate blueprint_id**: Updates existing structure
- **Large Structure**: Stores as JSONB (compressed)

### Performance Requirements
- **Timeout**: 3 seconds
- **Memory**: Max 50MB

## Dependencies

### External APIs
- None

### Database Tables
- `blueprint_structures`: Stores learning structures

### Internal Functions
- None (atomic function)

### Environment Variables
- `SUPABASE_URL`: Required
- `SUPABASE_SERVICE_ROLE_KEY`: Required

## Error Handling

### Error Codes
- `INVALID_INPUT`: Missing required fields
- `DATABASE_ERROR`: Insert failed

### Error Recovery Strategies
- **DATABASE_ERROR**: Retry once

### Fallback Behavior
- No fallback - storage must succeed

## Testing Examples

### Test Case 1: Store New Structure
**Input:** Complete structure with all fields
**Expected Output:** structure_id returned

### Test Case 2: Missing blueprint_id
**Input:** Structure without blueprint_id
**Expected Output:** INVALID_INPUT error

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

