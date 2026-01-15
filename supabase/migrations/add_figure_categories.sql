-- ============================================================================
-- ADD FIGURE CATEGORIES MIGRATION
-- ============================================================================
-- Extends curated_figures to support both embedded images and external links
-- Images: Downloaded and stored in Supabase (e.g., Moody Diagram)
-- Links: External URLs only (e.g., Steam Tables on Engineering Toolbox)
-- ============================================================================

-- Add figure category column ('image' or 'link')
ALTER TABLE curated_figures 
ADD COLUMN IF NOT EXISTS figure_category TEXT DEFAULT 'image' 
CHECK (figure_category IN ('image', 'link'));

-- For 'link' category, store the external URL
ALTER TABLE curated_figures 
ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Search terms used to find this figure (for cache matching)
ALTER TABLE curated_figures 
ADD COLUMN IF NOT EXISTS search_terms TEXT[];

-- Source website name for external links (e.g., "Engineering Toolbox")
ALTER TABLE curated_figures 
ADD COLUMN IF NOT EXISTS source_website TEXT;

-- Make file_url nullable for link-type figures
-- First check if it has a NOT NULL constraint
DO $$
BEGIN
  ALTER TABLE curated_figures ALTER COLUMN file_url DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    -- Column might already be nullable, ignore error
    NULL;
END $$;

-- Index for fast text search on name (case-insensitive via lower)
CREATE INDEX IF NOT EXISTS idx_curated_figures_name_lower 
ON curated_figures(LOWER(name));

-- Index for search terms array (GIN for array containment queries)
CREATE INDEX IF NOT EXISTS idx_curated_figures_search_terms 
ON curated_figures USING GIN(search_terms);

-- Index for figure category
CREATE INDEX IF NOT EXISTS idx_curated_figures_category
ON curated_figures(figure_category);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN curated_figures.figure_category IS 
  'image = downloaded and stored in Supabase Storage, link = external URL only';

COMMENT ON COLUMN curated_figures.external_url IS 
  'For link category: URL to external resource (Engineering Toolbox, Wikipedia, NIST, etc.)';

COMMENT ON COLUMN curated_figures.search_terms IS 
  'Array of search terms that match this figure (used for cache lookup)';

COMMENT ON COLUMN curated_figures.source_website IS 
  'Human-readable name of external link source for display (e.g., "Engineering Toolbox")';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show the updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'curated_figures'
ORDER BY ordinal_position;
