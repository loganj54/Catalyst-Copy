-- ============================================================================
-- CLASS-WIDE RAG SEARCH FUNCTION
-- ============================================================================
-- Allows searching for content across ALL documents in a specific class.
-- Returns the document name along with the content for citation.
-- Supports optional filtering by document_type to show only lecture-type content.
-- ============================================================================

CREATE OR REPLACE FUNCTION match_class_document_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    p_class_id uuid,
    p_document_types text[] DEFAULT NULL  -- Optional: ['lecture', 'textbook', 'study_guide']
)
RETURNS TABLE (
    document_id uuid,
    document_name text,
    content text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.document_id,
        cd.name as document_name,
        dc.content,
        1 - (dc.embedding <=> query_embedding) as similarity
    FROM document_chunks dc
    JOIN class_documents cd ON dc.document_id = cd.id
    WHERE
        cd.class_id = p_class_id
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
        -- Filter by document type if specified
        AND (p_document_types IS NULL OR cd.document_type = ANY(p_document_types))
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
