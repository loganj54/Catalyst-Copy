-- ============================================================================
-- Add Enhanced Video Metadata Columns
-- ============================================================================
-- This migration adds new columns to resources_from_make table to support
-- enhanced video categorization and intelligent search matching.
--
-- Changes:
-- - difficulty_level: beginner/intermediate/advanced classification
-- - problem_types_solved: Array of specific problem types demonstrated
-- - equations_used: Array of equations/formulas used in the video
-- - tools_demonstrated: Array of software/tools shown (MATLAB, Excel, etc.)
-- - pacing: How the content is delivered (quick_review/thorough/deep_dive)
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add new metadata columns
ALTER TABLE resources_from_make
ADD COLUMN IF NOT EXISTS difficulty_level TEXT,
ADD COLUMN IF NOT EXISTS problem_types_solved TEXT[],
ADD COLUMN IF NOT EXISTS equations_used TEXT[],
ADD COLUMN IF NOT EXISTS tools_demonstrated TEXT[],
ADD COLUMN IF NOT EXISTS pacing TEXT;

-- Add indexes for efficient filtering on array columns
CREATE INDEX IF NOT EXISTS idx_resources_problem_types
ON resources_from_make USING GIN (problem_types_solved);

CREATE INDEX IF NOT EXISTS idx_resources_equations
ON resources_from_make USING GIN (equations_used);

CREATE INDEX IF NOT EXISTS idx_resources_tools
ON resources_from_make USING GIN (tools_demonstrated);

-- Add comment documentation
COMMENT ON COLUMN resources_from_make.difficulty_level IS 'Video difficulty: beginner, intermediate, or advanced';
COMMENT ON COLUMN resources_from_make.problem_types_solved IS 'Array of specific problem types demonstrated in video';
COMMENT ON COLUMN resources_from_make.equations_used IS 'Array of equations/formulas used or derived in video';
COMMENT ON COLUMN resources_from_make.tools_demonstrated IS 'Array of software/tools demonstrated (MATLAB, Excel, etc.)';
COMMENT ON COLUMN resources_from_make.pacing IS 'Content delivery speed: quick_review, thorough, or deep_dive';

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'resources_from_make'
  AND column_name IN ('difficulty_level', 'problem_types_solved', 'equations_used', 'tools_demonstrated', 'pacing')
ORDER BY column_name;
