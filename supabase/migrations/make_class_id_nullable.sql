-- Make class_id nullable in class_documents table
-- This allows documents to exist without being associated with a specific class
-- Needed for "unorganized" blueprints that don't belong to a class

ALTER TABLE class_documents 
ALTER COLUMN class_id DROP NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN class_documents.class_id IS 'Optional reference to a class. Can be NULL for unorganized documents.';
