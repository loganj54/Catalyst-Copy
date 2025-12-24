-- ============================================================================
-- FIGURES STORAGE BUCKET SETUP
-- ============================================================================
-- Sets up the Supabase storage bucket for figures/diagrams
-- ============================================================================

-- Create the figures-library bucket (public access for reading)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'figures-library',
    'figures-library',
    true,  -- Public bucket so figures can be displayed without auth
    524288,  -- 512KB max file size (0.5 MB) to keep costs down
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 524288,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Allow public read access to all figures
CREATE POLICY IF NOT EXISTS "Public read access for figures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'figures-library');

-- Allow service role to upload/manage figures
CREATE POLICY IF NOT EXISTS "Service role can upload figures"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'figures-library');

CREATE POLICY IF NOT EXISTS "Service role can update figures"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'figures-library');

CREATE POLICY IF NOT EXISTS "Service role can delete figures"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'figures-library');

-- ============================================================================
-- FOLDER STRUCTURE COMMENTS
-- ============================================================================
-- The bucket will be organized by subject area:
-- /physics/
-- /math/
-- /chemistry/
-- /engineering/
-- /general/
-- 
-- Each file will be named with a UUID to avoid conflicts:
-- /physics/550e8400-e29b-41d4-a716-446655440000.png
-- ============================================================================

