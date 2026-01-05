# Function: store-structure

## Metadata
- **Version**: 2.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Store learning structure in blueprint_structures table with section-level cache metadata.

## Responsibility
Stores structures in database (both fully cached, partially cached, or fully generated). Calculates metrics from structure. Logs cache performance metrics to section_cache_metrics table.

## Input Contract

### TypeScript Interface
```typescript
interface StoreStructureInput {
  structure: LearningStructure;
  blueprint_id: string;
  analysis_id?: string;
  document_id?: string;
  user_id?: string;
  from_cache?: string | boolean; // 'full', 'partial', 'none', or boolean
  cache_source_id?: string;
  cache_similarity?: number;
  cache_metadata?: {
    total_sections: number;
    cached_sections: number;
    generated_sections: number;
    cache_hit_rate: number;
  };
}
```

## Output Contract

### TypeScript Interface
```typescript
interface StoreStructureOutput {
  structure_id: string;
  metadata?: {
    stored_at: string;
  };
}
```

## Workflow

1. Validate inputs (structure and blueprint_id required)
2. Calculate metrics from structure:
   - Total learning units
   - Total content sections
   - Estimated completion time
3. Prepare structure entry with cache metadata
4. Insert into blueprint_structures table
5. If cache_metadata provided:
   - Log to section_cache_metrics table via RPC function
6. Return structure_id

## Dependencies
- blueprint_structures table
- section_cache_metrics table
- log_section_cache_metrics() SQL function
- supabase-client.ts for database access

## Testing Examples
**Test Case 1**: Fully cached structure → Stores with from_cache: 'full', 100% hit rate
**Test Case 2**: Partially cached structure → Stores with from_cache: 'partial', 60% hit rate
**Test Case 3**: Fully generated structure → Stores with from_cache: 'none', 0% hit rate

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Updated for section-level caching metadata - manual
- **2026-01-05**: Initial implementation - manual
