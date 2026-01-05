# Function: parse-pdf-to-base64

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Convert PDF ArrayBuffer to base64 string for Claude's vision API.

## Responsibility
This function converts PDF binary data to base64 encoding. It ONLY converts format - it does NOT fetch files, analyze content, or call APIs. Checks size limits.

## Input Contract

### TypeScript Interface
```typescript
interface ParsePdfToBase64Input {
  pdf_buffer: ArrayBuffer;
}
```

### Example Input
```json
{
  "pdf_buffer": "<ArrayBuffer>"
}
```

### Input Validation Rules
- `pdf_buffer`: Must be ArrayBuffer
- Size limit: Max 32MB (Claude's limit)

## Output Contract

### TypeScript Interface
```typescript
interface ParsePdfToBase64Output {
  base64: string;
  size_mb: number;
  metadata?: {
    parse_time_ms: number;
  };
}
```

### Example Output (Success)
```json
{
  "base64": "JVBERi0xLjQKJeLj...",
  "size_mb": 2.5,
  "metadata": {
    "parse_time_ms": 50
  }
}
```

### Example Output (Error)
```json
{
  "error": "PDF exceeds 32MB limit",
  "code": "INVALID_INPUT",
  "details": {
    "size_mb": 45.2,
    "max_mb": 32
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate input is ArrayBuffer
2. Check size is within limits (32MB)
3. Convert to base64 using standard encoding
4. Return base64 string with metadata

### Edge Cases
- **Empty Buffer**: Returns error
- **Too Large**: Returns error with size details
- **Invalid Buffer**: Returns error

### Performance Requirements
- **Timeout**: Must complete within 3 seconds
- **Memory**: 2x file size (buffer + base64)
- **Max File Size**: 32MB

## Dependencies

### External APIs
- None (pure transformation)

### Database Tables
- None

### Internal Functions
- `arrayBufferToBase64` from `_shared/supabase-client.ts`

### Environment Variables
- None

## Error Handling

### Error Codes
- `INVALID_INPUT`: Invalid buffer or too large
- `INTERNAL_ERROR`: Encoding failed

### Error Recovery Strategies
- **INVALID_INPUT**: Return error immediately
- **INTERNAL_ERROR**: No retry

### Fallback Behavior
- No fallback - conversion must succeed or fail

## Testing Examples

### Test Case 1: Valid PDF
**Input:** 2MB PDF ArrayBuffer
**Expected Output:** base64 string, size_mb: 2.0

### Test Case 2: Too Large
**Input:** 40MB PDF ArrayBuffer
**Expected Output:** INVALID_INPUT error

### Test Case 3: Empty Buffer
**Input:** Empty ArrayBuffer
**Expected Output:** INVALID_INPUT error

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

