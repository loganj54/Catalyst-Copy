# Video Finding Process - Quick Visual Reference

## The Complete Journey (Start to Finish)

```
╔════════════════════════════════════════════════════════════════════════════╗
║                         USER CLICKS EXPLAINER TERM                        ║
║                    (e.g., "Reynolds number")                              ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                  FRONTEND: Generate Query Options                          ║
║            supabase.functions.invoke('generate-video-queries')            ║
║                                                                            ║
║  Input: term, context, solutionContext                                    ║
║  Claude generates 5 different search angles                               ║
║                                                                            ║
║  Output (5 Options):                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │ 1. "What is Reynolds number in fluid mechanics?"                    │ ║
║  │ 2. "How to calculate Reynolds number for pipe flow?"                │ ║
║  │ 3. "Reynolds number: laminar vs turbulent transition"               │ ║
║  │ 4. "Applications of Reynolds number in heat transfer"               │ ║
║  │ 5. "Dimensionless numbers including Reynolds"                       │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  User reads options and clicks ONE                                         ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                    User selects: Option 1
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║          FRONTEND: Call find-videos-sandbox with selected query            ║
║                                                                            ║
║  Request:                                                                  ║
║  {                                                                         ║
║    term: "Reynolds number",                                               ║
║    selected_query: "What is Reynolds number in fluid mechanics?",        ║
║    unit_topic: "Fluid Mechanics",                                         ║
║    min_similarity: 0.65                                                   ║
║  }                                                                         ║
║                                                                            ║
║  UI: Loading spinner appears...                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                      BACKEND: Step 1                                       ║
║              Generate Target Resource Profile                              ║
║                                                                            ║
║  Claude Haiku analyzes:                                                    ║
║  ├─ Term: "Reynolds number"                                               ║
║  ├─ Query: "What is Reynolds number in fluid mechanics?"                 ║
║  ├─ Context: "Fluid Mechanics"                                            ║
║  └─ Creates ideal video description:                                      ║
║                                                                            ║
║  Profile Output:                                                           ║
║  "This video explains Reynolds number as a dimensionless quantity that   ║
║   determines flow regime (laminar vs turbulent) in fluid dynamics. It     ║
║   covers the Re = ρVD/μ formula, physical meaning, critical thresholds,  ║
║   and practical applications in pipe flow and heat transfer analysis."   ║
║                                                                            ║
║  This profile becomes the search "fingerprint"                             ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                      BACKEND: Step 2                                       ║
║              Convert Profile to Vector & Search Cache                      ║
║                                                                            ║
║  1. Convert text to embedding                                             ║
║     └─ 1536-dimensional vector                                            ║
║                                                                            ║
║  2. Search Pinecone (vector database)                                      ║
║     ├─ Query: Generated vector                                            ║
║     ├─ Top K: 15 results                                                  ║
║     ├─ Namespace: 'resources'                                             ║
║     └─ Include metadata: YES                                              ║
║                                                                            ║
║  3. Pinecone returns matches with scores:                                  ║
║     ┌──────────────────────────────────┐                                 ║
║     │ Match 1: Score 0.85              │ ← Above 0.65 ✓                  ║
║     │ Match 2: Score 0.78              │ ← Above 0.65 ✓                  ║
║     │ Match 3: Score 0.72              │ ← Above 0.65 ✓                  ║
║     │ Match 4: Score 0.68              │ ← Above 0.65 ✓                  ║
║     │ Match 5: Score 0.65              │ ← Above 0.65 ✓                  ║
║     │ Match 6: Score 0.62              │ ← Below 0.65 ✗                  ║
║     │ Match 7: Score 0.58              │ ← Below 0.65 ✗                  ║
║     └──────────────────────────────────┘                                 ║
║                                                                            ║
║  ╔─────────────── DECISION POINT ──────────────────╗                    ║
║  ║ Found 5+ videos above 0.65 threshold?           ║                    ║
║  ╚───────┬────────────────────────────┬────────────╝                    ║
║          │                            │                                  ║
║         YES                           NO                                 ║
║          │                            │                                  ║
║          ▼                            ▼                                  ║
║    [CACHE HIT]                    [CACHE MISS]                          ║
║    (FAST PATH)                    (SLOW PATH)                           ║
║    ~5-6 sec                       ~15-20 sec                            ║
╚════════════════════════════════════════════════════════════════════════════╝


                    OPTION A: CACHE HIT (FAST PATH)
                    ═════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                         Step 3A: Fetch Details                              │
│                                                                             │
│  Have: 5 video IDs from Pinecone                                           │
│  Do: Query Supabase for full video information                             │
│                                                                             │
│  For each video ID, retrieve:                                              │
│  ├─ Title                                                                   │
│  ├─ URL                                                                     │
│  ├─ Thumbnail                                                               │
│  ├─ Summary                                                                 │
│  ├─ Description                                                             │
│  ├─ Channel name                                                            │
│  ├─ Duration                                                                │
│  ├─ Average rating                                                          │
│  └─ Rating count                                                            │
│                                                                             │
│  Result: Full video objects ready for ranking                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Step 4A: Rank with Grok                             │
│                                                                             │
│  Input:                                                                     │
│  ├─ 5 videos from cache                                                    │
│  ├─ Our target resource profile                                            │
│  └─ Grok AI (xAI's ranking model)                                          │
│                                                                             │
│  Grok analyzes each video:                                                  │
│  ├─ "Does this match our profile?"                                         │
│  ├─ "How well explained is the concept?"                                   │
│  ├─ "Are practical applications covered?"                                  │
│  ├─ "Is the mathematical depth appropriate?"                               │
│  └─ Assigns ranking score (0.0 - 1.0)                                      │
│                                                                             │
│  Output Rankings:                                                           │
│  ┌───────────────────────────────────────────────────────┐                 │
│  │ Rank 1: "Reynolds Number Explained" - Score 0.92     │ ← BEST          │
│  │ Rank 2: "Fluid Mechanics 101" - Score 0.87           │                 │
│  │ Rank 3: "Laminar vs Turbulent" - Score 0.81          │                 │
│  │ Rank 4: "Re in Pipe Flow" - Score 0.76               │                 │
│  │ Rank 5: "Dimensionless Numbers" - Score 0.71         │                 │
│  └───────────────────────────────────────────────────────┘                 │
│                                                                             │
│  ✓ All 5 videos returned (not just top 1 or 2!)                            │
│  ✓ Ready for cycling/reroll feature                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────┐
                        │   SKIP TO STEP 6  │
                        │  (Return Response)│
                        └───────────────────┘


                  OPTION B: CACHE MISS (SLOW PATH)
                  ═════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                    Step 3B: Search YouTube                                  │
│                                                                             │
│  Query: "What is Reynolds number in fluid mechanics?"                     │
│  Service: Apify API                                                         │
│                                                                             │
│  YouTube Returns:                                                           │
│  ├─ Video 1: "Reynolds Number Explained" (12 min, 4.8★)                    │
│  ├─ Video 2: "Fluid Flow Basics" (8 min, 4.6★)                             │
│  ├─ Video 3: "Advanced CFD" (45 min, 4.5★)                                 │
│  ├─ Video 4: "Physics Quick Review" (0.5 min, 3.2★) ← TOO SHORT           │
│  ├─ Video 5: "Complete Thermodynamics" (90 min) ← TOO LONG                 │
│  └─ ... more results                                                       │
│                                                                             │
│  Filter by duration (2-45 minutes):                                         │
│  ├─ Keep: Videos 1, 2, 3 ✓                                                 │
│  └─ Discard: Videos 4, 5 ✗                                                 │
│                                                                             │
│  Result: ~3-5 valid videos to analyze                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Step 4B: Get Transcripts                                  │
│                                                                             │
│  For each video:                                                            │
│  1. Extract YouTube caption data                                            │
│  2. Use SupaData API for fallback                                           │
│  3. Store full transcript with video                                        │
│                                                                             │
│  Example transcript:                                                        │
│  "Reynolds number is a dimensionless quantity used in fluid mechanics.     │
│   It represents the ratio of inertial forces to viscous forces. The        │
│   formula is Re = ρVD/μ where ρ is density, V is velocity, D is          │
│   diameter, and μ is dynamic viscosity..."                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Step 5B: Analyze with Grok                                │
│                                                                             │
│  For each video:                                                            │
│  ├─ Title                                                                   │
│  ├─ Transcript (first 1000 chars)                                           │
│  ├─ Channel info                                                            │
│  └─ Duration                                                                │
│                                                                             │
│  Grok performs analysis pass:                                               │
│  ├─ Extracts key topics covered                                             │
│  ├─ Generates summary of content                                            │
│  ├─ Identifies learning objectives met                                      │
│  └─ Flags content quality issues                                            │
│                                                                             │
│  Output: Analyzed video objects                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Step 6B: Rank Against Profile                              │
│                                                                             │
│  Input:                                                                     │
│  ├─ Analyzed videos                                                         │
│  ├─ Our target resource profile                                            │
│  └─ Grok AI ranking                                                         │
│                                                                             │
│  Grok compares each video against profile:                                  │
│  ├─ How well explained?                                                     │
│  ├─ Correct depth level?                                                    │
│  ├─ Practical applications?                                                 │
│  └─ Good pacing and clarity?                                                │
│                                                                             │
│  Output:                                                                    │
│  ├─ Rank 1: Video A - Score 0.89                                            │
│  ├─ Rank 2: Video B - Score 0.84                                            │
│  └─ Rank 3: Video C - Score 0.78                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Step 7B: Store for Future Cache                           │
│                                                                             │
│  Save to Supabase Database:                                                 │
│  ├─ Video details                                                           │
│  ├─ Transcript                                                              │
│  ├─ Analysis/Summary                                                        │
│  └─ Ratings & metadata                                                      │
│                                                                             │
│  Save to Pinecone Vector Cache:                                             │
│  ├─ Generate embedding from transcript + summary                            │
│  ├─ Store vector with metadata                                              │
│  ├─ Namespace: 'resources'                                                  │
│  └─ Next similar query will find this video!                                │
│                                                                             │
│  Now this video is cached for future searches                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                     Step 8: Return Response                                 ║
║                                                                            ║
║  BOTH paths converge here                                                  ║
║                                                                            ║
║  Response Object:                                                          ║
║  {                                                                         ║
║    success: true,                                                          ║
║    video: {                          ← Single best video                   ║
║      rank: 1,                                                              ║
║      video_id: "vid1",                                                     ║
║      url: "https://youtube.com/...",                                       ║
║      title: "Reynolds Number Explained",                                   ║
║      summary: "...",                                                       ║
║      similarity_score: 0.85,          ← Cache match score                  ║
║      profile_match_score: 0.92        ← Grok ranking score                 ║
║    },                                                                      ║
║    ranked_videos: [                  ← ALL videos for cycling             ║
║      { rank: 1, video_id: "vid1", ... },                                   ║
║      { rank: 2, video_id: "vid2", ... },                                   ║
║      { rank: 3, video_id: "vid3", ... },                                   ║
║      { rank: 4, video_id: "vid4", ... },                                   ║
║      { rank: 5, video_id: "vid5", ... }                                    ║
║    ],                                                                      ║
║    source: "cache",                 ← Or "fresh_search"                    ║
║    stats: {                                                                ║
║      videos_searched: 5,                                                   ║
║      videos_analyzed: 5,                                                   ║
║      videos_stored: 5,                                                     ║
║      cache_hits: 5                  ← If from cache                        ║
║    }                                                                       ║
║  }                                                                         ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║              Step 9: FRONTEND - Display Best Video                         ║
║                                                                            ║
║  ┌───────────────────────────────────────────────────────────────────┐    ║
║  │  Reynolds Number Explained                             [↻] [x]   │    ║
║  │                                                                   │    ║
║  │  ┌─────────────────────────────────────────────────────────────┐ │    ║
║  │  │  [YouTube Thumbnail Image - clickable]                    │ │    ║
║  │  │  (Click to open YouTube in new tab)                       │ │    ║
║  │  └─────────────────────────────────────────────────────────────┘ │    ║
║  │                                                                   │    ║
║  │  Channel: Professor Physics                                      │    ║
║  │  Duration: 12:34                                                 │    ║
║  │  Rating: ⭐⭐⭐⭐☆ (4.8/5 from 250 ratings)                    │    ║
║  │                                                                   │    ║
║  │  Summary:                                                         │    ║
║  │  "Comprehensive explanation of Reynolds number in fluid         │    ║
║  │   mechanics, covering both the theoretical foundation and        │    ║
║  │   practical applications in engineering."                        │    ║
║  │                                                                   │    ║
║  └───────────────────────────────────────────────────────────────────┘    ║
║                                                                            ║
║  UI Notes:                                                                 ║
║  ├─ Reroll Button [↻]: Click to cycle to next video                       ║
║  ├─ Close Button [x]: Click to close explainer                            ║
║  └─ Thumbnail: Click to open YouTube                                      ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║              Step 10: USER INTERACTION - Video Cycling                     ║
║                                                                            ║
║  Current state:                                                            ║
║  ├─ rankedVideos: [Video1, Video2, Video3, Video4, Video5]               ║
║  ├─ currentVideoIndex: 0                                                   ║
║  └─ displaying: Video1 (best match)                                        ║
║                                                                            ║
║  OPTION A: User clicks [↻] Reroll Button                                   ║
║  ├─ Check: rankedVideos.length > 1? YES                                    ║
║  ├─ Calculate: nextIndex = (0 + 1) % 5 = 1                                 ║
║  ├─ Update: currentVideoIndex = 1                                          ║
║  ├─ Display: Video2 "Fluid Mechanics 101"                                  ║
║  ├─ Save to DB: Persist new selection                                      ║
║  └─ Animation: Smooth transition to new video                              ║
║                                                                            ║
║  User clicks [↻] again:                                                    ║
║  ├─ nextIndex = (1 + 1) % 5 = 2                                             ║
║  ├─ Display: Video3 "Laminar vs Turbulent"                                 ║
║  └─ ... continues cycling through all 5                                    ║
║                                                                            ║
║  When reaching end (Video5):                                               ║
║  ├─ nextIndex = (4 + 1) % 5 = 0                                             ║
║  ├─ Cycles BACK to Video1                                                  ║
║  └─ Infinite cycling enabled!                                              ║
║                                                                            ║
║  OPTION B: User clicks [x] Close                                           ║
║  ├─ Save final selection to DB                                             ║
║  ├─ Remove explainer bubble from canvas                                    ║
║  └─ End of flow                                                            ║
║                                                                            ║
║  OPTION C: User clicks thumbnail                                           ║
║  ├─ Extract YouTube video ID from URL                                      ║
║  ├─ Open YouTube in new tab/window                                         ║
║  └─ User watches video                                                     ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## Timeline Comparison

### Cache Hit Scenario
```
User clicks term
    │
    ├─ [0.0-1.0s]   Generate queries (Claude)
    ├─ [1.0-1.5s]   User selects query
    ├─ [1.5-2.0s]   Generate profile (Claude)
    ├─ [2.0-2.5s]   Create embedding
    ├─ [2.5-3.5s]   Search Pinecone
    ├─ [3.5-4.5s]   Fetch video details
    └─ [4.5-6.5s]   Rank with Grok
            │
            ▼
    [TOTAL: ~5-6 seconds] ✓ FAST
            │
            ▼
    Video appears on screen!
```

### Cache Miss Scenario
```
User clicks term
    │
    ├─ [0.0-1.0s]   Generate queries (Claude)
    ├─ [1.0-1.5s]   User selects query
    ├─ [1.5-2.0s]   Generate profile (Claude)
    ├─ [2.0-2.5s]   Create embedding
    ├─ [2.5-3.5s]   Search Pinecone (cache miss)
    ├─ [3.5-6.0s]   Search YouTube
    ├─ [6.0-9.0s]   Get transcripts
    ├─ [9.0-14.0s]  Analyze videos (Grok)
    ├─ [14.0-16.0s] Rank with Grok
    ├─ [16.0-17.0s] Store in database
    └─ [17.0-18.0s] Store in Pinecone cache
            │
            ▼
    [TOTAL: ~15-20 seconds] ⚠️ SLOW
            │
            ▼
    Video appears on screen!
    (Now cached for future queries)
```

---

## Key Performance Factors

| Factor | Impact | Time |
|--------|--------|------|
| Claude Profile Generation | Determines cache match quality | 1 sec |
| Embedding Generation | Enables vector search | 0.5 sec |
| Pinecone Search | Finds cached videos | 0.5 sec |
| Grok Ranking | Determines video quality | 2-3 sec |
| YouTube Search | Only on cache miss | 2-3 sec |
| Transcript Extraction | Only on cache miss | 3-5 sec |
| Video Analysis | Only on cache miss | 3-5 sec |
| Cache Storage | Future queries benefit | 1-2 sec |

---

## Success Criteria (How You Know It's Working)

✅ **Cache Hit**
- Response in ~5-6 seconds
- Source: "cache"
- Multiple videos available for cycling
- No YouTube search logs

✅ **Fresh Search**
- Response in ~15-20 seconds
- Source: "fresh_search"
- Videos stored in Pinecone
- Similar future queries will be faster

✅ **Video Cycling**
- Click reroll button
- Next video appears instantly
- Can cycle through all videos above threshold
- Selection persists after page reload

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Videos take too long | Cache miss (first time) | Wait 15-20s or increase min_similarity |
| Only 1 video shows | All others below threshold | Lower min_similarity parameter |
| Can't reroll | < 2 videos in ranked_videos | Search returns insufficient results |
| Same videos repeatedly | Cache too aggressive | Lower min_similarity to 0.60 |
| Wrong videos returned | Poor profile generation | Check context/query clarity |

