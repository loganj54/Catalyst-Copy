-- ============================================================================
-- TARGET RESOURCE EMBEDDING OPTIMIZATION - SQL MIGRATION
-- ============================================================================
-- This migration adds documentation for the target resource profile embeddings
-- that are stored INSIDE each learning unit in the structure JSONB column.
--
-- IMPORTANT: The embeddings are stored at the UNIT LEVEL inside the structure,
-- NOT in the all_search_queries array. Each learning unit now has:
--   - target_resource_profile: Description of ideal resource
--   - target_resource_embedding: 1536-dim vector embedding of that description
--
-- NO SCHEMA CHANGES NEEDED - JSONB already supports this structure!
-- ============================================================================

-- ============================================================================
-- STEP 1: Document the structure column
-- ============================================================================

COMMENT ON COLUMN blueprint_structures.structure IS 
  'Complete learning structure as JSONB. Contains:
  - summary: Overview and metadata
  - prerequisites_section: Prerequisite learning units
  - content_sections: Main learning content sections
  
  Each learning_unit contains:
  - unit_id, topic, description, learning_objective
  - tutor_guidance: AI explanation of why this matters
  - search_queries: Array of search queries for finding resources
  - semantic_search_phrase: Natural language description for semantic search
  - target_resource_profile: Description of the IDEAL resource for this unit
  - target_resource_embedding: Pre-computed 1536-dim vector embedding of target_resource_profile
  - equations, suggested_figures: Related content
  
  The target_resource_embedding enables fast semantic search without regenerating embeddings.';

-- ============================================================================
-- STEP 2: Create helper function to extract target resource embeddings
-- ============================================================================

CREATE OR REPLACE FUNCTION extract_target_resource_embeddings(structure_id UUID)
RETURNS TABLE (
  unit_id TEXT,
  unit_type TEXT,
  topic TEXT,
  has_target_profile BOOLEAN,
  has_embedding BOOLEAN,
  embedding_dimensions INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH all_units AS (
    -- Extract prerequisite units
    SELECT 
      (unit->>'unit_id')::TEXT as unit_id,
      (unit->>'unit_type')::TEXT as unit_type,
      (unit->>'topic')::TEXT as topic,
      (unit->>'target_resource_profile') IS NOT NULL as has_target_profile,
      (unit->'target_resource_embedding') IS NOT NULL as has_embedding,
      CASE 
        WHEN (unit->'target_resource_embedding') IS NOT NULL 
        THEN jsonb_array_length(unit->'target_resource_embedding')
        ELSE 0
      END as embedding_dimensions
    FROM 
      blueprint_structures bs,
      jsonb_array_elements(bs.structure->'prerequisites_section'->'learning_units') as unit
    WHERE 
      bs.id = structure_id
    
    UNION ALL
    
    -- Extract content section units
    SELECT 
      (unit->>'unit_id')::TEXT as unit_id,
      (unit->>'unit_type')::TEXT as unit_type,
      (unit->>'topic')::TEXT as topic,
      (unit->>'target_resource_profile') IS NOT NULL as has_target_profile,
      (unit->'target_resource_embedding') IS NOT NULL as has_embedding,
      CASE 
        WHEN (unit->'target_resource_embedding') IS NOT NULL 
        THEN jsonb_array_length(unit->'target_resource_embedding')
        ELSE 0
      END as embedding_dimensions
    FROM 
      blueprint_structures bs,
      jsonb_array_elements(bs.structure->'content_sections') as section,
      jsonb_array_elements(section->'learning_units') as unit
    WHERE 
      bs.id = structure_id
  )
  SELECT * FROM all_units;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION extract_target_resource_embeddings IS 
  'Extracts target resource embedding metadata from all learning units in a blueprint structure.
  Usage: SELECT * FROM extract_target_resource_embeddings(''your-structure-uuid'');';

-- ============================================================================
-- STEP 3: Create analytics view for embedding coverage
-- ============================================================================

CREATE OR REPLACE VIEW target_resource_embedding_coverage AS
WITH unit_stats AS (
  SELECT
    bs.id as structure_id,
    bs.blueprint_id,
    bs.created_at,
    bs.total_learning_units,
    COUNT(*) as total_units_found,
    COUNT(*) FILTER (WHERE (unit->'target_resource_embedding') IS NOT NULL) as units_with_embeddings,
    COUNT(*) FILTER (WHERE (unit->'target_resource_embedding') IS NULL) as units_without_embeddings
  FROM 
    blueprint_structures bs,
    LATERAL (
      SELECT unit FROM jsonb_array_elements(bs.structure->'prerequisites_section'->'learning_units') as unit
      UNION ALL
      SELECT unit FROM 
        jsonb_array_elements(bs.structure->'content_sections') as section,
        jsonb_array_elements(section->'learning_units') as unit
    ) units
  GROUP BY 
    bs.id, bs.blueprint_id, bs.created_at, bs.total_learning_units
)
SELECT
  structure_id,
  blueprint_id,
  created_at,
  total_learning_units,
  total_units_found,
  units_with_embeddings,
  units_without_embeddings,
  ROUND(
    100.0 * units_with_embeddings / NULLIF(total_units_found, 0), 
    2
  ) as embedding_coverage_percent
FROM unit_stats
ORDER BY created_at DESC;

COMMENT ON VIEW target_resource_embedding_coverage IS 
  'Shows target resource embedding coverage for all blueprint structures.
  Usage: SELECT * FROM target_resource_embedding_coverage WHERE embedding_coverage_percent < 100;';

-- ============================================================================
-- STEP 4: Create summary statistics view
-- ============================================================================

CREATE OR REPLACE VIEW target_embedding_optimization_stats AS
SELECT
  COUNT(*) as total_structures,
  COUNT(*) FILTER (WHERE embedding_coverage_percent = 100) as fully_covered_structures,
  COUNT(*) FILTER (WHERE embedding_coverage_percent > 0 AND embedding_coverage_percent < 100) as partially_covered_structures,
  COUNT(*) FILTER (WHERE embedding_coverage_percent = 0 OR embedding_coverage_percent IS NULL) as no_embeddings_structures,
  ROUND(AVG(embedding_coverage_percent), 2) as avg_coverage_percent,
  SUM(units_with_embeddings) as total_units_with_embeddings,
  SUM(units_without_embeddings) as total_units_without_embeddings
FROM target_resource_embedding_coverage;

COMMENT ON VIEW target_embedding_optimization_stats IS 
  'Overall statistics for the target resource embedding optimization.
  Usage: SELECT * FROM target_embedding_optimization_stats;';

-- ============================================================================
-- STEP 5: Verification and reporting
-- ============================================================================

DO $$
DECLARE
  v_comment_exists BOOLEAN;
  v_function_exists BOOLEAN;
  v_view_exists BOOLEAN;
  v_stats_view_exists BOOLEAN;
BEGIN
  -- Check if column comment was added
  SELECT EXISTS (
    SELECT 1 
    FROM pg_description 
    WHERE objoid = 'blueprint_structures'::regclass 
      AND objsubid = (
        SELECT attnum 
        FROM pg_attribute 
        WHERE attrelid = 'blueprint_structures'::regclass 
          AND attname = 'structure'
      )
  ) INTO v_comment_exists;

  -- Check if helper function exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'extract_target_resource_embeddings'
  ) INTO v_function_exists;

  -- Check if view exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE schemaname = 'public'
      AND viewname = 'target_resource_embedding_coverage'
  ) INTO v_view_exists;

  -- Check if stats view exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE schemaname = 'public'
      AND viewname = 'target_embedding_optimization_stats'
  ) INTO v_stats_view_exists;

  -- Report results
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'TARGET RESOURCE EMBEDDING OPTIMIZATION - MIGRATION COMPLETE';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  
  IF v_comment_exists THEN
    RAISE NOTICE '✅ Structure column documentation added';
  ELSE
    RAISE WARNING '⚠️  Structure column documentation not found';
  END IF;

  IF v_function_exists THEN
    RAISE NOTICE '✅ Helper function created: extract_target_resource_embeddings()';
  ELSE
    RAISE WARNING '⚠️  Helper function not found';
  END IF;

  IF v_view_exists THEN
    RAISE NOTICE '✅ Analytics view created: target_resource_embedding_coverage';
  ELSE
    RAISE WARNING '⚠️  Analytics view not found';
  END IF;

  IF v_stats_view_exists THEN
    RAISE NOTICE '✅ Stats view created: target_embedding_optimization_stats';
  ELSE
    RAISE WARNING '⚠️  Stats view not found';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'How it works:';
  RAISE NOTICE '  • Each learning unit now has target_resource_profile (text)';
  RAISE NOTICE '  • Each unit also has target_resource_embedding (1536-dim vector)';
  RAISE NOTICE '  • Embeddings are stored INSIDE the structure JSONB at unit level';
  RAISE NOTICE '  • This enables fast semantic search without regenerating embeddings';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Deploy updated edge functions';
  RAISE NOTICE '  2. Deploy updated frontend';
  RAISE NOTICE '  3. Create a new blueprint to test';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring:';
  RAISE NOTICE '  • Check coverage: SELECT * FROM target_resource_embedding_coverage;';
  RAISE NOTICE '  • View stats: SELECT * FROM target_embedding_optimization_stats;';
  RAISE NOTICE '  • Extract embeddings: SELECT * FROM extract_target_resource_embeddings(''uuid'');';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- STEP 6: Display current statistics (if any structures exist)
-- ============================================================================

DO $$
DECLARE
  v_structure_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_structure_count FROM blueprint_structures;
  
  IF v_structure_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Current Database Statistics:';
    RAISE NOTICE '----------------------------';
    RAISE NOTICE 'Total blueprint structures: %', v_structure_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Run this query to see embedding coverage:';
    RAISE NOTICE '  SELECT * FROM target_resource_embedding_coverage LIMIT 10;';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'No blueprint structures found yet.';
    RAISE NOTICE 'Create a new blueprint to test the optimization!';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The database is now ready for target resource embedding optimization!
-- New structures will automatically include pre-computed embeddings at the unit level.
-- Old structures will continue to work (embeddings generated on-demand).
-- ============================================================================

