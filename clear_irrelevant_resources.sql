-- Clear out irrelevant resources that keep showing up
-- These are resources that were incorrectly linked to topics

-- Delete the specific irrelevant resources from junction table
DELETE FROM blueprint_topic_resources
WHERE resource_id IN (
  SELECT id FROM curated_resources 
  WHERE title LIKE '%Undefined%Beauty%'
     OR title LIKE '%GED Math%Undefined%'
     OR title LIKE '%Null vs Undefined in JavaScript%'
     OR title LIKE '%skincare%'
     OR url LIKE '%vDy3dLTAjaE%' -- 0 vs Null vs Undefined video
     OR url LIKE '%fj0ILsyCw54%' -- GED Math video
     OR url LIKE '%uu1CPSziy4c%' -- Beauty video
);

-- Optionally delete these resources entirely from curated_resources
-- (they'll never be relevant to engineering topics)
DELETE FROM curated_resources
WHERE title LIKE '%Undefined%Beauty%'
   OR title LIKE '%GED Math%Undefined%'
   OR title LIKE '%Null vs Undefined in JavaScript%'
   OR title LIKE '%skincare%'
   OR url LIKE '%vDy3dLTAjaE%'
   OR url LIKE '%fj0ILsyCw54%'
   OR url LIKE '%uu1CPSziy4c%';

-- Check what we deleted
SELECT 
  'Deleted' as status,
  COUNT(*) as count
FROM curated_resources
WHERE id NOT IN (SELECT id FROM curated_resources);

-- Show remaining resources count
SELECT 
  platform,
  COUNT(*) as resource_count
FROM curated_resources
GROUP BY platform;

