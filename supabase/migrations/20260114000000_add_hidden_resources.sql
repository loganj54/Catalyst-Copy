-- Add is_hidden column to blueprint_topic_resources
ALTER TABLE blueprint_topic_resources 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_blueprint_topic_resources_hidden 
ON blueprint_topic_resources(is_hidden);

-- Allow users to update their own blueprint resources
-- This is necessary to allow the frontend to set is_hidden = true
CREATE POLICY "Users can update own blueprint topic resources"
    ON blueprint_topic_resources FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM blueprints 
            WHERE blueprints.id = blueprint_topic_resources.blueprint_id 
            AND blueprints.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM blueprints 
            WHERE blueprints.id = blueprint_topic_resources.blueprint_id 
            AND blueprints.user_id = auth.uid()
        )
    );
