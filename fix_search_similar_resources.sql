-- ============================================================================
-- FIX: Create search_similar_resources function
-- ============================================================================
-- Run this in your Supabase SQL Editor to create the missing function
-- that the search-resources edge function depends on.
-- ============================================================================

-- Enable pgvector extension (required for vector operations)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the search_similar_resources function
CREATE OR REPLACE FUNCTION search_similar_resources(
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.95,
    max_results INTEGER DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    url TEXT,
    title TEXT,
    description TEXT,
    platform TEXT,
    channel_name TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    topic_signature TEXT,
    concepts_covered TEXT[],
    difficulty_level TEXT,
    quality_score FLOAT,
    times_served INTEGER,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.id,
        cr.url,
        cr.title,
        cr.description,
        cr.platform,
        cr.channel_name,
        cr.thumbnail_url,
        cr.duration_seconds,
        cr.topic_signature,
        cr.concepts_covered,
        cr.difficulty_level,
        cr.quality_score,
        cr.times_served,
        (1 - (cr.topic_embedding <=> query_embedding))::FLOAT as similarity
    FROM curated_resources cr
    WHERE cr.topic_embedding IS NOT NULL
      AND (1 - (cr.topic_embedding <=> query_embedding)) > similarity_threshold
    ORDER BY cr.topic_embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Add a comment for documentation
COMMENT ON FUNCTION search_similar_resources IS 
    'Searches for resources with similar topic embeddings using cosine similarity';

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION search_similar_resources TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_resources TO service_role;

