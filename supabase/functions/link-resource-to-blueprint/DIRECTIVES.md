# Function: link-resource-to-blueprint

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Create junction table entry linking educational resource to a blueprint unit.

## Responsibility
This function creates the many-to-many relationship between resources and blueprint units. It ONLY creates the link - it does NOT fetch resources, analyze content, or search. Handles duplicate links via upsert.

## Input Contract

### TypeScript Interface
```typescript
interface LinkResourceToBlueprintInput {
  blueprint_id: string;
  unit_id: string;
  resource_id: string;
  relevance: number;
  query_type?: string;
  resource_explanation?: string;
}
```

### Example Input
```json
{
  "blueprint_id": "blueprint-uuid",
  "unit_id": "unit-001",
  "resource_id": "resource-uuid",
  "relevance": 0.95,
  "query_type": "tutorial",
  "resource_explanation": "This video explains heat transfer concepts..."
}
```

### Input Validation Rules
- `blueprint_id`: Must be non-empty string (UUID)
- `unit_id`: Must be non-empty string
- `resource_id`: Must be non-empty string (UUID)
- `relevance`: Must be number between 0 and 1
- `query_type`: Optional string
- `resource_explanation`: Optional string

## Output Contract

### TypeScript Interface
```typescript
interface LinkResourceToBlueprintOutput {
  success: boolean;
  link_id: string;
  metadata?: {
    linked_at: string;
  };
}
```

### Example Output (Success)
```json
{
  "success": true,
  "link_id": "link-uuid",
  "metadata": {
    "linked_at": "2026-01-05T12:00:00Z"
  }
}
```

### Example Output (Error)
```json
{
  "error": "blueprint_id is required",
  "code": "INVALID_INPUT",
  "details": {
    "field": "blueprint_id"
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate input parameters
2. Upsert to blueprint_topic_resources table
3. Handle conflicts using (blueprint_id, unit_id, resource_id) composite key
4. Return link_id and success status

### Edge Cases
- **Duplicate Link**: Updates existing link with new relevance/explanation
- **Non-existent IDs**: Database foreign key constraint will fail
- **Invalid Relevance**: Returns error if out of 0-1 range

### Performance Requirements
- **Timeout**: Must complete within 2 seconds
- **Idempotency**: Safe to retry (upsert handles duplicates)
- **Memory**: Max 5MB usage

## Dependencies

### External APIs
- None

### Database Tables
- `blueprint_topic_resources`: Junction table for links

### Internal Functions
- None (atomic function)

### Environment Variables
- `SUPABASE_URL`: Required for database access
- `SUPABASE_SERVICE_ROLE_KEY`: Required for database access

## Error Handling

### Error Codes
- `INVALID_INPUT`: Input validation failed
- `DATABASE_ERROR`: Database operation failed
- `NOT_FOUND`: Referenced blueprint/resource doesn't exist

### Error Recovery Strategies
- **DATABASE_ERROR**: No retry (likely constraint violation)
- **INVALID_INPUT**: Return error immediately

### Fallback Behavior
- No fallback - link must succeed or fail explicitly

## Testing Examples

### Test Case 1: Create New Link
**Input:**
```json
{
  "blueprint_id": "bp-123",
  "unit_id": "unit-01",
  "resource_id": "res-456",
  "relevance": 0.92
}
```
**Expected Output:**
```json
{
  "success": true,
  "link_id": "link-xxx"
}
```

### Test Case 2: Update Existing Link
**Input:** Same IDs as Test Case 1 but different relevance
**Expected Output:**
```json
{
  "success": true,
  "link_id": "link-xxx"
}
```
**Validation**: Relevance score updated in database

### Test Case 3: Missing Required Field
**Input:**
```json
{
  "blueprint_id": "",
  "unit_id": "unit-01",
  "resource_id": "res-456"
}
```
**Expected Output:**
```json
{
  "error": "blueprint_id is required",
  "code": "INVALID_INPUT"
}
```

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

