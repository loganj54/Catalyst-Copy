# Video Finding Process - Quick Reference Card

Print this for your desk! 🖨️

---

## The 7-Phase Journey

```
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: Query Generation (Frontend)                  │
│  Claude creates 5 different search angles              │
│  Time: 1 sec                                           │
├─────────────────────────────────────────────────────────┤
│  PHASE 2: User Selection                               │
│  User clicks 1 query from the 5 options               │
│  Time: Variable (user decision)                        │
├─────────────────────────────────────────────────────────┤
│  PHASE 3: Profile Generation (Backend)                │
│  Claude creates ideal video description               │
│  Time: 1 sec                                           │
├─────────────────────────────────────────────────────────┤
│  PHASE 4: Cache Lookup                                 │
│  Search Pinecone for similar cached videos            │
│  Time: 2 sec                                           │
├─────────────────────────────────────────────────────────┤
│  PHASE 5: Video Discovery                              │
│  ├─ FAST PATH: Found cache? Use it (3 sec)            │
│  └─ SLOW PATH: Cache miss? YouTube search (15 sec)    │
├─────────────────────────────────────────────────────────┤
│  PHASE 6: Response Formatting                          │
│  Return best video + all videos for cycling           │
│  Time: 1 sec                                           │
├─────────────────────────────────────────────────────────┤
│  PHASE 7: Display & Cycling (Frontend)                │
│  Show video, enable reroll button                      │
│  Time: Instant                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Decision Tree (Simplified)

```
User searches for term
    │
    ├─ Generate profile ✓
    │
    ├─ Search cache
    │   │
    │   ├─ Found videos above 0.60 similarity? 
    │   │   │
    │   │   ├─ YES → Send up to 15 to Grok
    │   │   │        │
    │   │   │        ├─ Grok ranks videos (relative)
    │   │   │        │
    │   │   │        └─ Grok applies QUALITY GATE (absolute)
    │   │   │            │
    │   │   │            ├─ Any pass quality bar?
    │   │   │            │   │
    │   │   │            │   ├─ YES → Return passing videos only
    │   │   │            │   │        ~5-6 seconds total
    │   │   │            │   │
    │   │   │            │   └─ NO → Fall through to fresh search
    │   │   │
    │   │   └─ NO → SLOW PATH (Cache Miss)
    │   │           Search YouTube
    │   │           Analyze videos
    │   │           Apply quality gate
    │   │           Store in cache
    │   │           ~15-20 seconds total
    │   │
    │
    └─ Return only videos that pass quality bar
       │
       ▼
    User sees best video
       │
       ├─ Click thumbnail → YouTube ✓
       ├─ Click reroll → Next video ✓
       └─ Click X → Close ✓
```

---

## The Two Paths at a Glance

### 🟢 CACHE HIT (FAST - ~5-6 sec)

```
Profile Generated
    ↓
Vector Search (Pinecone)
    ↓
Found videos above 0.60 similarity?
    ↓ YES (up to 15 videos)
Fetch Details
    ↓
Rank with Grok + QUALITY GATE
    ↓
Any pass quality bar?
    ↓ YES
Return ONLY passing videos ✓
```

### 🟠 CACHE MISS (SLOW - ~15-20 sec)

```
Profile Generated
    ↓
Vector Search (Pinecone)
    ↓
Found 5+ videos above 0.65 similarity?
    ↓ NO
YouTube Search
    ↓
Get Transcripts
    ↓
Analyze with Grok
    ↓
Rank with Grok
    ↓
Store in Database & Pinecone
    ↓
Return Videos ✓
```

---

## Key Services & APIs

| Service | Purpose | Speed | Cost |
|---------|---------|-------|------|
| **Claude 3.5 Haiku** | Profile generation | 1 sec | $0.01 |
| **OpenAI Embeddings** | Vector creation | 0.5 sec | $0.001 |
| **Pinecone** | Vector search | 0.5 sec | $0.01 |
| **Grok 2 (xAI)** | Video ranking | 2-3 sec | $0.05 |
| **YouTube (Apify)** | Search | 2-3 sec | $0.10* |
| **SupaData** | Transcripts | 3-5 sec | $0.05* |
| **Supabase** | Database | 1-2 sec | $0.01* |

*Only on cache miss (fresh search)

---

## Critical Numbers

```
Similarity Threshold      0.60   (lowered from 0.65 to cast wider net)
Cache Search Results      15     (take all above 0.60)
Videos to Grok           15     (max sent for quality evaluation)
Videos to Return          ONLY PASSING QUALITY BAR
Quality Gate              Absolute judgment by Grok
Video Duration Min        2 min  (120 sec)
Video Duration Max        45 min (2700 sec)
Pinecone Top K           15     (results to retrieve)
Query Options Generated   5      (Claude creates)
```

---

## Response Structure

```javascript
{
  success: true,
  
  // Single best video for immediate display
  video: {
    rank: 1,
    title: "Reynolds Number Explained",
    url: "https://youtube.com/watch?v=...",
    similarity_score: 0.85,        // Cache match
    profile_match_score: 0.92,     // Grok ranking
    passes_quality_bar: true,      // NEW: Absolute quality judgment
    quality_reasoning: "Directly explains the concept with clear examples",
    // ... more fields
  },
  
  // ALL videos for cycling
  ranked_videos: [
    { rank: 1, video_id: "...", ... },
    { rank: 2, video_id: "...", ... },
    { rank: 3, video_id: "...", ... },
    { rank: 4, video_id: "...", ... },
    { rank: 5, video_id: "...", ... }
    // ... more if found above threshold
  ],
  
  source: "cache" | "fresh_search",
  stats: {
    videos_searched: 5,
    videos_analyzed: 5,
    cache_hits: 5
  }
}
```

---

## Frontend Integration

```javascript
// User clicks term → Explainer opens

// Step 1: Generate queries
generateQueries()
  → display 5 query buttons

// Step 2: User selects query
setSelectedQuery(selected)

// Step 3: Fetch videos
fetchVideos()
  → calls find-videos-sandbox
  → waits 5-20 seconds

// Step 4: Display best video
currentVideo = rankedVideos[0]
  → show on screen

// Step 5: User cycles
handleReroll()
  → nextIndex = (currentIndex + 1) % rankedVideos.length
  → display rankedVideos[nextIndex]
  → save to database
  → infinite cycling enabled!
```

---

## Quality Gate (NEW!)

The system now has a **two-stage evaluation**:

### Stage 1: Relative Ranking
"Which videos are better than others?"
- Grok compares videos against each other
- Assigns relative_score (0-1)

### Stage 2: Absolute Quality Gate
"Does this video ACTUALLY answer the question?"
- Grok evaluates each video independently
- Returns `passes_quality_bar: true/false`
- Returns `quality_reasoning: "why it passes or fails"`

### What Happens

| Scenario | Result |
|----------|--------|
| 5 videos pass quality bar | Return all 5 |
| 3 pass, 2 fail | Return only 3 |
| 0 pass quality bar | Trigger fresh YouTube search |
| 1 excellent match | Return only 1 |

### Why This Matters

**Before:** Cache hit with 5 mediocre videos → Return all 5 anyway
**After:** Cache hit with 5 mediocre videos → None pass → Fresh search

---

## Troubleshooting Quick Guide

| Problem | Cause | Solution |
|---------|-------|----------|
| Takes 15-20 sec | Cache miss OR quality gate failed | Normal - searching for better videos |
| Only 1 video | Only 1 passed quality bar | That's the only good match! |
| Can't cycle | Only 1 video passed quality gate | Search found limited good matches |
| Wrong videos | Bad profile generation | Check term/context clarity |
| Empty results | No videos passed quality bar | Try different search query |
| Fresh search triggered | Cache videos didn't answer question | Quality gate working correctly |

---

## Console Logs to Watch

```
✓ Cache Hit + Quality Pass Pattern:
  [Sandbox] Cache search returned 15 results
  [Sandbox] 12 results above 0.60 threshold
  [Sandbox] ✓ CACHE HIT!
  [Sandbox] Grok ranked 12 videos
  [Sandbox] Quality gate results: 8/12 videos passed
  [Sandbox] Returning 8 cached videos (quality-filtered)

✓ Cache Hit + Quality FAIL Pattern:
  [Sandbox] Cache search returned 10 results
  [Sandbox] 7 results above 0.60 threshold
  [Sandbox] ✓ CACHE HIT!
  [Sandbox] Grok ranked 7 videos
  [Sandbox] Quality gate results: 0/7 videos passed
  [Sandbox] ⚠️ No videos passed quality bar - will trigger fresh search
  [Sandbox] STEP 3: FRESH YOUTUBE SEARCH
  ...

✓ Fresh Search Pattern:
  [Sandbox] Cache MISS
  [Sandbox] STEP 3: FRESH YOUTUBE SEARCH
  [Sandbox] Found 5 videos from YouTube
  [Sandbox] Analyzed 5 videos
  [Sandbox] Fresh search quality gate: 4/5 videos passed
  [Sandbox] Storing videos...

✓ Success Pattern:
  [Sandbox] Complete!
  [Sandbox] Source: cache (or fresh_search)
  [Sandbox] Ranked videos: 4 (only quality-passing)
  [Sandbox] Best match: "Video Title"
```

---

## Performance Profile

```
CACHE HIT Timeline (videos pass quality gate):
0s     ─ Request received
1s     ├─ Profile generated (Claude)
1.5s   ├─ Embedding created
2.5s   ├─ Pinecone searched (up to 15 videos)
3.5s   ├─ Details fetched
6.5s   ├─ Grok ranks + quality gate evaluation
7s     └─ Response returned ✓
       └─ TOTAL: ~7 sec

CACHE HIT → QUALITY GATE FAIL → FRESH SEARCH:
0s     ─ Request received
1s     ├─ Profile generated (Claude)
2.5s   ├─ Pinecone searched
6.5s   ├─ Grok quality gate: 0 pass
7s     ├─ Trigger fresh YouTube search
10s    ├─ YouTube searched
14s    ├─ Transcripts retrieved
18s    ├─ Videos analyzed (Grok)
20s    ├─ Grok ranks + quality gate
22s    └─ Response returned ✓
       └─ TOTAL: ~22 sec (but better results!)

CACHE MISS Timeline:
0s     ─ Request received
1s     ├─ Profile generated (Claude)
2s     ├─ Pinecone searched (no results)
5.5s   ├─ YouTube searched
9s     ├─ Transcripts retrieved
14s    ├─ Videos analyzed (Grok)
16s    ├─ Grok ranks + quality gate
18s    ├─ Stored in database
20s    └─ Response returned ✓
       └─ TOTAL: ~20 sec
```

---

## What Each Score Means

```
similarity_score (Pinecone)
├─ 0.95+ : Identical to cached profile (very rare)
├─ 0.85+ : Highly similar (good cache matches)
├─ 0.75+ : Similar content (decent cache matches)
├─ 0.60+ : Reasonably similar (threshold, included)
└─ <0.60 : Too different (filtered out)

profile_match_score (Grok - Relative)
├─ 0.90+ : Best match among the options
├─ 0.80+ : Very good relative match
├─ 0.70+ : Good relative match
├─ 0.60+ : Acceptable relative match
└─ <0.60 : Worst among options

passes_quality_bar (Grok - Absolute) ← NEW!
├─ true  : Video ACTUALLY answers the question
└─ false : Video is related but won't help

quality_reasoning (Grok - Explanation) ← NEW!
└─ One sentence explaining why it passes or fails

user_rating (Database)
├─ 5.0   : Excellent
├─ 4.0+  : Good
├─ 3.0+  : Average
└─ <3.0  : Below average
```

---

## Data Flow (One Line Per Step)

```
1. User inputs → Frontend
2. Frontend generates 5 queries with Claude
3. User selects 1 query
4. Frontend calls find-videos-sandbox
5. Backend generates Target Resource Profile with Claude
6. Backend creates vector embedding of profile
7. Backend searches Pinecone cache
8. If found: Rank cached videos → Return (6 sec)
9. If not: Search YouTube → Get transcripts → Analyze → Rank → Store → Return (20 sec)
10. Frontend displays best video
11. User clicks reroll → Cycle to next video (instant)
12. Can cycle infinitely through all matched videos
```

---

## Architecture in One Picture

```
                      FRONTEND (React)
                    ExplainerOverlay.jsx
                            │
            (REST via Supabase Functions)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      generate-      find-videos-      other
      video-         sandbox           functions
      queries        (MAIN)
            │               │               │
            └───────────────┼───────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
    Claude 3.5         Pinecone + Grok      YouTube+Supabase
    (Generate)         (Search & Rank)      (Fresh Search)
```

---

## Recent Enhancement

✨ **Global Quality Gate Added**

```
BEFORE: Returns top 5 videos (relative ranking only)
AFTER:  Returns ONLY videos that pass absolute quality bar

Key Changes:
├─ Threshold lowered: 0.65 → 0.60 (wider net)
├─ Up to 15 videos sent to Grok for evaluation
├─ Grok now does TWO evaluations:
│   ├─ Relative ranking (which is best?)
│   └─ Absolute quality gate (does it answer the question?)
├─ Only videos passing quality bar are returned
└─ If none pass → triggers fresh YouTube search

Example:
├─ Search finds 10 videos above threshold
├─ BEFORE: User cycles through 5 only
└─ AFTER:  User cycles through all 10!

Impact:
├─ Better UX
├─ More options when first video isn't perfect
└─ No performance cost
```

---

## Configuration Values to Remember

```
min_similarity = 0.60      # Lowered from 0.65 for wider net
PINECONE_TOP_K = 15        # Fetch top 15 from cache
QUALITY_GATE = true        # Absolute quality evaluation enabled
MIN_DURATION = 120         # 2 minutes
MAX_DURATION = 2700        # 45 minutes
BATCH_SIZE = 5             # Videos analyzed per batch
TOKEN_LIMIT = 1000         # Chars per transcript for Grok
```

---

## Files to Know

```
Core:
├─ supabase/functions/find-videos-sandbox/index.ts    ← Main
├─ supabase/functions/generate-video-queries/index.ts
├─ src/components/ExplainerOverlay.jsx                ← Frontend

Utilities:
├─ _shared/supabase-client.ts
├─ _shared/embeddings.ts
├─ _shared/video-storage.ts
├─ _shared/video-analyzer.ts
└─ _shared/youtube-helpers.ts
```

---

## Testing Checklist

- [ ] Search for term (generates 5 queries)
- [ ] Select query (loads video in ~5-20 sec)
- [ ] Video displays (best match shown)
- [ ] Click reroll (next video appears)
- [ ] Reroll again (cycles through videos)
- [ ] Reroll multiple times (no errors, continuous cycling)
- [ ] Click thumbnail (opens YouTube)
- [ ] Close explainer (saves selection)

---

**Bookmark this page!** 📌

For detailed info, see:
- VIDEO_FINDING_DOCUMENTATION_INDEX.md (Overview)
- VIDEO_FINDING_GUIDE_SUMMARY.md (5 min read)
- VIDEO_FINDING_VISUAL_FLOWCHART.md (Visual diagrams)
- VIDEO_FINDING_FLOWCHART.md (Deep dive)
- VIDEO_FINDING_CODE_BREAKDOWN.md (Code details)
