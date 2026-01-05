-- Check if walkthrough units are being generated

-- 1. Check total units and their types
SELECT 
  blueprint_id,
  jsonb_array_length(structure->'learning_structure'->'content_sections') as num_sections,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(structure->'learning_structure'->'content_sections') as section,
         jsonb_array_elements(section->'learning_units') as unit
    WHERE unit->>'unit_type' = 'walkthrough'
  ) as walkthrough_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(structure->'learning_structure'->'content_sections') as section,
         jsonb_array_elements(section->'learning_units') as unit
  ) as total_units
FROM blueprint_structures
WHERE blueprint_id = '5ced0531-3b5c-4786-8d20-53e49366d26c';

-- 2. Show all unit types in first section
SELECT 
  unit->>'unit_id' as unit_id,
  unit->>'unit_type' as unit_type,
  unit->>'topic' as topic
FROM blueprint_structures,
     jsonb_array_elements(structure->'learning_structure'->'content_sections'->0->'learning_units') as unit
WHERE blueprint_id = '5ced0531-3b5c-4786-8d20-53e49366d26c';

-- 3. Check if any section has a walkthrough unit
SELECT 
  section->>'section_id' as section_id,
  section->>'title' as section_title,
  jsonb_array_length(section->'learning_units') as num_units,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(section->'learning_units') as unit
    WHERE unit->>'unit_type' = 'walkthrough'
  ) as walkthrough_count,
  -- Show last unit type (should be walkthrough for problems)
  (section->'learning_units'->-1)->>'unit_type' as last_unit_type,
  (section->'learning_units'->-1)->>'topic' as last_unit_topic
FROM blueprint_structures,
     jsonb_array_elements(structure->'learning_structure'->'content_sections') as section
WHERE blueprint_id = '5ced0531-3b5c-4786-8d20-53e49366d26c';

