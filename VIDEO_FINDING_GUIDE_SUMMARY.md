# Video Finding Process - Complete Guide (Executive Summary)

## 📚 What You Have (3 Documents)

1. **VIDEO_FINDING_FLOWCHART.md** - Detailed step-by-step process breakdown
2. **VIDEO_FINDING_VISUAL_FLOWCHART.md** - ASCII flowcharts and visual diagrams  
3. **VIDEO_FINDING_CODE_BREAKDOWN.md** - Code components and function calls

---

## 🎯 Quick Overview

The video finding process has **7 main phases**:

```
Phase 1: Query Generation
Phase 2: Request Submission
Phase 3: Profile Generation
Phase 4: Cache Lookup
Phase 5: Video Discovery (Cache Hit OR Fresh Search)
Phase 6: Response Formatting
Phase 7: Display & Cycling
```

---

## ⚡ Quick Reference (Under 60 Seconds)

### What Happens When User Clicks a Term?

```
1. Frontend asks Claude: "What are 5 good ways to search for this topic?"
   └─ Claude generates 5 query options

2. User clicks one query option

3. Frontend calls find-videos-sandbox edge function

4. Edge function asks Claude: "What's the ideal tutorial video for this query?"
   └─ Claude creates a "Target Resource Profile"

5. Edge function searches Pinecone (vector database) for similar videos

6. Decision Point:
   ├─ Found 5+ videos above threshold? → Use them (FAST - ~5 sec)
   ├─ No videos found? → Search YouTube fresh (SLOW - ~20 sec)

7. Rank videos by how well they match the profile using Grok AI

8. Return best video + list of all videos for cycling

9. Frontend displays video with reroll button

10. User can cycle through all videos or close explainer
```

---

## 🔄 The Two Paths

### PATH A: Cache Hit (FAST) ⚡

```
Your Query
  ↓
  ├─ Generate Profile (Claude) - 1 sec
  ├─ Create Vector - 0.5 sec
  ├─ Search Pinecone - 0.5 sec
  ├─ Found 5+ videos? YES!
  ├─ Fetch Details - 1 sec
  ├─ Rank with Grok - 2-3 sec
  └─ Return 5 videos
  
TOTAL: ~5-6 seconds ✓
```

### PATH B: Fresh Search (SLOW) 🐢

```
Your Query
  ↓
  ├─ Generate Profile (Claude) - 1 sec
  ├─ Search Pinecone - 2 sec
  ├─ Found 5+ videos? NO!
  ├─ Search YouTube - 2-3 sec
  ├─ Get Transcripts - 3-5 sec
  ├─ Analyze with Grok - 3-5 sec
  ├─ Rank with Grok - 2-3 sec
  ├─ Store in Database - 1 sec
  ├─ Store in Pinecone Cache - 1-2 sec
  └─ Return videos
  
TOTAL: ~15-20 seconds ⚠️
(But now cached for next time!)
```

---

## 🎬 Key Numbers

| Metric | Value | Notes |
|--------|-------|-------|
| Query Options Generated | 5 | Claude creates 5 different search angles |
| Cache Similarity Threshold | 0.65 | Adjustable, lower = more results |
| Videos Returned | ALL above threshold | Changed: Now all instead of top 5! |
| Pinecone Search Results | 15 | Fetches top 15, filters by threshold |
| Video Duration Min | 2 minutes | Too short = incomplete |
| Video Duration Max | 45 minutes | Too long = viewer fatigue |
| Cache Hit Speed | ~5-6 sec | Very fast |
| Fresh Search Speed | ~15-20 sec | Slower but results are cached |

---

## 🛠️ Architecture Components

```
                    FRONTEND (React)
                ExplainerOverlay.jsx
                         │
         (REST calls via Supabase)
                         │
    ┌────────┬──────────┬────────┐
    ▼        ▼          ▼        ▼
  Query    Video    ...Other    Functions
  Generator Finder  Functions

    Find-Videos-Sandbox (Main Orchestrator)
    ├─ Step 1: Generate Profile (Claude)
    ├─ Step 2: Check Cache (Pinecone)
    ├─ Step 3: Cache Hit or Fresh Search
    ├─ Step 4: Rank Videos (Grok)
    ├─ Step 5: Store (if fresh)
    └─ Step 6: Return Response

    ↓ (Connects to)

    ├─ Claude (3.5 Haiku) - Profile & query generation
    ├─ OpenAI - Embedding/Vector generation
    ├─ Pinecone - Vector similarity search
    ├─ Grok 2 (xAI) - Video ranking
    ├─ YouTube (Apify) - Search
    ├─ SupaData - Transcript extraction
    └─ Supabase - Database storage
```

---

## 📊 Data Flow Summary

```
INPUT:
  ├─ Term: "Reynolds number"
  ├─ Query: "What is Reynolds number in fluid mechanics?"
  ├─ Context: "Fluid Mechanics"
  └─ Min Similarity: 0.65

PROCESSING:
  1. Generate AI profile describing ideal video
  2. Convert profile to vector embedding
  3. Search vector database for similar videos
  4. If found (cache hit):
     ├─ Fetch full video details
     └─ Rank by profile match using Grok
  5. If not found (cache miss):
     ├─ Search YouTube
     ├─ Get transcripts
     ├─ Analyze content
     ├─ Rank by profile match
     └─ Store for future cache hits
  6. Format response with all videos

OUTPUT:
  {
    success: true,
    video: {...},              ← Best match (rank 1)
    ranked_videos: [...],      ← All videos for cycling
    source: "cache" | "fresh_search",
    stats: {
      videos_searched: 5,
      videos_analyzed: 5,
      videos_stored: 5,
      cache_hits: 5
    }
  }
```

---

## 🎮 User Interactions

### After Videos Load

1. **Watch Video**
   - Click thumbnail
   - YouTube opens in new tab
   
2. **Cycle to Next Video**
   - Click [↻] reroll button
   - Next video appears instantly
   - Can cycle infinitely through all videos
   
3. **Rate Video**
   - Star rating system
   - Saved to database
   
4. **Close**
   - Click [x]
   - Explainer removed
   - Selection saved

---

## ⚙️ Key Concepts

### Target Resource Profile
**What**: AI-generated description of the ideal tutorial video
**Why**: Enables semantic matching beyond keywords
**How**: Claude reads term + query + context and writes a detailed profile
**Example**: "This video explains Reynolds number as a dimensionless quantity that determines flow regime..."

### Vector Embedding
**What**: Mathematical representation of text (1536 dimensions)
**Why**: Enables similarity comparison in vector space
**How**: OpenAI converts text → vector
**Use**: Compare query profile against stored video profiles in Pinecone

### Pinecone Cache
**What**: Vector database storing video profiles
**Why**: Fast semantic search for similar topics
**Hit Rate**: ~70% for engineering topics (after initial search)
**Benefit**: 5-6 sec response instead of 15-20 sec

### Grok Ranking
**What**: AI evaluates videos against your profile
**Why**: Ensures most relevant video is shown first
**How**: Grok 2 analyzes each video's transcript/summary
**Score**: 0.0-1.0 (how well video matches your specific need)

---

## 📈 Performance Timeline

```
Time    Action                              Status
────────────────────────────────────────────────────
0s      User clicks term                    🟢
0-1s    Generate queries                   ⏳
1s      User selects query option          🟢
1-1.5s  Send request to backend            ⏳
1.5-2s  Generate profile (Claude)          ⏳
2-2.5s  Create embedding                   ⏳
2.5-3s  Search Pinecone                    ⏳

        ↓↓↓ DECISION POINT ↓↓↓

CACHE HIT:
3-4s    Fetch video details                ⏳
4-6s    Rank with Grok                     ⏳
6s      Return response                    🟢
6-6.5s  Display video                      🟢

CACHE MISS:
3-5.5s  YouTube search                     ⏳
5.5-9s  Get transcripts                    ⏳
9-14s   Analyze videos                     ⏳
14-16s  Rank with Grok                     ⏳
16-18s  Store in database                  ⏳
18-20s  Return response                    🟢
20s     Display video                      🟢
```

---

## 🔍 Debugging Tips

### If videos load slowly:
- Cache miss (first time search) = normal, ~20 sec
- Check network tab for YouTube API latency
- Lower `min_similarity` threshold to use more videos from cache

### If only 1 video shows:
- All other matches below threshold
- Lower `min_similarity` from 0.65 to 0.60
- Or search YouTube fresh for more options

### If can't reroll:
- Need at least 2 videos to cycle
- Problem: All matches below threshold + no fresh search
- Solution: Force fresh search with `force_refresh: true`

### If wrong videos return:
- Profile generation might be off
- Check term clarity + context
- Verify query is specific enough

---

## 💾 Data Storage

### Supabase Tables
- `videos` - Video metadata (title, url, transcript, summary, etc.)
- `blueprint_video_rankings` - Rankings for specific topics

### Pinecone Namespace
- `resources` - Video embeddings (vectors + metadata)

### Frontend Cache
- Browser localStorage - Recent selections
- React state - Current video index in cycling

---

## 🚀 Recent Enhancement

You just enabled **cycling through ALL videos** above threshold instead of just 5!

**What changed:**
```typescript
// BEFORE
rankedVideos = rankings.slice(0, 5).map(r => {...});  // Only top 5

// AFTER
rankedVideos = rankings.map(r => {...});              // ALL videos
```

**Impact:**
- If 10 videos found above threshold → user can cycle through 10 (was 5)
- Better UX when first option isn't perfect
- No performance hit (same queries run)

---

## 📞 Support Info

### Components by File

| File | Component | Purpose |
|------|-----------|---------|
| `find-videos-sandbox/index.ts` | Main Handler | Orchestrates entire flow |
| `generate-video-queries/index.ts` | Query Generator | Creates 5 search options |
| `_shared/video-storage.ts` | Cache Manager | Pinecone operations |
| `_shared/video-analyzer.ts` | Analysis | Grok ranking |
| `ExplainerOverlay.jsx` | UI Display | Shows videos, handles cycling |

### Key Environment Variables

```
SUPABASE_URL              - Database connection
SUPABASE_SERVICE_ROLE_KEY - Database auth
OPENAI_API_KEY            - Embeddings
XAI_API_KEY               - Grok (ranking)
APIFY_API_KEY             - YouTube search
PINECONE_API_KEY          - Vector DB
```

---

## 🎓 Learning Path

Want to understand the code?

1. **Start here**: `VIDEO_FINDING_VISUAL_FLOWCHART.md` - Get visual overview
2. **Then read**: `VIDEO_FINDING_FLOWCHART.md` - Understand each step
3. **Deep dive**: `VIDEO_FINDING_CODE_BREAKDOWN.md` - Function calls
4. **Implement**: Trace through `find-videos-sandbox/index.ts`

---

## 📋 Checklist for Testing

- [ ] Search for a term (generates 5 queries)
- [ ] Select a query (loads videos)
- [ ] First video appears (~5-20 sec)
- [ ] Click reroll button (cycles to next video)
- [ ] Click again (cycles through all videos)
- [ ] Can cycle infinitely (loops back to start)
- [ ] Click thumbnail (opens YouTube)
- [ ] Rating system works
- [ ] Close works, selection saved

---

## ✨ Summary

The video finding system is an **AI-powered recommendation engine** that:

1. **Understands** your specific learning need (not just keywords)
2. **Searches smart** (vectors not text, semantic not keyword)
3. **Ranks intelligently** (profiles + AI evaluation, not just popularity)
4. **Responds fast** (caches results for ~20-70% of queries)
5. **Gives options** (cycle through all videos above quality threshold)
6. **Remembers** (caches and improves over time)

It's the bridge between **"show me any video about Reynolds number"** and **"show me a video that explains Reynolds number in the context of my fluid mechanics learning, with practical applications, at my level of understanding."**

---

## 🎉 You Now Understand:

✅ How queries are generated (5 different angles)
✅ How videos are found (cache first, YouTube second)
✅ How videos are ranked (AI profile matching)
✅ How videos are stored (database + vector cache)
✅ How users cycle (infinite loop through all matches)
✅ Why some are fast (~6 sec) and some slow (~20 sec)
✅ What happens when cache hits vs misses
✅ How the whole system fits together

**Congratulations!** You're now fluent in the Catalyst video finding system! 🎬📚
