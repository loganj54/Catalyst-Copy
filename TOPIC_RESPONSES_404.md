# topic_responses 404 Error - Non-Critical

## The Error
```
GET .../rest/v1/topic_responses?select=*&blueprint_id=eq...&user_id=eq... 404 (Not Found)
```

## What It Means

The frontend is trying to fetch user progress/responses for topics, but the `topic_responses` table doesn't exist in your database.

## Is This a Problem?

**No, this is non-critical.** This table is used for:
- Tracking which topics a user has completed
- Storing user responses/notes on topics
- Progress tracking in the UI

The blueprint generation and caching system works fine without it. You'll just see a 404 in the console.

## Should You Fix It?

**Optional.** If you want progress tracking, you can create the table. But it's not needed for:
- ✅ Document analysis
- ✅ Blueprint generation
- ✅ Section-level caching
- ✅ Resource searching
- ✅ Equation processing

## How to Fix (If You Want To)

Create the table in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS topic_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  
  -- User response data
  completed BOOLEAN DEFAULT FALSE,
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  notes TEXT,
  time_spent_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Ensure one response per user per unit
  UNIQUE(blueprint_id, user_id, unit_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_topic_responses_blueprint ON topic_responses(blueprint_id);
CREATE INDEX idx_topic_responses_user ON topic_responses(user_id);
CREATE INDEX idx_topic_responses_completed ON topic_responses(completed);

-- RLS policies
ALTER TABLE topic_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own responses"
  ON topic_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own responses"
  ON topic_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
  ON topic_responses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own responses"
  ON topic_responses FOR DELETE
  USING (auth.uid() = user_id);
```

## Current Status

**Ignore this error for now.** Focus on:
1. ✅ Run the SQL to drop the `structure` column (from previous fix)
2. ✅ Test blueprint generation
3. ✅ Verify section-level caching works

The `topic_responses` 404 won't affect any of that.

---

**Priority:** Low  
**Impact:** Progress tracking UI only  
**Action:** Optional - create table if you want progress tracking  
**For Now:** Safe to ignore

