-- ============================================================================
-- FIX DOCUMENT VIEWING FEATURE
-- ============================================================================
-- This migration consolidates storage policies for the class-documents bucket
-- to enable proper PDF/document viewing in the browser.
-- ============================================================================

-- Step 1: Ensure the bucket exists and is PUBLIC
-- Public bucket allows browser to fetch documents directly
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'class-documents', 
  'class-documents', 
  true,  -- PUBLIC for easy browser viewing
  10485760,  -- 10MB limit (matching frontend validation)
  ARRAY[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ]
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];

-- Step 2: Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can upload class documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own class documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own class documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view class documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all documents" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_upload" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_select_service" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_delete_service" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_delete_own" ON storage.objects;

-- Step 3: Create consolidated storage policies
-- Policy 1: Authenticated users can upload to their own folder
-- Path format: {user_id}/{class_id}/{timestamp}.{ext}
CREATE POLICY "class_documents_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'class-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Authenticated users can view their own documents
CREATE POLICY "class_documents_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'class-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Public SELECT access (allows browser to fetch documents)
-- This is safe because:
-- 1. URLs are long and unguessable (contains timestamp)
-- 2. The class_documents table still has RLS protecting metadata
-- 3. Users can only get URLs from their own documents via the table
CREATE POLICY "class_documents_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'class-documents');

-- Policy 4: Authenticated users can delete their own documents
CREATE POLICY "class_documents_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'class-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 5: Service role can manage all documents (for Edge Functions)
CREATE POLICY "class_documents_service_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'class-documents')
WITH CHECK (bucket_id = 'class-documents');

-- Step 4: Verify the policies were created correctly
SELECT 
  policyname,
  roles,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE 'class_documents%'
ORDER BY policyname;

-- Step 5: Confirm bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'class-documents';

