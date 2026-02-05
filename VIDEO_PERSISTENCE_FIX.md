# Video Persistence to Blueprint - Implementation Summary

## Problem
Videos found through the explainer overlay were not persisting to the main blueprint page. When users closed and reopened the blueprint, previously found videos would disappear.

## Root Cause
The `ExplainerOverlay` component was saving video data to `explainer.cachedVideoData` within the explainer's state (stored in `blueprint_explainers` table), but this data was **not** being transferred to the `blueprint_topic_resources` table, which is what the `Blueprint.jsx` component uses to display resources on the main blueprint page.

## Solution
Added a new function `saveVideoToBlueprint` to the `ExplainerOverlay` component that:

1. **Inserts the video into `resources_from_make` table** (or retrieves existing resource if URL already exists)
2. **Links the resource to the blueprint** by inserting into `blueprint_topic_resources` table

This ensures videos are persisted in the same way as other resources and will appear on the blueprint page across sessions.

## Changes Made

### File: `src/components/ExplainerOverlay.jsx`

#### 1. Added `saveVideoToBlueprint` Function (Lines ~44-103)

```javascript
const saveVideoToBlueprint = React.useCallback(async (video) => {
    if (!video || !explainer.blueprintId || !explainer.unitId) {
        console.log('[ExplainerBubble] Cannot save video - missing required data');
        return;
    }

    try {
        console.log(`[ExplainerBubble] Saving video to blueprint: ${video.title}`);
        
        // Step 1: Insert or get existing resource from resources_from_make
        const { data: existingResource } = await supabase
            .from('resources_from_make')
            .select('id')
            .eq('url', video.url)
            .maybeSingle();

        let resourceId;

        if (existingResource) {
            resourceId = existingResource.id;
        } else {
            // Insert new resource
            const { data: newResource, error: insertError } = await supabase
                .from('resources_from_make')
                .insert({
                    url: video.url,
                    title: video.title,
                    description: video.description || '',
                    platform: 'youtube',
                    channel_name: video.channelName || video.channel_name || '',
                    thumbnail_url: video.thumbnailUrl || video.thumbnail_url || '',
                    duration_seconds: video.duration || 0,
                    resource_type: 'video',
                    summary: video.summary || '',
                    original_search_query: selectedQuery || explainer.text || ''
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('[ExplainerBubble] Failed to insert resource:', insertError);
                return;
            }

            resourceId = newResource.id;
        }

        // Step 2: Insert into blueprint_topic_resources (upsert to avoid duplicates)
        const { data, error } = await supabase
            .from('blueprint_topic_resources')
            .upsert({
                blueprint_id: explainer.blueprintId,
                unit_id: explainer.unitId,
                resource_id: resourceId,
                relevance_score: video.profile_match_score || 0.8,
                from_cache: false,
                resource_explanation: video.quality_reasoning || 'Video found through explainer overlay'
            }, {
                onConflict: 'blueprint_id,unit_id,resource_id'
            })
            .select()
            .single();

        if (error) {
            console.error('[ExplainerBubble] Failed to save to blueprint_topic_resources:', error);
        } else {
            console.log('[ExplainerBubble] Video saved successfully to blueprint:', data);
        }
    } catch (err) {
        console.error('[ExplainerBubble] Error saving video to blueprint:', err);
    }
}, [explainer.blueprintId, explainer.unitId, selectedQuery, explainer.text]);
```

#### 2. Updated `fetchVideos` Function (Line ~365)

Added call to `saveVideoToBlueprint` after videos are found:

```javascript
// Save the first video to blueprint
if (rankedVideosList.length > 0 && explainer.blueprintId && explainer.unitId) {
    saveVideoToBlueprint(rankedVideosList[0]);
}
```

#### 3. Updated `handleReroll` Function (Line ~79)

Added call to `saveVideoToBlueprint` when cycling to a new video:

```javascript
const handleReroll = (e) => {
    e.stopPropagation();
    if (rankedVideos.length <= 1) return;

    setIsRerolling(true);
    const nextIndex = (currentVideoIndex + 1) % rankedVideos.length;
    setCurrentVideoIndex(nextIndex);

    // Save the new video to blueprint
    const nextVideo = rankedVideos[nextIndex];
    if (explainer.blueprintId && explainer.unitId) {
        saveVideoToBlueprint(nextVideo);
    }

    // ... rest of function
};
```

## How It Works

### When a Video is First Found:
1. User clicks "Find Video" in explainer overlay
2. `fetchVideos` calls `find-videos-sandbox` function
3. Videos are ranked and returned
4. **NEW:** First video is saved to `resources_from_make` and `blueprint_topic_resources`
5. Video data is also cached in explainer state for overlay display

### When User Cycles Through Videos:
1. User clicks the reroll button
2. `handleReroll` increments to next video in ranked list
3. **NEW:** New video is saved to `resources_from_make` and `blueprint_topic_resources`
4. Video index is updated in explainer state

### When User Reopens Blueprint:
1. `Blueprint.jsx` loads data from `blueprint_topic_resources`
2. Joins with `resources_from_make` to get full resource details
3. **Videos now persist** and display in the resources section

## Database Tables Used

### `resources_from_make`
Stores the actual resource data (videos, articles, etc.):
- `id`: UUID primary key
- `url`: Resource URL (unique)
- `title`: Resource title
- `platform`: 'youtube'
- `channel_name`: Creator name
- `thumbnail_url`: Video thumbnail
- `duration_seconds`: Video length
- `summary`: AI-generated summary
- `resource_type`: 'video'

### `blueprint_topic_resources`
Links resources to specific blueprint units:
- `blueprint_id`: References blueprints table
- `unit_id`: Learning unit identifier
- `resource_id`: References resources_from_make.id
- `relevance_score`: How well it matches (0-1)
- `from_cache`: Boolean flag
- `resource_explanation`: Why this resource helps

## Benefits

1. ✅ **Persistence**: Videos survive page refreshes and session changes
2. ✅ **Consistency**: Videos are stored the same way as other resources
3. ✅ **Deduplication**: Same video URL won't create duplicate entries
4. ✅ **Metadata**: Quality reasoning and match scores are preserved
5. ✅ **Integration**: Videos appear in Blueprint's resource display automatically

## Testing Checklist

- [ ] Find a video through explainer overlay
- [ ] Verify video appears in Blueprint resources section
- [ ] Close and reopen blueprint
- [ ] Verify video still appears
- [ ] Cycle through videos (reroll)
- [ ] Verify new video appears in Blueprint
- [ ] Check database to confirm entries in both tables

## Notes

- Videos are saved **immediately** when found or cycled
- Uses `upsert` to avoid duplicate entries
- Handles missing data gracefully (uses defaults)
- Preserves quality reasoning from Grok evaluation
- Works with existing Blueprint resource display logic
