-- ============================================================================
-- TRANSCRIPT ANALYSIS MIGRATION
-- ============================================================================
-- Adds columns for storing video transcripts and deep content analysis
-- to enable precise semantic matching between student needs and resources.
-- ============================================================================

-- Add transcript storage and analysis columns to curated_resources
ALTER TABLE curated_resources 
  ADD COLUMN IF NOT EXISTS transcript_text TEXT,
  ADD COLUMN IF NOT EXISTS transcript_analyzed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcript_source TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS content_analysis JSONB,
  ADD COLUMN IF NOT EXISTS analysis_confidence FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Add check constraint for transcript_source values
-- Values: 'auto_generated', 'manual', 'metadata_only', 'failed', 'none'
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curated_resources_transcript_source_check'
  ) THEN
    ALTER TABLE curated_resources 
      ADD CONSTRAINT curated_resources_transcript_source_check 
      CHECK (transcript_source IN ('auto_generated', 'manual', 'metadata_only', 'failed', 'none'));
  END IF;
END $$;

-- Add index for finding unanalyzed resources (for batch processing later)
CREATE INDEX IF NOT EXISTS idx_curated_resources_not_analyzed 
  ON curated_resources(transcript_analyzed) 
  WHERE transcript_analyzed = false;

-- Add index for analysis confidence (to prioritize high-confidence matches)
CREATE INDEX IF NOT EXISTS idx_curated_resources_confidence 
  ON curated_resources(analysis_confidence DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN curated_resources.transcript_text IS 
  'Full transcript text from the video (auto-generated or manual captions)';

COMMENT ON COLUMN curated_resources.transcript_analyzed IS 
  'Whether this resource has been analyzed by GPT-5-nano';

COMMENT ON COLUMN curated_resources.transcript_source IS 
  'Source of transcript: auto_generated, manual, metadata_only (no transcript), failed, none';

COMMENT ON COLUMN curated_resources.content_analysis IS 
  'JSONB containing detailed analysis: detailed_summary, concepts_taught, prerequisites_assumed, difficulty_assessment, formulas_covered, problem_types, teaching_style';

COMMENT ON COLUMN curated_resources.analysis_confidence IS 
  'Confidence score 0-1: 1.0 for full transcript analysis, 0.5 for metadata-only analysis';

COMMENT ON COLUMN curated_resources.analyzed_at IS 
  'Timestamp when the content analysis was performed';

