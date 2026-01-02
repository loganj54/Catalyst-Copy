# Haiku 4.5 Web Search Feature

## Overview

This feature adds an alternative resource search method using Claude Haiku 4.5's native web search capabilities. It provides a faster, more cost-effective option compared to the YouTube API search.

## What's Different

### YouTube API Search (Original)
- Uses YouTube Data API v3 to search for videos
- Fetches video transcripts when available
- Analyzes transcripts with GPT-5-nano for deep content understanding
- Generates rich embeddings for future caching
- More comprehensive but uses more API calls

### Haiku 4.5 Web Search (New)
- Uses Claude Haiku 4.5's built-in web search tool
- Makes **only ONE search call** per topic
- Returns exactly **3 results** to minimize costs
- Skips transcript analysis for speed
- Still provides AI-generated explanations for each resource
- Perfect for quick resource discovery

## User Interface

When viewing a learning topic in a blueprint, users now see **two buttons**:

1. **"Find Resources with YouTube API"** (orange, with YouTube icon)
   - Original search method
   - More thorough analysis
   - Better for building long-term resource cache

2. **"Find Resources with Haiku 4.5"** (purple, with sparkles icon)
   - New search method
   - Faster results
   - Lower cost per search
   - Good for quick resource discovery

## Cost Comparison

### YouTube API Search
- 1x YouTube API search call (free quota)
- 1x transcript fetch (free)
- 1x GPT-5-nano analysis (~$0.002)
- 1x embedding generation (~$0.0001)
- **Total: ~$0.002 per topic**

### Haiku 4.5 Search
- 1x Claude Haiku 4.5 call with web search (~$0.001)
- No transcript analysis
- No embeddings
- **Total: ~$0.001 per topic** (50% cheaper)

## How It Works

1. User clicks "Find Resources with Haiku 4.5"
2. Frontend calls `/functions/v1/search-resources-haiku` endpoint
3. Backend extracts top search query from generate-structure output
4. Claude Haiku 4.5 performs ONE web search
5. Returns exactly 3 YouTube educational videos
6. Each video includes an AI-generated explanation
7. Resources are stored in database and linked to blueprint
8. Results appear in the UI immediately

## Technical Details

### New Edge Function
- **Location**: `supabase/functions/search-resources-haiku/index.ts`
- **Model**: `claude-haiku-4-5`
- **Max Tokens**: 2048
- **Web Search Uses**: 1 (single call)
- **Results**: Fixed at 3 videos

### Frontend Changes
- **File**: `src/pages/Blueprint.jsx`
- **Changes**:
  - Added `searchMethod` parameter to `handleGenerateBlueprint()`
  - Updated button UI to show both options
  - Added visual distinction (colors, icons) between methods

### Database Storage
- Resources are stored in `curated_resources` table
- Linked via `blueprint_topic_resources` junction table
- Marked with `transcript_analyzed: false` and `transcript_source: 'none'`
- Can be upgraded to full analysis later if needed

## Deployment

To deploy the new function:

```bash
chmod +x deploy_haiku_search.sh
./deploy_haiku_search.sh
```

Or manually:

```bash
supabase functions deploy search-resources-haiku
```

## Use Cases

### When to Use YouTube API Search
- Building up the resource cache
- Want deep content understanding
- Need transcript-based matching
- Quality over speed

### When to Use Haiku 4.5 Search
- Quick resource discovery
- Cost-conscious searches
- Testing different topics
- Don't need transcript analysis
- Speed over comprehensiveness

## Future Enhancements

1. **Hybrid Mode**: Try Haiku first, fall back to YouTube API if results are poor
2. **Batch Analysis**: Analyze Haiku results later in background
3. **Smart Selection**: Auto-choose method based on cache hit rate
4. **Resource Upgrading**: Upgrade Haiku resources to full analysis on-demand

## Notes

- Both methods use the same search queries from `generate-structure`
- Both link resources the same way in the database
- Both support the same UI display (table with thumbnails)
- Haiku search can be upgraded to full analysis later
- Users can use both methods for the same topic (will get different results)

