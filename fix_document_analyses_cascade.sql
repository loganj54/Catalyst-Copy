-- ============================================================================
-- FIX DOCUMENT ANALYSES CASCADE DELETE
-- ============================================================================
-- 
-- PROBLEM: When deleting blueprints, document_analyses were being deleted too
-- due to ON DELETE CASCADE on the blueprint_id foreign key.
--
-- SOLUTION: Change the foreign key constraint to SET NULL instead of CASCADE.
-- This preserves the analysis in the database even if the blueprint is deleted.
-- The analysis can still be found by filename, class_id, or user_id.
--
-- ============================================================================

-- First, we need to drop the existing foreign key constraint if it exists
-- We'll need to find out what it's called first, then drop it

-- Step 1: Make blueprint_id nullable (if it isn't already)
ALTER TABLE document_analyses 
  ALTER COLUMN blueprint_id DROP NOT NULL;

-- Step 2: Drop the existing foreign key constraint
-- Note: The constraint name might vary. Common patterns are:
-- - document_analyses_blueprint_id_fkey
-- - fk_document_analyses_blueprint_id
-- You may need to check your database to find the exact name

-- Try common constraint names:
DO $$ 
BEGIN
  -- Try to drop the constraint if it exists
  ALTER TABLE document_analyses 
    DROP CONSTRAINT IF EXISTS document_analyses_blueprint_id_fkey;
  
  ALTER TABLE document_analyses 
    DROP CONSTRAINT IF EXISTS fk_document_analyses_blueprint_id;
    
  ALTER TABLE document_analyses 
    DROP CONSTRAINT IF EXISTS document_analyses_blueprint_id_fk;
END $$;

-- Step 3: Add the new foreign key constraint with SET NULL behavior
-- This means when a blueprint is deleted, the blueprint_id in document_analyses
-- will be set to NULL instead of deleting the entire analysis record
ALTER TABLE document_analyses
  ADD CONSTRAINT document_analyses_blueprint_id_fkey 
  FOREIGN KEY (blueprint_id) 
  REFERENCES blueprints(id) 
  ON DELETE SET NULL;

-- Step 4: Add an index on blueprint_id for performance (if not already present)
CREATE INDEX IF NOT EXISTS idx_document_analyses_blueprint_id 
  ON document_analyses(blueprint_id);

-- Step 5: Add indexes on other commonly queried fields for finding orphaned analyses
CREATE INDEX IF NOT EXISTS idx_document_analyses_source_filename 
  ON document_analyses(source_filename);

CREATE INDEX IF NOT EXISTS idx_document_analyses_user_class 
  ON document_analyses(user_id, class_id);

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm the fix worked)
-- ============================================================================

-- Check the constraint definition:
-- SELECT 
--   conname AS constraint_name,
--   contype AS constraint_type,
--   pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'document_analyses'::regclass
--   AND conname LIKE '%blueprint%';

-- Test query: Find analyses that no longer have an associated blueprint
-- SELECT COUNT(*) 
-- FROM document_analyses 
-- WHERE blueprint_id IS NULL;

