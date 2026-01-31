-- ============================================================================
-- ADD PROBLEM_NAME TO PRACTICE PROBLEMS CACHE
-- ============================================================================
-- Adds a clever, short name field to practice problems for better UX
-- Examples: "Rocket Bounce", "Friction Frenzy", "Energy Escape"
-- ============================================================================

-- Add problem_name column (nullable for backwards compatibility)
ALTER TABLE practice_problems_cache
ADD COLUMN problem_name TEXT;

-- Add index for searching/filtering by name
CREATE INDEX idx_practice_problems_cache_name
ON practice_problems_cache(problem_name);

-- Add comment to document the column
COMMENT ON COLUMN practice_problems_cache.problem_name IS 'Clever 2-4 word name for the problem (e.g., "Rocket Bounce", "Sliding Mystery")';
