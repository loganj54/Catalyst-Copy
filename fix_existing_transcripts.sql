-- ============================================================================
-- FIX EXISTING TRANSCRIPTS IN JSON ARRAY FORMAT
-- ============================================================================
-- This migration converts transcripts stored as JSON arrays to plain text
-- 
-- IMPORTANT: This is a data migration. Test on a small batch first!
-- ============================================================================

-- Step 1: Create a backup table (optional but recommended)
CREATE TABLE IF NOT EXISTS resources_from_make_backup_transcripts AS
SELECT id, transcript, updated_at
FROM resources_from_make
WHERE transcript LIKE '[{%' OR transcript LIKE '{"text":%';

-- Step 2: Create a function to parse JSON transcript arrays
CREATE OR REPLACE FUNCTION parse_transcript_array(json_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_text TEXT := '';
  segment JSONB;
BEGIN
  -- Check if it's a JSON array
  IF json_text LIKE '[{%' THEN
    -- Parse each segment and extract the 'text' field
    FOR segment IN SELECT * FROM jsonb_array_elements(json_text::jsonb)
    LOOP
      IF segment ? 'text' THEN
        parsed_text := parsed_text || ' ' || (segment->>'text');
      END IF;
    END LOOP;
    
    -- Clean up extra spaces
    parsed_text := TRIM(REGEXP_REPLACE(parsed_text, '\s+', ' ', 'g'));
    
    RETURN parsed_text;
  ELSE
    -- Return as-is if not a JSON array
    RETURN json_text;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If parsing fails, return original text
    RETURN json_text;
END;
$$;

-- Step 3: Show what will be updated (DRY RUN - review this first!)
SELECT 
  id,
  title,
  LEFT(transcript, 100) as old_transcript_preview,
  LEFT(parse_transcript_array(transcript), 100) as new_transcript_preview,
  LENGTH(transcript) as old_length,
  LENGTH(parse_transcript_array(transcript)) as new_length
FROM resources_from_make
WHERE transcript LIKE '[{%' OR transcript LIKE '{"text":%'
LIMIT 10;

-- Step 4: UNCOMMENT THE FOLLOWING TO ACTUALLY UPDATE THE DATA
-- WARNING: This will modify your database!
/*
UPDATE resources_from_make
SET 
  transcript = parse_transcript_array(transcript),
  updated_at = NOW()
WHERE transcript LIKE '[{%' OR transcript LIKE '{"text":%';
*/

-- Step 5: Verify the update worked
/*
SELECT 
  id,
  title,
  CASE 
    WHEN transcript LIKE '[{%' THEN 'Still JSON (failed)'
    ELSE 'Plain text (success)'
  END as format_check,
  LEFT(transcript, 200) as transcript_preview
FROM resources_from_make
WHERE id IN (
  SELECT id FROM resources_from_make_backup_transcripts
)
LIMIT 10;
*/

-- Step 6: Drop the helper function after migration is complete
-- DROP FUNCTION IF EXISTS parse_transcript_array(TEXT);

-- Step 7: Drop the backup table after verifying everything works
-- DROP TABLE IF EXISTS resources_from_make_backup_transcripts;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 1. Run Step 3 (DRY RUN) to see what will be changed
-- 2. Review the preview to ensure parsing looks correct
-- 3. Uncomment Step 4 to perform the actual update
-- 4. Run Step 5 to verify the update worked
-- 5. Run Step 6 to clean up the helper function
-- 6. Run Step 7 to remove the backup table (after confirming success)
-- ============================================================================

