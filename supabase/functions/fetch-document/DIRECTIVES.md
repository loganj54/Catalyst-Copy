# Function: fetch-document

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Download document from Supabase storage bucket with authentication handling.

## Responsibility
This function downloads files from storage. It ONLY fetches - it does NOT parse, analyze, or store. Handles both public and private buckets.

## Input Contract

### TypeScript Interface
```typescript
interface FetchDocumentInput {
  file_url: string;
  bucket?: string;
  path?: string;
}
```

### Example Input
```json
{
  "file_url": "https://...supabase.co/storage/v1/object/public/class-documents/file.pdf"
}
```

### Input Validation Rules
- `file_url`: Must be non-empty string (Supabase storage URL)
- `bucket`: Optional - extracted from URL if not provided
- `path`: Optional - extracted from URL if not provided

## Output Contract

### TypeScript Interface
```typescript
interface FetchDocumentOutput {
  content: ArrayBuffer | string;
  content_type: string;
  metadata?: {
    file_size_bytes: number;
    fetch_time_ms: number;
  };
}
```

### Example Output (Success)
```json
{
  "content": "<ArrayBuffer>",
  "content_type": "application/pdf",
  "metadata": {
    "file_size_bytes": 2048576,
    "fetch_time_ms": 450
  }
}
```

### Example Output (Error)
```json
{
  "error": "Failed to download file: 404 Not Found",
  "code": "NOT_FOUND"
}
```

## Behavior Specification

### Normal Flow
1. Validate file_url is provided
2. Parse URL to extract bucket and path
3. Try direct fetch (for public buckets)
4. If fails, try authenticated fetch (for private buckets)
5. Return content as ArrayBuffer with metadata

### Edge Cases
- **Public Bucket**: Direct fetch succeeds
- **Private Bucket**: Needs authenticated request
- **File Not Found**: Returns NOT_FOUND error
- **Invalid URL**: Returns INVALID_INPUT error

### Performance Requirements
- **Timeout**: 30 seconds for large files
- **Max File Size**: 32MB (Claude's limit)
- **Retries**: 2 attempts

## Dependencies

### External APIs
- Supabase Storage API

### Database Tables
- None (storage only)

### Internal Functions
- None (atomic function)

### Environment Variables
- `SUPABASE_URL`: Required
- `SUPABASE_SERVICE_ROLE_KEY`: Required for private buckets

## Error Handling

### Error Codes
- `INVALID_INPUT`: Invalid or empty file_url
- `NOT_FOUND`: File doesn't exist (404)
- `TIMEOUT`: Download exceeded time limit
- `API_ERROR`: Storage API error

### Error Recovery Strategies
- **Public fetch fails**: Try authenticated fetch
- **Timeout**: Retry with longer timeout
- **NOT_FOUND**: Return error (no retry)

### Fallback Behavior
- Try multiple fetch strategies before failing

## Testing Examples

### Test Case 1: Public File
**Input:** Public bucket file URL
**Expected Output:** ArrayBuffer with content

### Test Case 2: Private File
**Input:** Private bucket file URL (requires auth)
**Expected Output:** ArrayBuffer with content

### Test Case 3: File Not Found
**Input:** Non-existent file URL
**Expected Output:** NOT_FOUND error

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

