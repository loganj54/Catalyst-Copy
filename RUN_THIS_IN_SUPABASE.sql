-- ============================================================================
-- MIGRATION: Make class_id nullable in class_documents table
-- ============================================================================
-- Purpose: Allow documents to exist without being associated with a specific class
-- This is needed for "unorganized" blueprints that don't belong to a class
-- 
-- Instructions:
-- 1. Go to your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Select your project
-- 3. Navigate to SQL Editor (left sidebar)
-- 4. Click "New Query"
-- 5. Copy and paste this entire script
-- 6. Click "Run" to execute
-- ============================================================================

-- Make class_id nullable
ALTER TABLE class_documents 
ALTER COLUMN class_id DROP NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN class_documents.class_id IS 'Optional reference to a class. Can be NULL for unorganized documents.';

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'class_documents' 
  AND column_name = 'class_id';

-- Expected result: is_nullable should be 'YES'
-- If you see 'YES', the migration was successful!
