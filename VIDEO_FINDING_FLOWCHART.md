# Video Finding Process - Complete Flowchart

## High-Level Overview

```
USER CLICKS EXPLAINER TERM
        ↓
┌─────────────────────────────────────────────────────────┐
│                 FRONTEND (React)                        │
│  src/components/ExplainerOverlay.jsx                    │
└─────────────────────────────────────────────────────────┘
        ↓
    STEP 1: Generate Query Options (5 options)
        ↓
    User Selects 1 Query from 5 Options
        ↓
    STEP 2: Search for Videos with Selected Query
        ↓
┌─────────────────────────────────────────────────────────┐
│         BACKEND (Edge Functions - Deno)                 │
│  supabase/functions/find-videos-sandbox/index.ts        │
└─────────────────────────────────────────────────────────┘
        ↓
    STEP 3: Generate Target Resource Profile
        ↓
    STEP 4: Check Cache (Pinecone)
        ↓
    ┌─────────────────┐  ┌──────────────────┐
    │  CACHE HIT?     │  │ CACHE MISS?      │
    │  (Fast Path)    │  │ (Slow Path)      │
    └─────────────────┘  └──────────────────┘
    ↓                    ↓
STEP 5a:               STEP 5b:
Rank Cached Videos    Search YouTube Fresh
↓                     ↓
Return All Videos     Analyze Videos
↓                     ↓
                      Rank Videos
                      ↓
                      Store in Cache
                      ↓
                      Return Videos
    ↓                    ↓
    └────────────────────┘
           ↓
    STEP 6: Return to Frontend
        ↓
┌─────────────────────────────────────────────────────────┐
│           FRONTEND (Display & Cycling)                  │
│           ExplainerOverlay.jsx                          │
└─────────────────────────────────────────────────────────┘
        ↓
    Show Best Video
        ↓
    User Can:
    ├─ Watch Video
    ├─ Cycle to Next Video (Reroll Button)
    └─ Close Explainer
```

---

## Detailed Step-by-Step Process

### PHASE 1: FRONTEND - QUERY GENERATION (Synchronous UI)

```
┌─ TRIGGER: User clicks on an explainer term (e.g., "Reynolds number")
│
├─ State: ExplainerOverlay component initializes
│   ├ term: "Reynolds number"
│   ├ context: "Fluid Mechanics"
│   ├ type: "video"
│   └ blueprintId: "abc123"
│
└─ useEffect Hook Fires:
   │
   ├─ Check: Is type === 'video'?
   │   └─ YES → Continue
   │
   ├─ Check: Already generated queries?
   │   └─ NO → Continue
   │
   └─ Call: generate-video-queries Edge Function
      │
      ├─ Input:
      │   ├ term: "Reynolds number"
      │   ├ context: "Fluid Mechanics"
      │   └ solutionContext: (optional)
      │
      └─ Edge Function generates 5 query options using Claude
         │
         ├─ Query 1: "What is Reynolds number in fluid mechanics?"
         ├─ Query 2: "How to calculate Reynolds number?"
         ├─ Query 3: "Reynolds number significance in pipe flow"
         ├─ Query 4: "Reynolds number laminar vs turbulent"
         └─ Query 5: "Applications of Reynolds number in engineering"
         │
         └─ Return: Array of 5 queries to frontend

┌─ DISPLAY: Show 5 query buttons to user
│
└─ WAIT: User clicks one query option
```

---

### PHASE 2: FRONTEND → BACKEND - VIDEO SEARCH REQUEST

```
┌─ TRIGGER: User clicks selected query
│   └─ Example: "What is Reynolds number in fluid mechanics?"
│
├─ Update State:
│   └─ selectedQuery = "What is Reynolds number in fluid mechanics?"
│
├─ Invoke find-videos-sandbox Edge Function
│  │
│  └─ Request Payload:
│      ├ term: "Reynolds number"
│      ├ selected_query: "What is Reynolds number in fluid mechanics?"
│      ├ unit_topic: "Fluid Mechanics"
│      ├ problem_text: (optional context from problem)
│      ├ blueprint_id: "abc123"
│      └ min_similarity: 0.65 (default)
│
└─ UI Shows: Loading spinner
    └─ Wait for response...
```

---

### PHASE 3: BACKEND - STEP 1: GENERATE TARGET RESOURCE PROFILE

```
┌─ RECEIVE: Request in find-videos-sandbox
│
├─ INPUT PARAMS:
│   ├ term: "Reynolds number"
│   ├ selected_query: "What is Reynolds number in fluid mechanics?"
│   ├ unit_topic: "Fluid Mechanics"
│   └ problem_text: (context)
│
├─ STEP 1A: Call Claude Haiku 3.5 to generate Target Resource Profile
│   │
│   ├─ System Prompt: "You are an expert educational content curator..."
│   │
│   ├─ User Prompt:
│   │   ├ Term: Reynolds number
│   │   ├ Question: What is Reynolds number in fluid mechanics?
│   │   ├ Context: Fluid Mechanics
│   │   └ Problem Context: (if applicable)
│   │
│   └─ Claude Output (Target Resource Profile):
│       └─ "This video explains Reynolds number as a dimensionless quantity
│          that determines the flow regime (laminar vs turbulent) in fluid
│          dynamics. It covers the Re = ρVD/μ formula, its physical meaning,
│          critical thresholds, and practical applications in pipe flow and
│          heat transfer analysis."
│
├─ STEP 1B: Log the profile for debugging
│   └─ Console Output: "[Sandbox] Generated Profile: ..."
│
└─ CONTINUE TO STEP 2
```

---

### PHASE 4: BACKEND - STEP 2: CACHE LOOKUP (FAST PATH)

```
┌─ STEP 2: CHECK CACHE IN PINECONE
│
├─ Generate Embedding from Target Resource Profile
│   ├─ Text: (the profile we just generated)
│   ├─ Model: text-embedding-3-large
│   ├─ Dimensions: 1536
│   └─ Output: Vector [0.123, -0.456, ..., 0.789]
│
├─ Search Pinecone Vector Database
│   ├─ Query: Vector from profile
│   ├─ Top K: 15 results
│   ├─ Namespace: 'resources'
│   ├─ Include Metadata: YES
│   │
│   └─ Pinecone Returns:
│       ├ Match 1: { id: vid1, score: 0.85, metadata: {...} }
│       ├ Match 2: { id: vid2, score: 0.78, metadata: {...} }
│       ├ Match 3: { id: vid3, score: 0.72, metadata: {...} }
│       ├ Match 4: { id: vid4, score: 0.68, metadata: {...} }
│       ├ Match 5: { id: vid5, score: 0.65, metadata: {...} }
│       ├ Match 6: { id: vid6, score: 0.62, metadata: {...} }
│       ├ Match 7: { id: vid7, score: 0.58, metadata: {...} }
│       └─ ... 8-15 (lower scores)
│
├─ Filter by Minimum Similarity (default: 0.65)
│   ├ Keep matches with score >= 0.65
│   │
│   ├─ Valid Results:
│   │  ├ Match 1: score 0.85 ✓
│   │  ├ Match 2: score 0.78 ✓
│   │  ├ Match 3: score 0.72 ✓
│   │  ├ Match 4: score 0.68 ✓
│   │  └─ Match 5: score 0.65 ✓
│   │
│   └─ Discarded: Matches 6-15 (below 0.65 threshold)
│
├─ COUNT: 5 results above threshold
│
└─ DECISION POINT:
    │
    ├─ Found 5+ videos above threshold?
    │  └─ YES → CACHE HIT! Go to PHASE 5A (Fast Path)
    │
    └─ No videos above threshold?
       └─ NO → CACHE MISS! Go to PHASE 5B (Slow Path)
```

---

### PHASE 5A: BACKEND - CACHE HIT PATH (FAST)

```
┌─ CACHE HIT DETECTED
│  └─ Console: "[Sandbox] ✓ CACHE HIT! Fetching video details..."
│
├─ STEP 5A-1: Fetch Full Video Details from Supabase
│   ├─ Get video IDs from cache results: [vid1, vid2, vid3, vid4, vid5]
│   │
│   ├─ Query supabase 'videos' table for each ID
│   │   └─ Retrieve: title, url, transcript, summary, rating, etc.
│   │
│   └─ Result:
│       ├ Video 1: { id: vid1, title: "Reynolds Number Explained", url: "...", ... }
│       ├ Video 2: { id: vid2, title: "Fluid Mechanics 101", url: "...", ... }
│       ├ Video 3: { id: vid3, title: "Laminar vs Turbulent", url: "...", ... }
│       ├ Video 4: { id: vid4, title: "Re in Pipe Flow", url: "...", ... }
│       └─ Video 5: { id: vid5, title: "Dimensionless Numbers", url: "...", ... }
│
├─ STEP 5A-2: Rank Videos Using Grok (Ranking AI)
│   ├─ Input: Videos + Target Resource Profile
│   │
│   ├─ Grok evaluates each video:
│   │   ├ "How well does this video match our profile?"
│   │   ├ "Does it explain Reynolds number fundamentals?"
│   │   ├ "Does it cover the physical meaning?"
│   │   └─ "Does it include practical applications?"
│   │
│   └─ Output (Ranking Scores):
│       ├ Video 1: Rank 1, Score 0.92 (BEST MATCH)
│       ├ Video 2: Rank 2, Score 0.87
│       ├ Video 3: Rank 3, Score 0.81
│       ├ Video 4: Rank 4, Score 0.76
│       └─ Video 5: Rank 5, Score 0.71
│
├─ STEP 5A-3: Format Response (NOW RETURNS ALL VIDEOS)
│   ├─ Map rankings back to full video data
│   │
│   ├─ Build RankedVideo objects with all fields:
│   │   ├ rank: (from Grok)
│   │   ├ video_id: (from database)
│   │   ├ url: (from database)
│   │   ├ title: (from database)
│   │   ├ similarity_score: (from Pinecone)
│   │   ├ profile_match_score: (from Grok)
│   │   └─ ... other fields
│   │
│   └─ Result Array: ALL 5 videos (not just top 5!)
│
└─ SKIP TO STEP 6 (Return Response)
```

---

### PHASE 5B: BACKEND - CACHE MISS PATH (SLOW)

```
┌─ CACHE MISS DETECTED
│  └─ Console: "[Sandbox] Cache MISS - no videos above similarity threshold"
│
├─ STEP 5B-1: YouTube Search
│   ├─ Search Query: "What is Reynolds number in fluid mechanics?"
│   │
│   ├─ Use Apify API to search YouTube
│   │   └─ Get top results from YouTube
│   │
│   └─ Result:
│       ├ Video A: "Reynolds Number Explained" (Duration: 12 min)
│       ├ Video B: "Fluid Flow Basics" (Duration: 8 min)
│       ├ Video C: "Advanced CFD" (Duration: 45 min)
│       ├ Video D: "Quick Physics Review" (Duration: 1 min)
│       └─ ... more videos
│
├─ STEP 5B-2: Filter by Duration (2-45 minutes)
│   ├─ Too short (< 2 min): "Quick Physics Review" ✗
│   ├─ Too long (> 45 min): None in this example
│   │
│   ├─ Valid videos:
│   │  ├ Video A: 12 min ✓
│   │  ├ Video B: 8 min ✓
│   │  ├ Video C: 45 min ✓ (exactly at limit)
│   │  └─ ... others
│   │
│   └─ Result: 5-10 videos to analyze
│
├─ STEP 5B-3: Get Transcripts from SupaData
│   ├─ For each video, fetch transcript
│   │
│   ├─ Extract from YouTube captions/third-party service
│   │
│   └─ Store transcript with video data
│
├─ STEP 5B-4: Analyze Videos with Grok
│   ├─ For each video:
│   │   ├ Video ID
│   │   ├ Title
│   │   ├ Transcript (first 1000 chars)
│   │   └─ Channel info
│   │
│   ├─ Grok passes: Generates summary/analysis
│   │
│   └─ Output:
│       ├ Video A: { summary: "...", topics: [...], ... }
│       ├ Video B: { summary: "...", topics: [...], ... }
│       └─ ... etc
│
├─ STEP 5B-5: Rank Videos Using Grok (Against Profile)
│   ├─ Input: Analyzed videos + Target Resource Profile
│   │
│   ├─ Grok ranks by profile match
│   │
│   └─ Output:
│       ├ Video A: Rank 1, Score 0.89
│       ├ Video B: Rank 2, Score 0.84
│       ├ Video C: Rank 3, Score 0.78
│       └─ ... etc
│
├─ STEP 5B-6: Store Videos in Database & Cache
│   ├─ Save to 'videos' table in Supabase
│   │   └─ video_id, title, url, transcript, summary, etc.
│   │
│   └─ Store in Pinecone for future cache hits
│       ├─ Vector: Generated from transcript + summary
│       ├─ Metadata: video_id, title, channel, etc.
│       └─ Namespace: 'resources'
│
└─ CONTINUE TO STEP 6
```

---

### PHASE 6: BACKEND - RETURN RESPONSE

```
┌─ Both paths (cache hit or fresh search) converge here
│
├─ STEP 6: Format Final Response
│   │
│   ├─ Response Object:
│   │   ├ success: true
│   │   ├ video: rankedVideos[0]    (Best match for immediate display)
│   │   ├ ranked_videos: [...]       (All videos for cycling)
│   │   ├ source: 'cache' OR 'fresh_search'
│   │   ├ target_resource_profile: "..." (for debugging)
│   │   ├ stats: {
│   │   │   ├ videos_searched: 5
│   │   │   ├ videos_analyzed: 5
│   │   │   ├ videos_stored: 5
│   │   │   └─ cache_hits: (if applicable)
│   │   └─ }
│   │
│   └─ Log Summary:
│       ├ "[Sandbox] Complete!"
│       ├ "Source: cache"
│       ├ "Ranked videos: 5"
│       └─ "Best match: Reynolds Number Explained"
│
└─ Send Response Back to Frontend
   └─ HTTP 200 OK + JSON Payload
```

---

### PHASE 7: FRONTEND - DISPLAY & INTERACTION

```
┌─ RECEIVE: Response from find-videos-sandbox
│
├─ Parse Response:
│   ├ video: { id: "vid1", title: "Reynolds Number Explained", url: "...", ... }
│   └─ ranked_videos: [ video1, video2, video3, video4, video5 ]
│
├─ Update State:
│   ├ setVideos([...])
│   ├ setRankedVideos([...])
│   ├ setCurrentVideoIndex(0)  ← Start at best match
│   └─ setIsLoadingVideos(false)
│
├─ DISPLAY: Video Card
│   ├┌────────────────────────────────────────┐
│   ││ "Reynolds Number Explained"       ↻    │  ← Reroll button
│   ││                                         │
│   ││ [YouTube Thumbnail Image]              │
│   ││                                         │
│   ││ Channel: Professor Physics              │
│   ││ Duration: 12:34                         │
│   ││ Rating: ⭐⭐⭐⭐⭐ (4.8/5)             │
│   ││                                         │
│   ││ Summary: "This video explains..."       │
│   ├└────────────────────────────────────────┘
│   │
│   └─ Show current video from ranked_videos[currentVideoIndex]
│
├─ USER INTERACTION OPTIONS:
│
│   Option 1: CLICK THUMBNAIL → Open YouTube in new tab
│   │
│   Option 2: CLICK REROLL BUTTON (↻)
│   │   └─ handleReroll() function:
│   │       ├ Check: rankedVideos.length > 1?
│   │       │
│   │       ├ If YES:
│   │       │   ├ Calculate nextIndex = (currentVideoIndex + 1) % rankedVideos.length
│   │       │   │
│   │       │   ├─ Example with 5 videos:
│   │       │   │  ├ Index 0 → Index 1
│   │       │   │  ├ Index 1 → Index 2
│   │       │   │  ├ Index 2 → Index 3
│   │       │   │  ├ Index 3 → Index 4
│   │       │   │  └─ Index 4 → Index 0 (cycles back)
│   │       │   │
│   │       │   ├─ setCurrentVideoIndex(nextIndex)
│   │       │   │
│   │       │   ├─ Save to Database (persist selection)
│   │       │   │   └─ updateExplainer(id, {
│   │       │   │       cachedVideoData: {
│   │       │   │           rankedVideos: [all videos],
│   │       │   │           currentVideoIndex: nextIndex,
│   │       │   │           selectedQuery: selectedQuery
│   │       │   │       }
│   │       │   │   })
│   │       │   │
│   │       │   └─ UI animates to next video
│   │       │
│   │       └─ If NO:
│   │           └─ Show: "No more videos available"
│   │
│   Option 3: CLOSE EXPLAINER (X button)
│       └─ onClose() → Remove explainer bubble from canvas
│
└─ END OF FLOW
```

---

## Key Metrics & Thresholds

```
┌─ SIMILARITY THRESHOLD (Cache Hit Determination)
│  └─ Default: 0.65 (65% similarity to profile)
│     ├─ Adjustable via min_similarity parameter
│     ├─ Higher = More selective (fewer results)
│     └─ Lower = More permissive (more results)
│
├─ PINECONE SEARCH
│  ├─ Top K Results: 15
│  ├─ Namespace: 'resources'
│  ├─ Include Metadata: YES
│  └─ Vector Dimensions: 1536
│
├─ VIDEO DURATION FILTER
│  ├─ Minimum: 2 minutes (120 seconds)
│  ├─ Maximum: 45 minutes (2700 seconds)
│  └─ Why? Too short = incomplete, Too long = viewer fatigue
│
├─ BATCH ANALYSIS
│  ├─ Videos analyzed per batch: 5
│  ├─ Token limit per video: 1000
│  └─ Concurrency: Controlled via Promise.all()
│
└─ RANKING SCORES
   ├─ Profile Match (Grok): 0.0 - 1.0
   ├─ Similarity (Pinecone): 0.0 - 1.0
   └─ User Rating (Database): 0.0 - 5.0
```

---

## Decision Tree Summary

```
START: User clicks term
├─ Yes, generate queries? → Generate 5 query options
├─ User selects query? → Call find-videos-sandbox
│
├─ CACHE LOOKUP:
│  ├─ Cache hit (5+ videos above 0.65 threshold)?
│  │  ├─ YES → Rank cached videos with Grok
│  │  │        └─ Return all videos (fast, ~2-5 sec)
│  │  │
│  │  └─ NO → Proceed to fresh search
│  │
│  └─ FRESH SEARCH:
│     ├─ Search YouTube
│     ├─ Filter by duration
│     ├─ Get transcripts
│     ├─ Analyze with Grok
│     ├─ Rank with Grok
│     ├─ Store in database & cache
│     └─ Return videos (slower, ~10-30 sec)
│
├─ DISPLAY: Show best video
│
├─ USER REROLLS:
│  └─ Cycle to next video in ranked list (instant)
│
└─ USER CLOSES:
   └─ Remove explainer, save selection
```

---

## Performance Characteristics

```
┌─ CACHE HIT PERFORMANCE (Fast Path)
│  ├─ Generate Profile: ~1 sec (Claude)
│  ├─ Generate Embedding: ~0.5 sec
│  ├─ Pinecone Search: ~0.5 sec
│  ├─ Fetch Details: ~1 sec
│  ├─ Rank with Grok: ~2-3 sec
│  └─ TOTAL: ~5-6 seconds
│
└─ CACHE MISS PERFORMANCE (Slow Path)
   ├─ Generate Profile: ~1 sec
   ├─ Cache search: ~2 sec
   ├─ YouTube search: ~2-3 sec
   ├─ Get transcripts: ~3-5 sec
   ├─ Analyze videos: ~3-5 sec
   ├─ Store in DB: ~1 sec
   ├─ Store in Pinecone: ~1-2 sec
   └─ TOTAL: ~15-20 seconds
```

---

## Data Flow Diagram

```
┌──────────────────┐
│   USER INPUT     │
│  (Click Term)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  generate-video-queries              │
│  (Edge Function - Claude)            │
│  Input: term, context                │
│  Output: 5 query options             │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  DISPLAY QUERY OPTIONS               │
│  User Selects 1 Query                │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  find-videos-sandbox                 │
│  (Edge Function - Multi-step)        │
└────────┬─────────────────────────────┘
         │
    ┌────┴─────┐
    ▼          ▼
CACHE?    NO CACHE?
    │          │
    ▼          ▼
[Fast]    [Slow Path]
Pinecone  YouTube API
    │          │
    ▼          ▼
Grok Rank  Get Transcripts
    │          │
    ▼          ▼
Return       Grok Analyze
    │          │
    ▼          ▼
         Grok Rank
         Store DB/Cache
         Return
    │          │
    └────┬─────┘
         │
         ▼
┌──────────────────────────────────────┐
│  DISPLAY VIDEO                       │
│  ├─ Show Best Match                  │
│  ├─ Ready for Reroll                 │
│  └─ Ready for Cycling                │
└──────────────────────────────────────┘
```

---

## Summary of Key Components

| Component | Purpose | Tech |
|-----------|---------|------|
| **generate-video-queries** | Creates 5 search options | Claude 3.5 Haiku |
| **find-videos-sandbox** | Main search orchestrator | TypeScript/Deno |
| **generateTargetResourceProfile** | Creates AI description of ideal video | Claude 3.5 Haiku |
| **searchVideosByEmbedding** | Semantic search in cache | Pinecone Vector DB |
| **searchYouTubeWithApify** | YouTube search | Apify API |
| **analyzeVideosBatch** | Get transcripts & analyze | SupaData + Grok |
| **rankVideosByProfileWithGrok** | AI ranking | Grok 2 (xAI) |
| **storeAnalyzedVideos** | Save to database | Supabase |
| **ExplainerOverlay** | Display & cycling UI | React |

---

## Next Steps in User Flow

After videos are returned and displayed:

1. **User watches video** → Click thumbnail → YouTube opens in new tab
2. **User cycles videos** → Click reroll button → Next video displays
3. **User rates video** → Star rating system → Saved to database
4. **User closes** → X button → Explainer removed from canvas

All of this enables better learning by giving students multiple perspectives on the same concept!
