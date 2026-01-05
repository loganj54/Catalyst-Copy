# Function: generate-embedding

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Generate semantic embeddings from text using OpenAI's text-embedding-3-small model for vector similarity search.

## Responsibility
This function takes a text string and returns a 1536-dimensional embedding vector. It ONLY generates embeddings - it does NOT perform searches, store results, or handle any other operations. This is a pure transformation function.

## Input Contract

### TypeScript Interface
```typescript
interface GenerateEmbeddingInput {
  text: string;  // The text to generate an embedding for
}
```

### Example Input
```json
{
  "text": "Introduction to thermodynamics and heat transfer"
}
```

### Input Validation Rules
- `text`: Must be non-empty string, max 8000 characters (truncated if longer)
- Text is automatically trimmed of leading/trailing whitespace
- Empty or whitespace-only text returns error

## Output Contract

### TypeScript Interface
```typescript
interface GenerateEmbeddingOutput {
  embedding: number[];  // 1536-dimensional vector
  model: string;        // Model name used
  metadata?: {
    timestamp: string;
    text_length: number;
  };
}
```

### Example Output (Success)
```json
{
  "embedding": [0.0023, -0.0154, 0.0089, ...],
  "model": "text-embedding-3-small",
  "metadata": {
    "timestamp": "2026-01-05T12:00:00Z",
    "text_length": 45
  }
}
```

### Example Output (Error)
```json
{
  "error": "Text cannot be empty",
  "code": "INVALID_INPUT",
  "details": {
    "field": "text",
    "received": ""
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate input text is non-empty
2. Trim and truncate text to max 8000 characters
3. Call OpenAI embeddings API with text
4. Return 1536-dimensional embedding vector
5. Include metadata with timestamp and text length

### Edge Cases
- **Empty Input**: Returns error with code `EMPTY_INPUT`
- **Very Long Text**: Automatically truncated to 8000 chars with warning in metadata
- **API Timeout**: Retries up to 3 times with exponential backoff (1s, 2s, 4s)
- **Rate Limit Hit**: Returns error with code `RATE_LIMITED`

### Performance Requirements
- **Timeout**: Must complete within 10 seconds
- **Max Retries**: 3 attempts for transient failures
- **Idempotency**: Safe to retry (deterministic output for same input)
- **Memory**: Max 50MB usage

## Dependencies

### External APIs
- OpenAI Embeddings API (text-embedding-3-small)

### Database Tables
- None (pure computation function)

### Internal Functions
- None (atomic function)

### Environment Variables
- `OPENAI_API_KEY`: Required - OpenAI API key for embeddings

## Error Handling

### Error Codes
- `MISSING_API_KEY`: OpenAI API key not configured
- `INVALID_INPUT`: Input validation failed (empty text)
- `API_ERROR`: OpenAI API returned error
- `TIMEOUT`: Operation exceeded 10 second limit
- `RATE_LIMITED`: OpenAI API rate limit hit

### Error Recovery Strategies
- **API_ERROR**: Retry with exponential backoff (1s → 2s → 4s)
- **TIMEOUT**: Cancel request and return error (no partial results)
- **RATE_LIMITED**: Return error with retry_after suggestion (60 seconds)

### Fallback Behavior
- No fallback - this is a foundational function
- If OpenAI fails after retries, return error to caller

## Testing Examples

### Test Case 1: Valid Input - Success
**Input:**
```json
{ "text": "calculus tutorial for beginners" }
```
**Expected Output:**
```json
{
  "embedding": [0.0023, -0.0154, ...],
  "model": "text-embedding-3-small",
  "metadata": {
    "timestamp": "2026-01-05T12:00:00Z",
    "text_length": 31
  }
}
```
**Validation**: embedding array has exactly 1536 elements

### Test Case 2: Empty Input - Error
**Input:**
```json
{ "text": "" }
```
**Expected Output:**
```json
{
  "error": "Text cannot be empty",
  "code": "INVALID_INPUT",
  "details": { "field": "text", "received": "" }
}
```

### Test Case 3: Very Long Input - Truncated
**Input:**
```json
{ "text": "[10000 character string]" }
```
**Expected Output:**
```json
{
  "embedding": [...],
  "model": "text-embedding-3-small",
  "metadata": {
    "timestamp": "2026-01-05T12:00:00Z",
    "text_length": 8000,
    "truncated": true,
    "original_length": 10000
  }
}
```

### Test Case 4: API Failure - Retry Success
**Mock**: API fails twice, succeeds on 3rd attempt
**Input:**
```json
{ "text": "test" }
```
**Expected Output:**
```json
{
  "embedding": [...],
  "model": "text-embedding-3-small",
  "metadata": {
    "timestamp": "2026-01-05T12:00:00Z",
    "text_length": 4,
    "retries": 2
  }
}
```

## Known Issues & Fixes

(This section will be populated by the self-healing agent as errors are encountered and fixed)

## Change History
- **2026-01-05**: Initial implementation - manual

