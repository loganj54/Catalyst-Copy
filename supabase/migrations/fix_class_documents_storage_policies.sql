-- ============================================================================
-- STORAGE POLICIES FOR class-documents BUCKET
-- ============================================================================
-- Run this in your Supabase SQL Editor to set up proper access policies
-- ============================================================================

-- First, ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('class-documents', 'class-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view class documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all documents" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files to their own folder
-- Path format: user_id/class_id/filename
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'class-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow users to view their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'class-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'class-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow public read access (since bucket is public)
-- This allows the edge function to fetch files via public URL
CREATE POLICY "Public can view class documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'class-documents');

-- Policy 5: Allow service role full access (for edge functions)
CREATE POLICY "Service role can manage all documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'class-documents')
WITH CHECK (bucket_id = 'class-documents');

