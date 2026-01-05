# Function: generate-structure-mixed

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Generates learning units for ONLY the cache-missed sections, enabling mixed generation where some sections are cached and others are freshly generated.

## Responsibility
Accepts a filtered analysis containing only sections that need generation. Calls Claude to generate learning units for those specific sections. Returns generated units mapped by section_id.

## Input Contract

### TypeScript Interface
```typescript
interface GenerateStructureMixedInput {
  analysis: AnalysisResult;
  cache_results: SectionCacheResult[];
  sections_to_generate: string[]; // Array of section IDs that need generation
}
```

## Output Contract

### TypeScript Interface
```typescript
interface GenerateStructureMixedOutput {
  generated_units: GeneratedUnitMap;
  model: string;
  metadata?: {
    tokens_used: number;
    generation_time_ms: number;
    sections_generated: number;
  };
}

interface GeneratedUnitMap {
  [section_id: string]: LearningUnit[];
}
```

## Workflow

1. Validate input - ensure sections_to_generate is provided
2. If sections_to_generate is empty, return empty result (all cached)
3. Filter analysis to only include sections that need generation
4. Build specialized prompt for partial generation
5. Call Claude with filtered analysis
6. Extract learning units from generated structure
7. Map units to their corresponding section_ids
8. Return mapped units with metadata

## Dependencies
- Claude API (Haiku model)
- prompts.ts for structure generation prompt
- supabase-client.ts for callClaudeWithJSON

## Testing Examples
**Test Case 1**: 3 sections to generate → Returns 3 section_ids with units
**Test Case 2**: Empty sections_to_generate → Returns empty map immediately
**Test Case 3**: Mixed document with problems and topics → Returns appropriate units for each

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Initial implementation for section-level caching - manual

