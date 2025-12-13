-- Fix RLS policies for document_analyses table
-- This allows users to read their own document analyses

-- Enable RLS if not already enabled
ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own document analyses" ON document_analyses;
DROP POLICY IF EXISTS "Users can insert their own document analyses" ON document_analyses;
DROP POLICY IF EXISTS "Users can update their own document analyses" ON document_analyses;
DROP POLICY IF EXISTS "Users can delete their own document analyses" ON document_analyses;

-- Create policies for document_analyses
CREATE POLICY "Users can view their own document analyses" 
ON document_analyses
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own document analyses" 
ON document_analyses
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own document analyses" 
ON document_analyses
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document analyses" 
ON document_analyses
FOR DELETE 
USING (auth.uid() = user_id);

-- Also allow service role to bypass RLS (for Edge Functions)
-- This is already handled by default but making it explicit
ALTER TABLE document_analyses FORCE ROW LEVEL SECURITY;

