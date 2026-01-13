-- ============================================================================
-- ADD DOCUMENT TYPE TO CLASS_DOCUMENTS
-- ============================================================================
-- Stores the classification of documents (lecture, problem_set, etc.)
-- This enables filtering Related Course Material to show only educational content.
-- ============================================================================

-- Add the column
ALTER TABLE class_documents 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT NULL;

-- Add a comment explaining the values
COMMENT ON COLUMN class_documents.document_type IS 
'Document classification: lecture, textbook, study_guide, problem_set, hybrid. Set by analyze-document function.';

-- Backfill existing documents from document_analyses if available
UPDATE class_documents cd
SET document_type = (da.raw_analysis->>'document_type')
FROM document_analyses da
WHERE cd.id = da.document_id
  AND cd.document_type IS NULL
  AND da.raw_analysis->>'document_type' IS NOT NULL;
