-- Clear all bad blueprint structures that need to be regenerated
-- Run this in your Supabase SQL Editor

-- Delete the specific blueprint structure causing issues
DELETE FROM blueprint_structures 
WHERE blueprint_id IN (
  '84763d6e-0be5-4f86-b00c-9fef6bfc6b10',
  'a02c8e1c-4508-4923-a698-a5e7d24e349d'
);

-- Note: blueprint_structure_cache table doesn't exist yet, so skipping that

-- Verify deletion
SELECT 
  bp.id,
  bp.title,
  bs.id as structure_id
FROM blueprints bp
LEFT JOIN blueprint_structures bs ON bs.blueprint_id = bp.id
WHERE bp.id IN (
  '84763d6e-0be5-4f86-b00c-9fef6bfc6b10',
  'a02c8e1c-4508-4923-a698-a5e7d24e349d'
);

-- Should show NULL for structure_id if deletion was successful

