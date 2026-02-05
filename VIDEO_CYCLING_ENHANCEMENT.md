# Video Cycling Enhancement

## Summary

Enhanced the `find-videos-sandbox` function to return **all videos above the similarity threshold** (instead of just the top 5) to enable better cycling through video options when cache hits occur.

## Problem

Previously, when a cache hit occurred, the function would:
1. Find all videos above the similarity threshold (e.g., 0.65)
2. Rank them using Grok
3. **Return only the top 5 videos**

This meant that even if 10-15 good videos were found, users could only cycle through 5 of them.

## Solution

Modified the function to return **all ranked videos** that are above the threshold, not just the top 5. This allows users to cycle through more video options.

### Changes Made

#### File: `supabase/functions/find-videos-sandbox/index.ts`

**Change 1: Cache Hit Path (Line ~348)**
```typescript
// BEFORE
rankedVideos = rankings.slice(0, 5).map(r => { ... });

// AFTER
rankedVideos = rankings.map(r => { ... });
```

**Change 2: Fresh Search Path (Line ~451)**
```typescript
// BEFORE
rankedVideos = rankings.slice(0, 5).map(r => { ... });

// AFTER
rankedVideos = rankings.map(r => { ... });
```

## How It Works Now

### Cache Hit Flow
1. Search Pinecone for top 15 results
2. Filter by minimum similarity (default 0.65)
3. Fetch video details from Supabase
4. Rank ALL videos using Grok
5. **Return ALL ranked videos** (not just top 5)
6. Frontend can cycle through all videos

### Fresh Search Flow
1. Search YouTube with user's query
2. Filter by duration (2-45 minutes)
3. Analyze videos (up to 5 videos analyzed)
4. Rank ALL analyzed videos using Grok
5. **Return ALL ranked videos**
6. Store in cache for future use

## Frontend Integration

The frontend (`ExplainerOverlay.jsx`) already supports cycling through multiple videos:

```javascript
const handleReroll = (e) => {
    e.stopPropagation();
    if (rankedVideos.length <= 1) return;

    setIsRerolling(true);
    const nextIndex = (currentVideoIndex + 1) % rankedVideos.length;
    setCurrentVideoIndex(nextIndex);
    
    // Persist to database
    updateExplainer(explainer.id, {
        cachedVideoData: {
            rankedVideos: rankedVideos,
            currentVideoIndex: nextIndex,
            selectedQuery: selectedQuery
        }
    });
};
```

## Benefits

1. **More Options**: Users can cycle through all videos above the threshold, not just 5
2. **Better UX**: If the first video isn't perfect, users have more alternatives
3. **Cache Efficiency**: When cache hits, users get access to all previously found videos
4. **No Breaking Changes**: The response format remains the same, just with more videos in the array

## Example Scenario

**Before:**
- Search finds 12 videos above 0.65 threshold
- Function returns only top 5
- User can cycle through 5 videos

**After:**
- Search finds 12 videos above 0.65 threshold
- Function returns all 12 videos
- User can cycle through all 12 videos

## Configuration

The behavior is controlled by:
- `min_similarity` parameter (default: 0.65) - controls which videos are included
- Pinecone search returns top 15 results
- All videos above threshold are ranked and returned

## Testing

To test the enhancement:

1. **Test Cache Hit with Multiple Videos:**
   ```javascript
   // In browser console or test
   const response = await supabase.functions.invoke('find-videos-sandbox', {
       body: {
           term: "Reynolds number",
           selected_query: "What is Reynolds number in fluid mechanics?",
           unit_topic: "Fluid Mechanics",
           min_similarity: 0.65
       }
   });
   
   console.log('Videos returned:', response.data.ranked_videos.length);
   ```

2. **Verify Cycling:**
   - Click on a term to open explainer
   - Select a video query
   - Wait for videos to load
   - Click the refresh icon multiple times
   - Should cycle through all videos above threshold

## Notes

- The first video shown is still the highest-ranked video
- Videos are ranked by Grok based on how well they match the target resource profile
- The `similarity_score` and `profile_match_score` are both included for each video
- Frontend automatically persists the current video index to the database
