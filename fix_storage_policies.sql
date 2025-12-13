-- ============================================================================
-- FIX STORAGE POLICIES FOR class-documents BUCKET
-- ============================================================================
-- This fixes Edge Function access to uploaded documents
-- ============================================================================

-- Make sure the bucket exists and is NOT public (for privacy)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'class-documents', 
  'class-documents', 
  false,  -- Keep private, use authenticated access
  33554432,  -- 32MB limit
  ARRAY['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = 33554432,
    allowed_mime_types = ARRAY['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Drop ALL existing policies for this bucket to start fresh
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%class%' OR policyname LIKE '%document%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
    END LOOP;
END $$;

-- Policy 1: Users can upload to their own folder
CREATE POLICY "class_documents_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'class-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can read their own documents
CREATE POLICY "class_documents_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'class-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Service role (Edge Functions) can read ALL documents
CREATE POLICY "class_documents_select_service"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'class-documents');

-- Policy 4: Service role can delete documents (for cleanup after analysis)
CREATE POLICY "class_documents_delete_service"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'class-documents');

-- Policy 5: Users can delete their own documents
CREATE POLICY "class_documents_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'class-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Verify the policies were created
SELECT 
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE 'class_documents%'
ORDER BY policyname;

