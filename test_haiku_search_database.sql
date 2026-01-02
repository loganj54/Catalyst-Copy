-- Check if search_similar_resources function exists and is working
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%search%resource%';

-- Check curated_resources table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'curated_resources'
ORDER BY ordinal_position;

-- Check if topic_embedding column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'curated_resources'
AND column_name = 'topic_embedding';

-- Test the search_similar_resources function with a dummy vector
-- (This will error if the function doesn't exist or has wrong signature)
DO $$
BEGIN
  PERFORM search_similar_resources(
    query_embedding := '[0.1, 0.2, 0.3]'::vector,
    similarity_threshold := 0.95,
    max_results := 3
  );
  RAISE NOTICE 'search_similar_resources function exists and is callable';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'search_similar_resources function error: %', SQLERRM;
END $$;

