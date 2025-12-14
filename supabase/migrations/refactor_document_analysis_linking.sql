-- ============================================================================
-- REFACTOR: Link Document Analyses to Documents (not Blueprints)
-- ============================================================================
-- This migration fixes the data model so that:
-- 1. Document analyses are linked to class_documents (the actual document)
-- 2. Blueprints reference which document they're using
-- 3. A document can be analyzed once and reused across multiple blueprints
-- ============================================================================

-- ============================================================================
-- STEP 1: Add document_id to blueprints table
-- ============================================================================
-- This allows blueprints to reference which class_document they're using

ALTER TABLE blueprints 
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES class_documents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blueprints_document_id ON blueprints(document_id);

COMMENT ON COLUMN blueprints.document_id IS 
    'Reference to the class_document this blueprint is analyzing. Allows document reuse across blueprints.';

-- ============================================================================
-- STEP 2: Add document_id to document_analyses table
-- ============================================================================
-- This is the PRIMARY link - analyses belong to documents, not blueprints

ALTER TABLE document_analyses 
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES class_documents(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_document_analyses_document_id ON document_analyses(document_id);

COMMENT ON COLUMN document_analyses.document_id IS 
    'Reference to the class_document that was analyzed. This is the primary link - one analysis per document.';

-- ============================================================================
-- STEP 3: Migrate existing data (link analyses to documents by filename)
-- ============================================================================
-- Try to match existing analyses to documents by source_filename

UPDATE document_analyses da
SET document_id = cd.id
FROM class_documents cd
WHERE da.document_id IS NULL
  AND da.source_filename = cd.name
  AND da.user_id = cd.user_id;

-- Also try to set document_id on blueprints that have file_metadata
UPDATE blueprints b
SET document_id = cd.id
FROM class_documents cd
WHERE b.document_id IS NULL
  AND b.class_id = cd.class_id
  AND b.user_id = cd.user_id
  AND (b.file_metadata->>'name') = cd.name;

-- ============================================================================
-- STEP 4: Create unique constraint on document_analyses.document_id
-- ============================================================================
-- Ensures only ONE analysis per document (prevents duplicate analyses)
-- Using a partial unique index since document_id can be NULL for legacy data

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_analyses_unique_document 
ON document_analyses(document_id) 
WHERE document_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Update learning_structures to also reference document_id
-- ============================================================================

ALTER TABLE learning_structures 
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES class_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_learning_structures_document_id ON learning_structures(document_id);

-- ============================================================================
-- NOTES:
-- ============================================================================
-- - blueprint_id on document_analyses is kept for backward compatibility
-- - New code should use document_id as the primary link
-- - Old analyses without document_id will still work via blueprint_id fallback
-- ============================================================================

