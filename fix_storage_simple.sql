-- SIMPLE FIX FOR VIEWING DOCUMENTS
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Create a policy to allow viewing files in the bucket
-- We use DO block to avoid errors if policy already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Public View Access'
    ) THEN
        CREATE POLICY "Public View Access"
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'class-documents' );
    END IF;
END
$$;

