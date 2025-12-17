-- Add is_problem_walkthrough column to blueprint_topic_resources table
-- This tracks whether resources are problem walkthrough videos vs concept explanation videos

ALTER TABLE blueprint_topic_resources
ADD COLUMN IF NOT EXISTS is_problem_walkthrough BOOLEAN DEFAULT false;

-- Add a comment to document the column
COMMENT ON COLUMN blueprint_topic_resources.is_problem_walkthrough IS 'Indicates whether this resource is a problem walkthrough video (true) or a concept explanation video (false)';

-- Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_walkthrough 
ON blueprint_topic_resources(blueprint_id, is_problem_walkthrough);

