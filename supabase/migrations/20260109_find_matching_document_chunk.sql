-- ============================================================================
-- FIND MATCHING DOCUMENT CHUNK RPC
-- ============================================================================
-- Allows searching for similar content across ALL of a user's documents.
-- Used for the "Copy-Paste Caching" feature to find if this content exists
-- in a previously uploaded document.
-- ============================================================================

CREATE OR REPLACE FUNCTION find_matching_document_chunk(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (postgres) to bypass strict RLS if needed, but we filter by user_id manually below
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  JOIN class_documents cd ON dc.document_id = cd.id
  WHERE 
    cd.user_id = p_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
