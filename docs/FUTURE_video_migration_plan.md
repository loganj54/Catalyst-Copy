# Enhanced Video Analysis Pipeline - Implementation Plan

Complete overhaul of the video discovery system with multi-dimensional categorization, comment-based quality signals, and intelligent search filtering.

**SAVED FOR LATER**: This plan migrates the existing 650 videos. Come back to this after testing the isolated sandbox version.

## Scope Summary

| Component | Action |
|-----------|--------|
| Database schema | Add type scores + comments storage |
| 650 existing videos | Re-analyze for type scores |
| YouTube comments | Scrape, store, and analyze |
| `find-videos` function | Update with type filtering + composite scoring |
| Pinecone metadata | Enrich with type scores |

**Estimated Total Cost: ~$20-25**

---

## Phase 1: Database Schema Updates

### Migration: `add_video_type_scores.sql`

```sql
-- Video type scores (0-1 scale)
ALTER TABLE resources_from_make ADD COLUMN IF NOT EXISTS
  beginner_score REAL DEFAULT NULL,
  visualization_score REAL DEFAULT NULL,
  math_explanation_score REAL DEFAULT NULL,
  real_world_score REAL DEFAULT NULL,
  
  -- AI quality assessment
  ai_quality_score REAL DEFAULT NULL,
  
  -- Engagement tracking
  times_shown INTEGER DEFAULT 0,
  times_clicked INTEGER DEFAULT 0,
  helpful_votes INTEGER DEFAULT 0,
  not_helpful_votes INTEGER DEFAULT 0,
  
  -- Comment data
  comments_scraped_at TIMESTAMPTZ DEFAULT NULL,
  comments_json JSONB DEFAULT NULL,
  comment_analysis JSONB DEFAULT NULL;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_resources_beginner_score ON resources_from_make(beginner_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_resources_visualization_score ON resources_from_make(visualization_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_resources_math_score ON resources_from_make(math_explanation_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_resources_real_world_score ON resources_from_make(real_world_score DESC NULLS LAST);
```

---

## Phase 2: Batch Re-Analysis

### `batch-reanalyze-videos/index.ts`

**Purpose**: Score all 650 existing videos for the 4 type dimensions.

**Input per video**:
- Existing `summary` (~400 tokens)
- Existing `full_content_analysis` (~200 tokens)
- First 500 chars of transcript (~100 tokens)

**AI Prompt** (Grok - $0.50 total):
```
Given this educational video analysis, score it 0-1 on each dimension:

Summary: {summary}
Analysis: {full_content_analysis}
Transcript excerpt: {transcript_excerpt}

Return JSON:
{
  "beginner_score": 0.X,
  "visualization_score": 0.X,
  "math_explanation_score": 0.X,
  "real_world_score": 0.X,
  "ai_quality_score": 0.X,
  "reasoning": "Brief explanation"
}
```

---

## Phase 3: YouTube Comments Integration

### `scrape-video-comments/index.ts`

Store top 50 comments in `comments_json` column to avoid duplicate scraping.

### `analyze-video-comments/index.ts`

Extract quality signals from stored comments.

---

## Phase 4: Enhanced Video Search

Update `find-videos` with:
- Metadata filtering by video type
- Composite scoring algorithm
- Engagement tracking

---

## Execution Order

| Step | Action | Est. Time | Est. Cost |
|------|--------|-----------|-----------|
| 1 | Run database migration | 1 min | $0 |
| 2 | Deploy batch-reanalyze-videos | 5 min | $0 |
| 3 | Run batch re-analysis (650 videos) | 10 min | ~$0.50 |
| 4 | Update Pinecone metadata | 5 min | $0 |
| 5 | Deploy scrape-video-comments | 5 min | $0 |
| 6 | Run batch comment scraping | 30 min | ~$10-15 |
| 7 | Deploy analyze-video-comments | 5 min | $0 |
| 8 | Run batch comment analysis | 15 min | ~$5 |
| 9 | Update find-videos with new logic | 10 min | $0 |
| **Total** | | ~90 min | **~$20** |
