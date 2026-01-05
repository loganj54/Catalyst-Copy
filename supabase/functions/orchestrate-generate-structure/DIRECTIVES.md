# Function: orchestrate-generate-structure

## Metadata
- **Version**: 2.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Orchestrates complete structure generation workflow with SECTION-LEVEL caching.

## Responsibility
Composes atomic structure functions into full workflow with granular caching. Coordinates: analysis fetch, section embedding generation, cache check per section, mixed generation for cache misses, structure combination, storage, and caching of new units.

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
    cache_hit_rate?: number;
    cached_sections?: number;
    generated_sections?: number;
  };
}
```

## Workflow

1. Call `fetch-analysis` with blueprint_id
2. Generate embeddings for all sections using section-embeddings.ts
3. Call `check-structure-cache` with section embeddings
4. Separate cache hits from misses
5. If cache misses exist:
   - Call `generate-structure-mixed` with only missed sections
6. Combine cached units + newly generated units into full structure
7. (Optional) Call `process-equations` for structure
8. (Optional) Call `source-figures` for structure
9. Call `store-structure` with cache metadata
10. If new units were generated:
    - Call `cache-structure` with newly generated units
11. Return complete structure with metadata

## Dependencies
- fetch-analysis
- section-embeddings.ts utility
- check-structure-cache
- generate-structure-mixed
- store-structure
- cache-structure

## Testing Examples
**Test Case 1**: All sections cached → Returns structure immediately, 100% hit rate
**Test Case 2**: No sections cached → Generates all sections, 0% hit rate
**Test Case 3**: Mixed (3 cached, 2 new) → Generates 2 sections, 60% hit rate

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Revamped for section-level caching - manual
- **2026-01-05**: Initial implementation - manual
