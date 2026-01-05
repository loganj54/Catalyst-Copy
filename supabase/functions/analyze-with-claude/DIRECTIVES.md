# Function: analyze-with-claude

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Call Claude API with vision capability for document analysis.

## Responsibility
This function calls Claude for analysis. It ONLY calls API - it does NOT fetch documents, store results, or parse PDFs. Wrapper for callClaudeWithPDFAndText helper.

## Input Contract

### TypeScript Interface
```typescript
interface AnalyzeWithClaudeInput {
  pdf_base64?: string;
  text?: string;
  task_type: string;
}
```

### Example Input
```json
{
  "pdf_base64": "JVBERi0xLjQK...",
  "text": "Additional context",
  "task_type": "homework"
}
```

### Input Validation Rules
- At least one of `pdf_base64` or `text` must be provided
- `task_type`: Must be non-empty string

## Output Contract

### TypeScript Interface
```typescript
interface AnalyzeWithClaudeOutput {
  analysis: AnalysisResult;
  model: string;
  metadata?: {
    tokens_used: number;
    analysis_time_ms: number;
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
  "model": "claude-haiku-4-5",
  "metadata": {
    "tokens_used": 5240,
    "analysis_time_ms": 3500
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate inputs
2. Call callClaudeWithPDFAndText from _shared
3. Return analysis with metadata

### Edge Cases
- **PDF Only**: Analyzes with vision
- **Text Only**: Analyzes text
- **Both**: Uses both for context

### Performance Requirements
- **Timeout**: 30 seconds
- **Memory**: Max 100MB

## Dependencies

### External APIs
- Anthropic API (Claude)

### Database Tables
- None (pure API call)

### Internal Functions
- `callClaudeWithPDFAndText` from `_shared/supabase-client.ts`
- `PROMPTS.documentAnalysis` from `_shared/prompts.ts`

### Environment Variables
- `ANTHROPIC_API_KEY`: Required

## Error Handling

### Error Codes
- `INVALID_INPUT`: Missing required fields
- `API_ERROR`: Claude API failed
- `RATE_LIMITED`: API quota exceeded
- `TIMEOUT`: Request exceeded time limit

### Error Recovery Strategies
- **API_ERROR**: Retry once after 2s
- **RATE_LIMITED**: Return error (no retry)
- **TIMEOUT**: Return error

### Fallback Behavior
- No fallback - analysis must succeed

## Testing Examples

### Test Case 1: PDF Analysis
**Input:** PDF base64 string
**Expected Output:** Complete analysis

### Test Case 2: Text Analysis
**Input:** Text content
**Expected Output:** Complete analysis

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

