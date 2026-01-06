-- ============================================================================
-- Remove Embedding Constraints from cached_blueprint_structures
-- ============================================================================
-- Since we've moved to Pinecone for vector storage, we no longer need
-- to enforce embedding constraints in Supabase. Supabase now only stores
-- metadata and the full cached_unit data.
-- ============================================================================

-- Drop the constraints that require embeddings
ALTER TABLE cached_blueprint_structures
DROP CONSTRAINT IF EXISTS check_problem_fields;

ALTER TABLE cached_blueprint_structures
DROP CONSTRAINT IF EXISTS check_topic_fields;

-- Make embedding columns nullable (they're optional now)
ALTER TABLE cached_blueprint_structures
ALTER COLUMN primary_embedding DROP NOT NULL;

ALTER TABLE cached_blueprint_structures
ALTER COLUMN problem_statement_embedding DROP NOT NULL;

ALTER TABLE cached_blueprint_structures
ALTER COLUMN topic_summary_embedding DROP NOT NULL;

-- Add comment explaining the new architecture
COMMENT ON TABLE cached_blueprint_structures IS 
'Stores cached blueprint sections for reuse. Vector embeddings are stored in Pinecone (3072 dims). This table stores metadata and full cached_unit data only.';

COMMENT ON COLUMN cached_blueprint_structures.primary_embedding IS 
'DEPRECATED: Embeddings now stored in Pinecone. This column kept for backwards compatibility but may be NULL for new entries.';

COMMENT ON COLUMN cached_blueprint_structures.problem_statement_embedding IS 
'DEPRECATED: Embeddings now stored in Pinecone. This column kept for backwards compatibility but may be NULL for new entries.';

COMMENT ON COLUMN cached_blueprint_structures.topic_summary_embedding IS 
'DEPRECATED: Embeddings now stored in Pinecone. This column kept for backwards compatibility but may be NULL for new entries.';

