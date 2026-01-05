# Function: orchestrate-generate-structure

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Orchestrates complete structure generation workflow by composing atomic functions.

## Responsibility
Composes atomic structure functions into full workflow. Coordinates: analysis fetch, cache check, adaptation/generation, equation/figure processing, storage, and caching.

## Input Contract

### TypeScript Interface
```typescript
interface OrchestrateGenerateStructureInput {
  blueprint_id: string;
}
```

## Output Contract

### TypeScript Interface
```typescript
interface OrchestrateGenerateStructureOutput {
  structure: LearningStructure;
  structure_id: string;
  from_cache: boolean;
  metadata?: {
    total_time_ms: number;
    steps_completed: string[];
    token_savings?: string;
  };
}
```

## Workflow

1. Call `fetch-analysis` with blueprint_id
2. Call `check-structure-cache` with analysis
3. If cache hit:
   - Call `adapt-cached-structure`
4. If cache miss:
   - Call `generate-structure-with-ai`
5. Call `process-equations` for structure
6. Call `source-figures` for structure
7. Call `store-structure`
8. Call `cache-structure`
9. Return structure with metadata

## Dependencies
- All structure atomic functions (fetch-analysis, check-structure-cache, adapt-cached-structure, generate-structure-with-ai, process-equations, source-figures, store-structure, cache-structure)

## Testing Examples
**Test Case**: Valid blueprint_id → Returns complete learning structure

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

