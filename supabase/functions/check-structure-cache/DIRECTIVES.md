# Function: check-structure-cache

## Metadata
- **Version**: 2.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Checks if similar learning units exist in cache at the SECTION LEVEL using vector similarity.

## Responsibility
For each section in the document analysis, searches cached_blueprint_structures table using vector embeddings to find similar cached learning units. Returns cache hit/miss results for each section individually.

## Input Contract

### TypeScript Interface
```typescript
interface CheckStructureCacheInput {
  analysis: AnalysisResult;
  threshold: number; // Default: 0.95 for strict matching
  sections_with_embeddings?: SectionWithEmbedding[]; // Optional pre-computed embeddings
}
```

## Output Contract

### TypeScript Interface
```typescript
interface CheckStructureCacheOutput {
  cache_results: SectionCacheResult[];
  overall_cache_hit_rate: number;
  total_sections: number;
  cached_sections: number;
  generated_sections: number;
}

interface SectionCacheResult {
  section_id: string;
  section_type: 'problem' | 'topic';
  cache_hit: boolean;
  cached_unit?: LearningUnit;
  similarity?: number;
  cache_id?: string;
  times_used?: number;
  quality_score?: number;
}
```

## Workflow

1. Extract sections from analysis.sections array
2. For each section, generate embedding based on section_type:
   - If section_type === "problem": Use problem_statement field
   - If section_type === "topic": Use topic_summary + concepts_tested fields
3. Call search_similar_sections() database function for each section
4. If similarity >= threshold (0.95): return cache hit with cached_unit
5. Else: return cache miss
6. Increment usage counter for cache hits
7. Return array of results with overall statistics

## Dependencies
- section-embeddings.ts utility module
- cached_blueprint_structures table
- search_similar_sections() SQL function
- increment_section_cache_usage() SQL function

## Testing Examples
**Test Case 1**: Analysis with 5 problems, 3 cached → Returns 3 hits, 2 misses, 60% hit rate
**Test Case 2**: Analysis with lecture topics, none cached → Returns all misses, 0% hit rate
**Test Case 3**: Analysis with hybrid content → Returns mixed results

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Revamped for section-level caching - manual
