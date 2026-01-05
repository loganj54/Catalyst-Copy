-- Check what's actually in the structure for this blueprint
SELECT 
  id,
  blueprint_id,
  -- Show the top-level keys in the structure
  jsonb_object_keys(structure) as structure_keys
FROM blueprint_structures
WHERE blueprint_id = '5ced0531-3b5c-4786-8d20-53e49366d26c';

-- Show the full structure (pretty printed)
SELECT 
  jsonb_pretty(structure) as full_structure
FROM blueprint_structures
WHERE blueprint_id = '5ced0531-3b5c-4786-8d20-53e49366d26c'
LIMIT 1;

-- Check if it's nested under 'learning_structure'
SELECT 
  structure ? 'learning_structure' as has_learning_structure_key,
  structure ? 'content_sections' as has_content_sections_key,
  structure->'learning_structure' ? 'content_sections' as nested_has_content_sections
FROM blueprint_structures
WHERE blueprint_id = '5ced0531-3b5c-4786-8d20-53e49366d26c';

