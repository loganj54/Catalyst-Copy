-- ============================================================================
-- CREATE CLASS DOCUMENTS BUCKET - SIMPLE VERSION
-- ============================================================================
-- Run this AFTER creating the bucket manually in Supabase UI
-- OR this will attempt to create it via SQL
-- ============================================================================

-- Step 1: Create the bucket (if it doesn't exist)
-- NOTE: If this fails, create the bucket manually in Supabase UI:
--   Storage → New Bucket → Name: "class-documents" → Public: YES
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'class-documents', 
        'class-documents', 
        true,
        10485760,  -- 10MB
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create bucket via SQL. Please create it manually in Supabase UI.';
        RAISE NOTICE 'Go to Storage → New Bucket → Name: class-documents → Public: YES';
END $$;

-- Step 2: Drop ALL existing policies for class-documents to start fresh
DROP POLICY IF EXISTS "Users can upload class documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own class documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own class documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view class documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all documents" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_upload" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_select_service" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_delete_service" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_select_public" ON storage.objects;
DROP POLICY IF EXISTS "class_documents_service_all" ON storage.objects;

-- Step 3: Create the storage policies
-- Policy 1: Authenticated users can upload to their own folder
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
-- This is SAFE because:
-- 1. URLs contain UUIDs and timestamps (unguessable)
-- 2. class_documents table RLS prevents users from seeing others' URLs
-- 3. Only way to get a URL is through the table (which checks ownership)
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

-- Policy 5: Service role (Edge Functions) can manage all documents
CREATE POLICY "class_documents_service_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'class-documents')
WITH CHECK (bucket_id = 'class-documents');

-- Step 4: Verify everything is set up correctly
SELECT 
  '✅ Bucket Configuration' as check_type,
  id as bucket_name,
  CASE WHEN public THEN '✅ Public' ELSE '❌ Private (should be Public!)' END as public_status,
  file_size_limit || ' bytes (' || (file_size_limit / 1024 / 1024) || ' MB)' as size_limit
FROM storage.buckets
WHERE id = 'class-documents';

SELECT 
  '✅ Storage Policies' as check_type,
  policyname as policy_name,
  cmd as operation,
  CASE 
    WHEN roles::text LIKE '%authenticated%' THEN 'authenticated'
    WHEN roles::text LIKE '%service_role%' THEN 'service_role'
    WHEN roles::text LIKE '%public%' THEN 'public'
    ELSE roles::text
  END as applies_to
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE 'class_documents%'
ORDER BY policyname;

