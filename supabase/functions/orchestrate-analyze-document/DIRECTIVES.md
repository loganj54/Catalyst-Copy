# Function: orchestrate-analyze-document

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Orchestrates complete document analysis workflow by composing atomic functions.

## Responsibility
Composes atomic analysis functions into full workflow. Coordinates: existence check, document fetch, PDF parsing, Claude analysis, storage, and name generation.

## Input Contract

### TypeScript Interface
```typescript
interface OrchestrateAnalyzeDocumentInput {
  blueprint_id: string;
  force_reanalyze?: boolean;
}
```

## Output Contract

### TypeScript Interface
```typescript
interface OrchestrateAnalyzeDocumentOutput {
  analysis: AnalysisResult;
  analysis_id: string;
  reused: boolean;
  metadata?: {
    total_time_ms: number;
    steps_completed: string[];
  };
}
```

## Workflow

1. Call `check-existing-analysis` with document_id
2. If exists and not force_reanalyze: Return cached
3. Call `fetch-document` to get file
4. If PDF: Call `parse-pdf-to-base64`
5. Call `analyze-with-claude` with content
6. Call `store-analysis`
7. Call `generate-blueprint-name`
8. Return analysis with metadata

## Dependencies
- All analysis atomic functions (check-existing-analysis, fetch-document, parse-pdf-to-base64, analyze-with-claude, store-analysis, generate-blueprint-name)

## Testing Examples
**Test Case**: Valid blueprint_id → Returns complete analysis

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

