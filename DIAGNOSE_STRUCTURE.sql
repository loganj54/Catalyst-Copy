-- Diagnose why structure isn't rendering in UI

-- 1. Check if structures exist
SELECT 
  id,
  blueprint_id,
  created_at,
  total_sections,
  total_learning_units,
  CASE 
    WHEN structure IS NULL THEN '❌ NULL'
    WHEN jsonb_typeof(structure) = 'object' THEN '✅ Valid Object'
    ELSE '⚠️  Invalid Type'
  END as structure_status
FROM blueprint_structures
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check structure content for most recent
SELECT 
  id,
  blueprint_id,
  -- Check if structure has required fields
  structure ? 'content_sections' as has_content_sections,
  structure ? 'prerequisites_section' as has_prerequisites,
  structure ? 'summary' as has_summary,
  -- Count sections
  jsonb_array_length(structure->'content_sections') as num_content_sections,
  -- Check first section
  structure->'content_sections'->0->>'section_id' as first_section_id,
  structure->'content_sections'->0->>'title' as first_section_title,
  structure->'content_sections'->0 ? 'learning_units' as first_section_has_units,
  jsonb_array_length(structure->'content_sections'->0->'learning_units') as first_section_unit_count
FROM blueprint_structures
ORDER BY created_at DESC
LIMIT 1;

-- 3. Show first learning unit structure
SELECT 
  blueprint_id,
  structure->'content_sections'->0->'learning_units'->0 as first_learning_unit
FROM blueprint_structures
ORDER BY created_at DESC
LIMIT 1;

-- 4. Check if learning units have required fields
SELECT 
  blueprint_id,
  structure->'content_sections'->0->'learning_units'->0 ? 'unit_id' as has_unit_id,
  structure->'content_sections'->0->'learning_units'->0 ? 'topic' as has_topic,
  structure->'content_sections'->0->'learning_units'->0 ? 'search_queries' as has_search_queries,
  structure->'content_sections'->0->'learning_units'->0->>'unit_id' as unit_id,
  structure->'content_sections'->0->'learning_units'->0->>'topic' as topic
FROM blueprint_structures
ORDER BY created_at DESC
LIMIT 1;

