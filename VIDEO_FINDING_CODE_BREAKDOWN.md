# Video Finding Process - Code Component Breakdown

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                               │
│                   src/components/ExplainerOverlay.jsx                   │
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐                   │
│  │ Generate AI Queries  │  │ Fetch Videos         │                   │
│  │ (Query Selection UI) │  │ (Video Display UI)   │                   │
│  │                      │  │                      │                   │
│  │ generateQueries()    │  │ fetchVideos()        │                   │
│  │ useEffect hook       │  │ useEffect hook       │                   │
│  │                      │  │                      │                   │
│  └──────────┬───────────┘  └──────────┬───────────┘                   │
│             │                         │                                │
│             └────────────────────┬────┘                                │
│                                  │                                     │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │
                    (REST API Calls via Supabase)
                                   │
        ┌──────────────────────────┼──────────────────────────┐          
        │                          │                          │          
        ▼                          ▼                          ▼          
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐
│ generate-video-      │  │ find-videos-sandbox  │  │ other functions  │
│ queries              │  │ (Main orchestrator)  │  │                  │
│                      │  │                      │  │                  │
│ supabase/functions/  │  │ supabase/functions/  │  │                  │
│ generate-video-      │  │ find-videos-sandbox/ │  │                  │
│ queries/index.ts     │  │ index.ts             │  │                  │
│                      │  │                      │  │                  │
│ • Takes: term,       │  │ • Takes: term,       │  │                  │
│   context            │  │   query, context     │  │                  │
│                      │  │ • Returns: video(s)  │  │                  │
│ • Uses: Claude       │  │ • Uses: Claude,      │  │                  │
│   Haiku 3.5          │  │   Pinecone, Grok,    │  │                  │
│                      │  │   YouTube, Supabase  │  │                  │
│ • Returns: 5         │  │                      │  │                  │
│   queries            │  │                      │  │                  │
└──────────────────────┘  └────────────┬─────────┘  └──────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
            ▼                          ▼                          ▼
    ┌──────────────────┐    ┌──────────────────┐    ┌───────────────────┐
    │ SHARED UTILITIES │    │ EXTERNAL SERVICES│    │ DATABASES         │
    │                  │    │                  │    │                   │
    │ supabase-client  │    │ Pinecone Vector  │    │ Supabase Tables:  │
    │ embeddings       │    │ DB               │    │ • videos          │
    │ youtube-helpers  │    │                  │    │ • resources       │
    │ video-storage    │    │ OpenAI (Embeddings)    │ • blueprint_      │
    │ video-analyzer   │    │                  │    │   video_rankings  │
    │                  │    │ Grok 2 (xAI)     │    │                   │
    │                  │    │                  │    │ Cache:            │
    │                  │    │ YouTube (Apify)  │    │ • Pinecone        │
    │                  │    │                  │    │ • Database        │
    │                  │    │ SupaData         │    │                   │
    │                  │    │ (Transcripts)    │    │                   │
    └──────────────────┘    └──────────────────┘    └───────────────────┘
```

---

## File Structure

```
supabase/functions/
├── find-videos-sandbox/
│   └── index.ts                          ← MAIN ORCHESTRATOR
│
├── generate-video-queries/
│   └── index.ts                          ← QUERY GENERATOR
│
├── _shared/
│   ├── supabase-client.ts               ← Supabase & Claude calls
│   ├── embeddings.ts                    ← Vector generation
│   ├── youtube-helpers.ts               ← YouTube & Transcript APIs
│   ├── video-storage.ts                 ← Pinecone & DB operations
│   ├── video-analyzer.ts                ← Grok analysis
│   ├── pinecone-client.ts               ← Pinecone vector DB
│   └── cors.ts                          ← CORS headers
│
src/
└── components/
    └── ExplainerOverlay.jsx             ← FRONTEND DISPLAY
```

---

## Function Call Chain

### Initial Query Generation

```
ExplainerOverlay.jsx
    │
    └─ useEffect (on component mount)
        │
        └─ generateQueries()
            │
            └─ supabase.functions.invoke('generate-video-queries', {
                body: {
                  term: "Reynolds number",
                  context: "Fluid Mechanics",
                  solutionContext: "..."
                }
              })
                │
                ▼
            find-videos-sandbox/index.ts
                │
                ├─ generateTargetResourceProfile()
                │   └─ callClaude() [Claude Haiku 3.5]
                │
                └─ Return: { success: true, queries: [...] }
                    │
                    ▼
            ExplainerOverlay.jsx
                │
                └─ setGeneratedQueries(data.queries)
                    │
                    ▼
                Display 5 query buttons to user
```

### Video Search

```
ExplainerOverlay.jsx
    │
    └─ User clicks query option
        │
        ├─ setSelectedQuery(query)
        │
        └─ useEffect (on selectedQuery change)
            │
            └─ fetchVideos()
                │
                └─ supabase.functions.invoke('find-videos-sandbox', {
                    body: {
                      term: "Reynolds number",
                      selected_query: "What is Reynolds number...",
                      unit_topic: "Fluid Mechanics",
                      min_similarity: 0.65
                    }
                  })
                    │
                    ▼
                find-videos-sandbox/index.ts (Main Handler)
                    │
                    ├─ STEP 1: generateTargetResourceProfile()
                    │   └─ callClaude() → Profile string
                    │
                    ├─ STEP 2: Check Cache
                    │   │
                    │   ├─ generateEmbedding(profile)
                    │   │   └─ OpenAI text-embedding-3-large
                    │   │
                    │   ├─ searchVideosByEmbedding()
                    │   │   ├─ queryVectors() [Pinecone]
                    │   │   └─ Filter by similarity >= 0.65
                    │   │
                    │   └─ DECISION:
                    │       ├─ Cache hit? → Path 5A
                    │       └─ Cache miss? → Path 5B
                    │
                    ├─ STEP 5A (CACHE HIT):
                    │   ├─ getVideoFromSupabase() × N
                    │   └─ rankVideosByProfileWithGrok()
                    │       └─ callClaudeJSON() [Grok 2/xAI]
                    │
                    ├─ STEP 5B (CACHE MISS):
                    │   ├─ searchYouTubeWithApify()
                    │   ├─ analyzeVideosBatch()
                    │   │   ├─ getTranscriptWithSupaData()
                    │   │   └─ analyzeTranscriptWithGrok()
                    │   ├─ rankVideosByProfileWithGrok()
                    │   ├─ storeAnalyzedVideos()
                    │   └─ storeVideosInPinecone()
                    │
                    └─ STEP 6: Return Response
                        {
                          success: true,
                          video: {...},           ← Best match
                          ranked_videos: [...],  ← All for cycling
                          source: "cache" | "fresh_search"
                        }
                        │
                        ▼
            ExplainerOverlay.jsx
                │
                ├─ setRankedVideos(data.ranked_videos)
                ├─ setCurrentVideoIndex(0)
                └─ Display best video on screen
```

### Video Cycling

```
ExplainerOverlay.jsx
    │
    └─ User clicks [↻] Reroll button
        │
        └─ handleReroll(e)
            │
            ├─ Check: rankedVideos.length > 1?
            │   └─ Yes: Continue
            │
            ├─ nextIndex = (currentVideoIndex + 1) % rankedVideos.length
            │
            ├─ setCurrentVideoIndex(nextIndex)
            │
            ├─ currentVideo = rankedVideos[nextIndex]
            │
            ├─ updateExplainer()
            │   └─ Save to database via Supabase
            │
            └─ Re-render: Display new video instantly
```

---

## Key Helper Functions Explained

### 1. generateTargetResourceProfile()

**Purpose**: Create AI description of ideal video

```typescript
// INPUT
term: "Reynolds number"
selectedQuery: "What is Reynolds number in fluid mechanics?"
context: "Fluid Mechanics"
problemText: "Calculate Reynolds number for water flowing..."

// PROCESS
callClaude(systemPrompt, userPrompt)
  ├─ System: "You are an expert educational content curator..."
  ├─ User: "Create a target resource profile for: term + query + context"
  └─ Claude response: Structured description

// OUTPUT
"This video explains Reynolds number as a dimensionless quantity..."
```

### 2. searchVideosByEmbedding()

**Purpose**: Search Pinecone for cached videos

```typescript
// INPUT
queryText: (target resource profile)
topK: 15

// PROCESS
generateEmbedding(queryText)
  └─ Text → 1536-dim vector

queryVectors(vector, 15, ...)
  ├─ Query Pinecone index
  ├─ Namespace: 'resources'
  └─ Include metadata: YES

// OUTPUT
[
  { id: "vid1", score: 0.85, metadata: {...} },
  { id: "vid2", score: 0.78, metadata: {...} },
  ...
]
```

### 3. rankVideosByProfileWithGrok()

**Purpose**: AI ranking of videos against profile

```typescript
// INPUT
videos: [
  { video_id: "vid1", title: "...", transcript: "...", summary: "..." },
  { video_id: "vid2", title: "...", ... },
  ...
]
targetProfile: (profile string from Claude)

// PROCESS
For each video:
  ├─ Create ranking prompt
  ├─ Ask Grok: "How well does this match our profile?"
  └─ Extract score

// OUTPUT
[
  { video_id: "vid1", rank: 1, score: 0.92 },
  { video_id: "vid2", rank: 2, score: 0.87 },
  ...
]
```

### 4. analyzeVideosBatch()

**Purpose**: Get transcripts and analyze videos

```typescript
// INPUT
videos: (ApifyVideo objects from YouTube)
count: 5 (max to analyze)
tokenLimit: 1000
includeFull: false

// PROCESS
For each video:
  ├─ getTranscriptWithSupaData()
  │   └─ Extract from YouTube/SupaData
  ├─ Truncate to tokenLimit
  ├─ analyzeTranscriptWithGrok()
  │   └─ Grok creates summary/analysis
  └─ Return AnalyzedVideo object

// OUTPUT
[
  { videoId: "...", title: "...", transcript: "...", analysis: {...} },
  ...
]
```

### 5. storeAnalyzedVideos()

**Purpose**: Save videos to Supabase

```typescript
// INPUT
supabase: Client
analyzedVideos: [...]

// PROCESS
For each video:
  ├─ Check if video exists
  └─ If not: INSERT into 'videos' table
      ├─ video_id
      ├─ title
      ├─ url
      ├─ transcript
      ├─ summary
      ├─ channel_name
      ├─ etc.

// OUTPUT
Stored count (number successfully saved)
```

### 6. storeVideosInPinecone()

**Purpose**: Cache videos in vector database

```typescript
// INPUT
videos: [...]
batchSize: 10

// PROCESS
For each video:
  ├─ Create embedding text (title + summary + transcript)
  ├─ generateEmbedding(text)
  ├─ Create vector record with metadata
  └─ Batch upsert to Pinecone

// OUTPUT
Success count (number stored)
```

---

## Data Types Summary

### Request Types

```typescript
interface FindVideosSandboxRequest {
  term: string;                  // e.g., "Reynolds number"
  selected_query: string;        // User's selected search query
  unit_topic?: string;           // Learning context
  problem_text?: string;         // Problem context
  blueprint_id?: string;         // For tracking
  min_similarity?: number;       // Cache threshold (0.65 default)
  force_refresh?: boolean;       // Skip cache
}

interface GenerateVideoQueriesRequest {
  term: string;
  context: string;
  solutionContext?: string;
}
```

### Response Types

```typescript
interface FindVideosSandboxResponse {
  success: boolean;
  video?: RankedVideo;           // Best match
  ranked_videos?: RankedVideo[]; // All videos for cycling
  target_resource_profile?: string;
  source: 'cache' | 'fresh_search';
  stats?: {
    videos_searched: number;
    videos_analyzed: number;
    videos_stored: number;
    cache_hits: number;
  };
  debug?: {
    target_resource_profile: string;
    search_method: string;
  };
  error?: string;
}

interface RankedVideo {
  rank: number;
  video_id: string;
  url: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  duration_seconds: number;
  summary: string;
  description?: string;
  average_rating?: number;
  rating_count?: number;
  similarity_score?: number;    // Pinecone match score
  profile_match_score?: number; // Grok ranking score
}
```

---

## API Services Used

| Service | Purpose | Call Freq | Cost |
|---------|---------|-----------|------|
| **Claude Haiku 3.5** | Profile generation, query generation | 1-2× per search | ~$0.01/search |
| **OpenAI Embeddings** | Vector generation | 1-2× per search | ~$0.0001/search |
| **Pinecone** | Vector similarity search | 1× per search | ~$0.01/search |
| **Grok 2 (xAI)** | Video analysis & ranking | 2-5× per search | ~$0.05/search |
| **YouTube (Apify)** | Search, metadata | 1× on cache miss | ~$0.10/search |
| **SupaData** | Transcript extraction | 1-5× on cache miss | ~$0.05/search |
| **Supabase** | Database operations | 10-20× per search | ~$0.001/search |

---

## Performance Bottlenecks & Optimizations

```
Bottleneck                  → Solution
─────────────────────────────────────────────────
Generating profile slowly   → Use faster Claude model
Pinecone search slow        → Increase timeout, use smaller vectors
YouTube search slow         → Cache results aggressively
Transcript extraction slow  → Use cached transcripts
Grok ranking slow           → Batch process, use async
Database writes slow        → Use bulk operations
Embedding generation slow   → Use 3072-dim (we use 1536)
                            → Pre-generate common searches
```

---

## Debug Mode

When debugging, check these console logs:

```
[Sandbox] Request received
[Sandbox] Generating target resource profile...
[Sandbox] Generated Profile: "..."
[Sandbox] STEP 2: CACHE LOOKUP
[Storage] CACHE LOOKUP STARTED
[Storage] Query text (first 100 chars): "..."
[Storage] Generating query embedding...
[Storage] Querying Pinecone index...
[Storage] Pinecone returned X matches
[Storage] Top matches:
  1. "..." - Similarity: 0.85
  2. "..." - Similarity: 0.78
  ...

[Sandbox] Cache search returned X results
[Sandbox] X results above 0.65 threshold
[Sandbox] ✓ CACHE HIT! Fetching video details...
[Sandbox] Grok ranked X videos
[Sandbox] Returning X cached videos

OR

[Sandbox] STEP 3: FRESH YOUTUBE SEARCH
[Sandbox] Searching YouTube with query: "..."
[Sandbox] Found X videos from YouTube (filtered from Y)
[Sandbox] Analyzing videos...
[Sandbox] Analyzed X videos
[Sandbox] Storing videos...
[Sandbox] Storing videos in Pinecone...

[Sandbox] Complete!
[Sandbox] Source: cache
[Sandbox] Ranked videos: 5
[Sandbox] Best match: "Reynolds Number Explained"
```

---

## Common Configuration Values

```typescript
// Similarity & Ranking
const MIN_SIMILARITY = 0.65;           // Cache hit threshold
const PINECONE_TOP_K = 15;             // Results to fetch from cache
const TOP_VIDEOS_TO_RETURN = 5;        // Max videos to return (NOW: all!)

// Duration Constraints
const MIN_VIDEO_DURATION = 120;        // 2 minutes
const MAX_VIDEO_DURATION = 2700;       // 45 minutes

// Batch Processing
const BATCH_SIZE = 5;                  // Videos to analyze per batch
const TOKEN_LIMIT = 1000;              // Chars per transcript

// Timeouts
const FUNCTION_TIMEOUT = 120000;       // 2 minutes
const PINECONE_TIMEOUT = 30000;        // 30 seconds
const YOUTUBE_TIMEOUT = 30000;         // 30 seconds

// Namespaces
const PINECONE_NAMESPACE = 'resources';
const SUPABASE_TABLE = 'videos';
```

