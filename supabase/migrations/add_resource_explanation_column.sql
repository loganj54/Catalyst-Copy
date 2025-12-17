-- Add resource_explanation column to blueprint_topic_resources table
-- This stores the AI-generated contextual explanation for why each resource is helpful

ALTER TABLE blueprint_topic_resources
ADD COLUMN IF NOT EXISTS resource_explanation TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN blueprint_topic_resources.resource_explanation IS 'AI-generated explanation (2-3 sentences) describing what the resource covers and how it helps the student achieve their learning objective';

