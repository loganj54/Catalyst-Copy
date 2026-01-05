# Function: orchestrate-search-resources

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Orchestrates complete resource search workflow by composing atomic functions.

## Responsibility
Composes atomic search functions into full workflow. Coordinates: embedding generation, cache check, web search, transcript analysis, storage, linking, and explanation generation.

## Input Contract

### TypeScript Interface
```typescript
interface OrchestrateSearchResourcesInput {
  blueprint_id: string;
  unit_id: string;
  topic: string;
  search_queries: SearchQuery[];
  description?: string;
  learning_objective?: string;
}
```

## Output Contract

### TypeScript Interface
```typescript
interface OrchestrateSearchResourcesOutput {
  resources: Resource[];
  cache_hit: boolean;
  search_method: 'cache' | 'youtube_api' | 'grok' | 'claude_web_search';
  metadata?: {
    total_time_ms: number;
    steps_completed: string[];
  };
}
```

## Workflow

1. Call `generate-embedding` with topic text
2. Call `search-db-cache` with embedding
3. If cache hit: Return cached resources
4. If cache miss:
   - Call `search-youtube` with queries
   - For each resource:
     - Call `analyze-transcript`
     - Call `store-resource` with embedding
     - Call `link-resource-to-blueprint`
   - Call `generate-resource-explanations`
5. Return resources with metadata

## Dependencies
- All search atomic functions (generate-embedding, search-db-cache, search-youtube, analyze-transcript, store-resource, link-resource-to-blueprint, generate-resource-explanations)

## Testing Examples
**Test Case**: Valid topic → Returns 3 relevant resources

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

