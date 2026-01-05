-- ============================================================================
-- ADD QUERY EMBEDDINGS TO BLUEPRINT STRUCTURES
-- ============================================================================
-- This migration adds support for storing pre-computed embeddings with search
-- queries in the blueprint_structures table. This improves performance by
-- avoiding redundant embedding generation during the search phase.
--
-- BENEFITS:
-- - Faster resource search (no need to regenerate embeddings)
-- - Reduced API calls to embedding service
-- - Better caching and reusability
-- - Consistent embeddings across multiple searches
-- ============================================================================

-- The all_search_queries column is JSONB and already exists in blueprint_structures
-- We don't need to alter the table structure since JSONB can store the embedding arrays
-- However, we should add a comment to document the new structure

COMMENT ON COLUMN blueprint_structures.all_search_queries IS 
  'Array of flattened search queries with metadata. Each query object contains:
  - unit_id: Learning unit identifier
  - section_id: Section identifier
  - section_type: "prerequisite" or "content"
  - topic: Topic name
  - query: Search query text
  - query_type: Type of query (introduction, concept, tutorial, example, practice)
  - target_content: Description of ideal resource
  - priority: Search priority (1-5)
  - embedding: Pre-computed vector embedding (1536 dimensions) for semantic search
  - semantic_search_phrase: Natural language description for semantic matching';

-- ============================================================================
-- HELPER FUNCTION: Extract embeddings from search queries
-- ============================================================================
-- Extracts all embeddings from the all_search_queries JSONB array
-- Useful for analytics and debugging
-- ============================================================================

CREATE OR REPLACE FUNCTION extract_query_embeddings(structure_id UUID)
RETURNS TABLE (
  unit_id TEXT,
  query TEXT,
  has_embedding BOOLEAN,
  embedding_dimensions INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (query_obj->>'unit_id')::TEXT as unit_id,
    (query_obj->>'query')::TEXT as query,
    (query_obj->'embedding') IS NOT NULL as has_embedding,
    CASE 
      WHEN (query_obj->'embedding') IS NOT NULL 
      THEN jsonb_array_length(query_obj->'embedding')
      ELSE 0
    END as embedding_dimensions
  FROM 
    blueprint_structures bs,
    jsonb_array_elements(bs.all_search_queries) as query_obj
  WHERE 
    bs.id = structure_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ANALYTICS VIEW: Query Embedding Coverage
-- ============================================================================
-- Shows how many queries have embeddings vs. how many don't
-- ============================================================================

CREATE OR REPLACE VIEW query_embedding_coverage AS
SELECT
  bs.id as structure_id,
  bs.blueprint_id,
  bs.created_at,
  bs.total_search_queries,
  COUNT(*) FILTER (WHERE (query_obj->'embedding') IS NOT NULL) as queries_with_embeddings,
  COUNT(*) FILTER (WHERE (query_obj->'embedding') IS NULL) as queries_without_embeddings,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE (query_obj->'embedding') IS NOT NULL) / 
    NULLIF(COUNT(*), 0), 
    2
  ) as embedding_coverage_percent
FROM 
  blueprint_structures bs,
  jsonb_array_elements(bs.all_search_queries) as query_obj
GROUP BY 
  bs.id, bs.blueprint_id, bs.created_at, bs.total_search_queries
ORDER BY 
  bs.created_at DESC;

-- ============================================================================
-- MIGRATION VALIDATION
-- ============================================================================
-- Check if the migration was successful
-- ============================================================================

DO $$
BEGIN
  -- Verify the comment was added
  IF EXISTS (
    SELECT 1 
    FROM pg_description 
    WHERE objoid = 'blueprint_structures'::regclass 
      AND objsubid = (
        SELECT attnum 
        FROM pg_attribute 
        WHERE attrelid = 'blueprint_structures'::regclass 
          AND attname = 'all_search_queries'
      )
  ) THEN
    RAISE NOTICE '✅ Migration successful: all_search_queries column documented';
  ELSE
    RAISE WARNING '⚠️ Migration incomplete: column comment not found';
  END IF;

  -- Verify helper function exists
  IF EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'extract_query_embeddings'
  ) THEN
    RAISE NOTICE '✅ Helper function created: extract_query_embeddings';
  ELSE
    RAISE WARNING '⚠️ Helper function not found';
  END IF;

  -- Verify view exists
  IF EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE viewname = 'query_embedding_coverage'
  ) THEN
    RAISE NOTICE '✅ Analytics view created: query_embedding_coverage';
  ELSE
    RAISE WARNING '⚠️ Analytics view not found';
  END IF;
END $$;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Check embedding coverage for a specific blueprint structure
-- SELECT * FROM query_embedding_coverage WHERE structure_id = 'your-structure-id';

-- Example 2: Extract embeddings from a structure
-- SELECT * FROM extract_query_embeddings('your-structure-id');

-- Example 3: Find structures with incomplete embedding coverage
-- SELECT * FROM query_embedding_coverage WHERE embedding_coverage_percent < 100;

-- Example 4: Count total queries with embeddings across all structures
-- SELECT 
--   SUM(queries_with_embeddings) as total_with_embeddings,
--   SUM(queries_without_embeddings) as total_without_embeddings,
--   ROUND(AVG(embedding_coverage_percent), 2) as avg_coverage_percent
-- FROM query_embedding_coverage;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON FUNCTION extract_query_embeddings IS 
  'Extracts embedding metadata from all search queries in a blueprint structure';

COMMENT ON VIEW query_embedding_coverage IS 
  'Shows embedding coverage statistics for all blueprint structures';

