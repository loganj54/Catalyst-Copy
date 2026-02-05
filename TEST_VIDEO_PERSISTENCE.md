# Video Persistence Testing Guide

## Quick Test Steps

### Test 1: Initial Video Find
1. Open a blueprint
2. Click on a learning unit to create an explainer
3. Select "Watch a Video" 
4. Wait for video to load
5. **Expected**: Video appears in explainer overlay
6. Navigate to the blueprint page (close explainer if needed)
7. **Expected**: Video should appear in the resources section for that unit
8. Refresh the page
9. **Expected**: Video still appears in resources section

### Test 2: Video Cycling (Reroll)
1. Open a blueprint with an existing video explainer
2. Click the reroll/cycle button to get next video
3. **Expected**: New video appears in explainer
4. Navigate to blueprint page
5. **Expected**: New video appears in resources section
6. Refresh the page
7. **Expected**: New video persists (not the old one)

### Test 3: Multiple Videos on Same Unit
1. Open a blueprint
2. Find a video for a unit
3. Cycle through 2-3 videos using reroll
4. Navigate to blueprint page
5. **Expected**: All cycled videos should appear in resources section
6. Refresh the page
7. **Expected**: All videos still appear

### Test 4: Database Verification
1. After finding a video, check Supabase database
2. Query `resources_from_make` table:
   ```sql
   SELECT * FROM resources_from_make 
   WHERE platform = 'youtube' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. **Expected**: Should see the video entry with correct metadata
4. Query `blueprint_topic_resources` table:
   ```sql
   SELECT * FROM blueprint_topic_resources 
   WHERE blueprint_id = 'YOUR_BLUEPRINT_ID' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
5. **Expected**: Should see entries linking videos to blueprint units

## Console Log Checks

When videos are saved, you should see these console logs:

### When Video is First Found:
```
[ExplainerBubble] Saving video to blueprint: [Video Title]
[ExplainerBubble] Created new resource with ID: [UUID]
[ExplainerBubble] Video saved successfully to blueprint: [data object]
```

### When Video Already Exists:
```
[ExplainerBubble] Saving video to blueprint: [Video Title]
[ExplainerBubble] Resource already exists with ID: [UUID]
[ExplainerBubble] Video saved successfully to blueprint: [data object]
```

### When Cycling Videos:
```
[ExplainerBubble] Saving video to blueprint: [New Video Title]
[ExplainerBubble] Created new resource with ID: [UUID]
[ExplainerBubble] Video saved successfully to blueprint: [data object]
```

## Error Scenarios to Test

### Missing Blueprint Context
1. Try to find video without proper blueprint context
2. **Expected**: Console log: "Cannot save video - missing required data"
3. Video should still work in overlay but won't persist

### Duplicate Video
1. Find same video twice for same unit
2. **Expected**: Should use existing resource, no duplicate entries
3. Check database to confirm only one entry per URL

### Network Errors
1. Disconnect internet after finding video
2. Try to cycle to next video
3. **Expected**: Graceful error handling, console error logged

## Rollback Plan

If issues occur, you can disable persistence by commenting out these lines:

**In `fetchVideos` function (around line 365):**
```javascript
// Save the first video to blueprint
// if (rankedVideosList.length > 0 && explainer.blueprintId && explainer.unitId) {
//     saveVideoToBlueprint(rankedVideosList[0]);
// }
```

**In `handleReroll` function (around line 162):**
```javascript
// Save the new video to blueprint
// const nextVideo = rankedVideos[nextIndex];
// if (explainer.blueprintId && explainer.unitId) {
//     saveVideoToBlueprint(nextVideo);
// }
```

## Success Criteria

✅ Videos found through explainer persist to blueprint page  
✅ Videos survive page refreshes  
✅ Cycled videos update on blueprint page  
✅ No duplicate entries in database  
✅ Console logs show successful saves  
✅ Blueprint resource display shows videos correctly  
✅ Video metadata (title, thumbnail, duration) displays properly  

## Known Limitations

- Videos are saved immediately when found/cycled (no "confirm" step)
- If user cycles through many videos quickly, multiple entries will be created
- Old videos are not automatically removed when cycling (by design - user might want multiple options)
- Requires valid `blueprintId` and `unitId` in explainer context
