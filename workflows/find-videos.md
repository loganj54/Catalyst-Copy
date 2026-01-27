# Find Videos Workflow

## Objective
Find YouTube videos that match a student's specific learning need using intelligent context-aware search with two-pass analysis.

## Required Inputs
- `blueprint_id` (string) - The student's learning plan identifier
- `unit_id` (string) - The specific learning unit identifier
- `preferred_video_types` (string[], optional) - Override automatic video type detection
- `max_results` (number, optional) - Maximum videos to return (default: 5)

## Tools Used
- **Primary**: `find-videos` Supabase Edge Function
- **Fallback**: `tools/find_videos.py` Python script for command-line access

## Process

### Fast Path (Pre-loaded Videos)
1. Call `/find-videos` endpoint with `blueprint_id` and `unit_id`
2. Function analyzes learning unit context (Claude Haiku)
3. Generates student need description
4. Searches Pinecone vector database for matching videos
5. If 3+ matches found (relevance ≥ 0.6):
   - Returns ranked videos immediately
   - Cost: ~$0.007 per search
   - Response time: 2-3 seconds

### Slow Path (On-Demand Loading)
1. If <3 matches in Pinecone:
   - Generates 2-3 specific YouTube search queries (Claude Haiku)
   - Searches YouTube via Apify
   - Fetches transcripts via SupaData
   - **Pass 1**: Analyzes transcripts generically (Grok 4.1)
     - Extracts categories, difficulty, equations, tools, key phrases
   - **Pass 2**: Scores relevance for this student's need (Claude Haiku)
   - Stores ALL videos in database (future reuse)
   - Returns only videos with relevance ≥ 0.6
2. Cost: ~$0.08 per search
3. Response time: 40-60 seconds

## Expected Output

```json
{
  "success": true,
  "videos": [
    {
      "resource_id": "uuid",
      "title": "Video title",
      "url": "https://youtube.com/watch?v=...",
      "platform": "YouTube",
      "channel_name": "Channel Name",
      "thumbnail_url": "https://...",
      "duration": 720,
      "categories": ["worked_example", "visual_demonstration"],
      "difficulty_level": "intermediate",
      "relevance_score": 0.85,
      "match_explanation": "This video demonstrates...",
      "average_rating": 4.5
    }
  ],
  "search_strategy_used": {
    "detected_need": "worked_example",
    "queries_executed": 3,
    "total_candidates": 12
  }
}
```

## Edge Cases

### No Videos Found Above Threshold
- **Scenario**: On-demand loading finds videos but all score <0.6 relevance
- **Behavior**: Stores videos in database, returns empty results to student
- **Message**: "No videos found that closely match your specific need. Try searching YouTube directly or ask your instructor for help."

### YouTube Search Returns Zero Results
- **Scenario**: Apify returns 0 videos for all queries
- **Behavior**: Returns empty results with helpful message
- **Action**: Does NOT crash or timeout

### Transcript Extraction Fails
- **Scenario**: SupaData returns error for a video
- **Behavior**: Skips that video, continues with others
- **Logging**: Error logged for monitoring

### Pinecone Service Outage
- **Scenario**: Pinecone API is unavailable
- **Fallback**: Search database directly with text match on `key_phrases`
- **Impact**: Slower but functional

### Very Niche Topics
- **Scenario**: PhD-level or highly specialized topic with no YouTube content
- **Behavior**: Returns empty results with clear communication
- **Message**: "This topic appears very specialized. No educational videos found on YouTube. Consider consulting research papers or your advisor."

## Error Handling

**Common Errors:**
- `Missing required fields: blueprint_id, unit_id` - Invalid request
- `Learning structure not found` - Blueprint doesn't exist
- `Unit not found in learning structure` - Invalid unit_id
- `Apify credentials not configured` - Missing API keys
- `SupaData API error` - Transcript service issue
- `Grok API error` - Analysis service issue

**Recovery:**
- All errors return HTTP 500 with `{success: false, error: "message"}`
- Logs include full error details for debugging
- Failed video processing in slow path doesn't block other videos

## Performance Expectations

**Fast Path:**
- Response time: <3 seconds (p95)
- Cost: $0.007 per search
- Cache hit rate improves over time

**Slow Path:**
- Response time: 40-60 seconds
- Cost: $0.082 per search
- Only triggered when database lacks relevant videos

**Scaling:**
- Week 1: 20% fast path, 80% slow path
- Month 1: 60% fast path, 40% slow path
- Month 3: 85% fast path, 15% slow path
- Steady state: 95% fast path, 5% slow path

## Monitoring & Optimization

**Key Metrics:**
- Average relevance score (target: >0.65)
- Fast path hit rate (target: >85% after month 3)
- User "hidden as unhelpful" rate (target: <20%)
- Average user rating (target: >4.0/5.0)
- Cost per search (target: <$0.01 averaged)

**Continuous Improvement:**
- Videos with high "hidden" rates → Review categorization
- Topics with consistent slow path → Pre-load common videos
- User feedback loop → Improve relevance scoring

## Related Workflows
- `load-resources-database.md` - Batch pre-loading of videos for topics
- `rate-resource.md` - Student feedback on video quality

## Notes
- Videos are stored permanently in database for reuse
- Future students benefit from videos loaded for previous students
- Popular topics naturally build larger video libraries over time
- System self-improves through usage-driven caching
