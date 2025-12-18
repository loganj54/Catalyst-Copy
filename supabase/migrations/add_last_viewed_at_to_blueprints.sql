
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Backfill existing records with created_at if last_viewed_at is null
UPDATE blueprints SET last_viewed_at = created_at WHERE last_viewed_at IS NULL;

