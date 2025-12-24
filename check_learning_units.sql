-- Check learning units in blueprint structure
-- Replace the blueprint_id with your actual blueprint ID

SELECT 
  bs.id as structure_id,
  bs.blueprint_id,
  bs.created_at,
  bs.from_cache,
  bs.cache_source_id,
  bs.total_sections,
  bs.total_learning_units as reported_unit_count,
  
  -- Check actual structure
  jsonb_array_length(bs.structure->'content_sections') as actual_num_sections,
  
  -- Check first section
  bs.structure->'content_sections'->0->>'title' as first_section_title,
  jsonb_array_length(bs.structure->'content_sections'->0->'learning_units') as first_section_unit_count,
  
  -- Show first learning unit if it exists
  bs.structure->'content_sections'->0->'learning_units'->0->>'title' as first_unit_title,
  bs.structure->'content_sections'->0->'learning_units'->0->>'unit_id' as first_unit_id,
  
  -- Check prerequisites
  jsonb_array_length(bs.structure->'prerequisites_section'->'learning_units') as prereq_unit_count,
  
  -- Show all section titles and their unit counts
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'section_id', section->>'section_id',
        'title', section->>'title',
        'unit_count', jsonb_array_length(section->'learning_units')
      )
    )
    FROM jsonb_array_elements(bs.structure->'content_sections') as section
  ) as all_sections_summary

FROM blueprint_structures bs
WHERE bs.blueprint_id = '0d2c19db-47cf-4c19-b4ba-f24c4cd223dd'
ORDER BY bs.created_at DESC
LIMIT 1;

