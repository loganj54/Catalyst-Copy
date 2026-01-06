-- ============================================================================
-- PINECONE INTEGRATION MIGRATION
-- ============================================================================
-- Adds Pinecone vector ID tracking to existing tables
-- Vectors stored in Pinecone (3072 dims), metadata in Supabase
-- ============================================================================

BEGIN;

-- Add pinecone_vector_id to curated_resources
ALTER TABLE curated_resources 
  ADD COLUMN IF NOT EXISTS pinecone_vector_id TEXT;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_curated_resources_pinecone_id 
  ON curated_resources(pinecone_vector_id);

-- Add pinecone_vector_id to curated_equations
ALTER TABLE curated_equations 
  ADD COLUMN IF NOT EXISTS pinecone_vector_id TEXT;

CREATE INDEX IF NOT EXISTS idx_curated_equations_pinecone_id 
  ON curated_equations(pinecone_vector_id);

-- Add pinecone_vector_id to curated_figures
ALTER TABLE curated_figures 
  ADD COLUMN IF NOT EXISTS pinecone_vector_id TEXT;

CREATE INDEX IF NOT EXISTS idx_curated_figures_pinecone_id 
  ON curated_figures(pinecone_vector_id);

-- Add comments
COMMENT ON COLUMN curated_resources.pinecone_vector_id IS 
  'Reference to vector stored in Pinecone (3072 dimensions)';

COMMENT ON COLUMN curated_equations.pinecone_vector_id IS 
  'Reference to vector stored in Pinecone (3072 dimensions)';

COMMENT ON COLUMN curated_figures.pinecone_vector_id IS 
  'Reference to vector stored in Pinecone (3072 dimensions)';

COMMIT;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Pinecone integration migration complete';
  RAISE NOTICE 'Added pinecone_vector_id columns to track vectors in Pinecone';
  RAISE NOTICE 'Vectors will use full 3072 dimensions in Pinecone';
END $$;

