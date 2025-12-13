-- ============================================================================
-- QUICK FIX: Run this SQL to prevent document analyses from being deleted
-- ============================================================================

-- Make blueprint_id nullable and change constraint to SET NULL on delete
ALTER TABLE document_analyses 
  ALTER COLUMN blueprint_id DROP NOT NULL;

-- Drop existing cascade constraint
DO $$ 
BEGIN
  ALTER TABLE document_analyses DROP CONSTRAINT IF EXISTS document_analyses_blueprint_id_fkey;
  ALTER TABLE document_analyses DROP CONSTRAINT IF EXISTS fk_document_analyses_blueprint_id;
  ALTER TABLE document_analyses DROP CONSTRAINT IF EXISTS document_analyses_blueprint_id_fk;
END $$;

-- Add new constraint with SET NULL (preserves analyses when blueprints are deleted)
ALTER TABLE document_analyses
  ADD CONSTRAINT document_analyses_blueprint_id_fkey 
  FOREIGN KEY (blueprint_id) 
  REFERENCES blueprints(id) 
  ON DELETE SET NULL;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_document_analyses_blueprint_id ON document_analyses(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_document_analyses_source_filename ON document_analyses(source_filename);
CREATE INDEX IF NOT EXISTS idx_document_analyses_user_class ON document_analyses(user_id, class_id);

