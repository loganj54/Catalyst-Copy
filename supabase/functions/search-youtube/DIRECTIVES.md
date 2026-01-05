# Function: search-youtube

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Search YouTube Data API v3 for educational videos using optimized queries.

## Responsibility
This function searches YouTube using the official Data API. It ONLY searches YouTube - it does NOT analyze transcripts, store results, or generate embeddings. Returns raw YouTube video metadata.

## Input Contract

### TypeScript Interface
```typescript
interface SearchYoutubeInput {
  queries: string[];
  max_results: number;
  filters?: {
    language?: string;
    duration?: 'short' | 'medium' | 'long';
  };
}
```

### Example Input
```json
{
  "queries": ["thermodynamics tutorial", "heat transfer basics"],
  "max_results": 3,
  "filters": {
    "language": "en",
    "duration": "medium"
  }
}
```

### Input Validation Rules
- `queries`: Must be non-empty array of strings
- `max_results`: Must be between 1 and 10
- `filters.language`: Optional, defaults to "en"
- `filters.duration`: Optional, one of "short", "medium", "long"

## Output Contract

### TypeScript Interface
```typescript
interface SearchYoutubeOutput {
  resources: Resource[];
  queries_used: string[];
  total_found: number;
  metadata?: {
    api_quota_used: number;
  };
}
```

### Example Output (Success)
```json
{
  "resources": [
    {
      "url": "https://www.youtube.com/watch?v=abc123",
      "title": "Thermodynamics Explained",
      "description": "Learn the basics...",
      "platform": "YouTube",
      "channel_name": "Physics Academy",
      "thumbnail_url": "https://img.youtube.com/vi/abc123/mqdefault.jpg",
      "topic_signature": "Educational video about thermodynamics",
      "concepts_covered": ["heat transfer"],
      "difficulty_level": "intermediate",
      "quality_score": 0.8,
      "from_cache": false
    }
  ],
  "queries_used": ["thermodynamics tutorial"],
  "total_found": 1,
  "metadata": {
    "api_quota_used": 100
  }
}
```

### Example Output (Error)
```json
{
  "error": "YouTube API key not configured",
  "code": "MISSING_API_KEY"
}
```

## Behavior Specification

### Normal Flow
1. Validate input queries and max_results
2. For each query, call YouTube Data API v3
3. Parse video results and extract metadata
4. Deduplicate by video ID
5. Return up to max_results videos

### Edge Cases
- **API Key Missing**: Returns error with code `MISSING_API_KEY`
- **No Results**: Returns empty array
- **API Error**: Returns error with code `API_ERROR`
- **Rate Limit**: Returns error with code `RATE_LIMITED`

### Performance Requirements
- **Timeout**: 10 seconds per query
- **Max Retries**: 2 attempts for transient failures
- **Idempotency**: Safe to retry

## Dependencies

### External APIs
- YouTube Data API v3 (requires API key)

### Database Tables
- None (pure API function)

### Internal Functions
- None (atomic function)

### Environment Variables
- `YOUTUBE_API_KEY`: Required - YouTube Data API key

## Error Handling

### Error Codes
- `MISSING_API_KEY`: YouTube API key not configured
- `INVALID_INPUT`: Input validation failed
- `API_ERROR`: YouTube API returned error
- `RATE_LIMITED`: API quota exceeded
- `TIMEOUT`: Request exceeded time limit

### Error Recovery Strategies
- **API_ERROR**: Retry with exponential backoff (1s → 2s)
- **RATE_LIMITED**: Return error (no retry)
- **TIMEOUT**: Skip query and continue with next

### Fallback Behavior
- If some queries fail, return partial results
- If all queries fail, return empty array with error details

## Testing Examples

### Test Case 1: Successful Search
**Input:**
```json
{
  "queries": ["calculus tutorial"],
  "max_results": 3
}
```
**Expected Output:** 1-3 YouTube videos with complete metadata

### Test Case 2: Multiple Queries
**Input:**
```json
{
  "queries": ["physics basics", "chemistry intro"],
  "max_results": 5
}
```
**Expected Output:** Up to 5 videos from both queries, deduplicated

### Test Case 3: No Results
**Input:**
```json
{
  "queries": ["zxcvbnmasdfgh123456789"],
  "max_results": 3
}
```
**Expected Output:**
```json
{
  "resources": [],
  "queries_used": ["zxcvbnmasdfgh123456789"],
  "total_found": 0
}
```

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

