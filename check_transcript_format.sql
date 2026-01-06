-- ============================================================================
-- CHECK TRANSCRIPT FORMAT IN DATABASE
-- ============================================================================
-- This query identifies resources that have transcripts in JSON array format
-- (the problematic format) vs plain text format (the correct format)
-- ============================================================================

-- Check for transcripts that start with '[{' (JSON array format)
SELECT 
  id,
  title,
  created_at,
  CASE 
    WHEN transcript IS NULL THEN 'NULL'
    WHEN transcript LIKE '[{%' THEN 'JSON_ARRAY (needs fixing)'
    WHEN transcript LIKE '{%' THEN 'JSON_OBJECT (needs fixing)'
    WHEN LENGTH(transcript) < 100 THEN 'TOO_SHORT'
    ELSE 'PLAIN_TEXT (correct)'
  END as transcript_format,
  LENGTH(transcript) as transcript_length,
  LEFT(transcript, 100) as transcript_preview
FROM resources_from_make
ORDER BY created_at DESC
LIMIT 20;

-- Summary statistics
SELECT 
  CASE 
    WHEN transcript IS NULL THEN 'NULL'
    WHEN transcript LIKE '[{%' THEN 'JSON_ARRAY (needs fixing)'
    WHEN transcript LIKE '{%' THEN 'JSON_OBJECT (needs fixing)'
    WHEN LENGTH(transcript) < 100 THEN 'TOO_SHORT'
    ELSE 'PLAIN_TEXT (correct)'
  END as transcript_format,
  COUNT(*) as count,
  ROUND(AVG(LENGTH(transcript))) as avg_length
FROM resources_from_make
GROUP BY transcript_format
ORDER BY count DESC;

-- Find resources with problematic transcripts that need re-processing
SELECT 
  id,
  url,
  title,
  created_at,
  LEFT(transcript, 200) as transcript_preview
FROM resources_from_make
WHERE transcript LIKE '[{%'
   OR transcript LIKE '{"text":%'
ORDER BY created_at DESC;

