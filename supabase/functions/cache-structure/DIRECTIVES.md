# Function: cache-structure

## Metadata
- **Version**: 2.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Stores newly generated learning units in the cache at the SECTION LEVEL for future reuse.

## Responsibility
Accepts an array of sections with their embeddings and generated learning units. Stores each section individually in cached_blueprint_structures table for granular cache matching.

## Input Contract

### TypeScript Interface
```typescript
interface CacheStructureInput {
  sections_to_cache: SectionToCache[];
  analysis: AnalysisResult;
  analysis_id: string;
}

interface SectionToCache {
  section_id: string;
  section_type: 'problem' | 'topic';
  section_embedding: number[];
  embedding_source: string;
  cached_unit: LearningUnit;
}
```

## Output Contract

### TypeScript Interface
```typescript
interface CacheStructureOutput {
  cached_sections: number;
  cache_ids: string[];
  metadata?: {
    cached_at: string;
  };
}
```

## Workflow

1. Validate input - ensure sections_to_cache array is provided
2. If array is empty, return immediately with 0 cached
3. For each section in sections_to_cache:
   a. Prepare cache entry with all required fields
   b. Insert into cached_blueprint_structures table
   c. Store cache_id in results array
4. Log success/failure for each section
5. Return total cached count and cache_ids array

## Dependencies
- cached_blueprint_structures table
- supabase-client.ts for database access

## Testing Examples
**Test Case 1**: 3 sections to cache → Returns cached_sections: 3 with 3 cache_ids
**Test Case 2**: Empty sections_to_cache → Returns cached_sections: 0 immediately
**Test Case 3**: Partial failure (1 of 3 fails) → Returns cached_sections: 2 with 2 cache_ids

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Revamped for section-level caching - manual
