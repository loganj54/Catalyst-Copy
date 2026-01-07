# Database Setup Instructions - Resource Persistence

## Where Resources Are Saved

Resources are saved in **3 database tables**:

### 1. `curated_resources` 
**Location**: Your Supabase PostgreSQL database  
**Purpose**: Master table storing ALL educational resources (videos, articles, etc.)  
**Key Columns**:
- `id` - Unique resource ID
- `url` - Resource URL (YouTube video, article, etc.)
- `title` - Resource title
- `description` - Resource description
- `thumbnail_url` - Video thumbnail
- `duration_seconds` - Video length
- `topic_embedding` - AI vector for semantic search
- `transcript_text` - Video transcript (if available)

### 2. `blueprint_topic_resources` ⭐ **THIS IS THE KEY TABLE!**
**Location**: Your Supabase PostgreSQL database  
**Purpose**: Links resources to specific blueprint units - **THIS IS WHAT MAKES RESOURCES PERSIST!**  
**Key Columns**:
- `blueprint_id` - Which blueprint
- `unit_id` - Which learning unit/topic
- `resource_id` - Links to curated_resources.id
- `resource_explanation` - **The "Why this helps" text** ⭐
- `relevance_score` - How relevant (0-1)
- `from_cache` - Whether it was from database or fresh search

### 3. `topic_responses`
**Location**: Your Supabase PostgreSQL database  
**Purpose**: Tracks whether you clicked "I'm comfortable" or "I need help"  
**Key Columns**:
- `blueprint_id` - Which blueprint
- `unit_id` - Which learning unit
- `response` - 'comfortable' or 'needs_help'
- `searched_at` - When you searched for resources

## Do You Need to Run SQL Migrations?

### Step 1: Check if Tables Exist

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/breeiehhmibttsugorly
2. Click **SQL Editor** in the left sidebar
3. Copy and paste the contents of `CHECK_RESOURCE_TABLES.sql`
4. Click **Run**

**Expected Results:**
- All three tables should show `exists: true`
- `resource_explanation_exists` should be `true`
- You should see a list of columns for `blueprint_topic_resources`

### Step 2A: If Tables Exist ✅

**You're all set!** No migration needed. The system is ready to use.

### Step 2B: If Tables DON'T Exist ❌

1. Open `SETUP_RESOURCE_PERSISTENCE.sql`
2. Copy the **ENTIRE file**
3. Go to Supabase SQL Editor
4. Paste the entire contents
5. Click **Run**
6. Wait for it to complete (should take 5-10 seconds)
7. You should see success messages

### Step 3: Verify Setup

Run `CHECK_RESOURCE_TABLES.sql` again to confirm:
- All tables exist
- `resource_explanation` column exists
- Counts show 0 (or more if you already have data)

## How to Verify Resources Are Being Saved

### Option 1: Check Browser Console (Easiest)

1. Open your app in browser
2. Press F12 to open Developer Tools
3. Go to **Console** tab
4. Search for resources on a blueprint unit
5. Look for these messages:
   ```
   ✅ Successfully linked resource [id] to blueprint with explanation
   ✅ All X resources persisted to database with explanations
   ```

### Option 2: Query Database Directly

Run this SQL in Supabase SQL Editor:

```sql
-- See all resources linked to a specific blueprint
SELECT 
  btr.blueprint_id,
  btr.unit_id,
  cr.title,
  cr.url,
  btr.resource_explanation,
  btr.created_at
FROM blueprint_topic_resources btr
JOIN curated_resources cr ON btr.resource_id = cr.id
WHERE btr.blueprint_id = 'YOUR_BLUEPRINT_ID_HERE'
ORDER BY btr.created_at DESC;
```

Replace `YOUR_BLUEPRINT_ID_HERE` with your actual blueprint ID (from the URL).

### Option 3: Check in Supabase Dashboard

1. Go to Supabase Dashboard
2. Click **Table Editor** in left sidebar
3. Select `blueprint_topic_resources` table
4. Look for rows with your blueprint_id
5. Check the `resource_explanation` column - should have text

## Common Issues

### Issue: "Table doesn't exist" error

**Solution**: Run `SETUP_RESOURCE_PERSISTENCE.sql` in SQL Editor

### Issue: "Column resource_explanation doesn't exist"

**Solution**: Run this SQL:
```sql
ALTER TABLE blueprint_topic_resources
ADD COLUMN IF NOT EXISTS resource_explanation TEXT;
```

### Issue: Resources aren't showing after refresh

**Possible causes**:
1. Check browser console for errors
2. Verify resources were saved (run SQL query above)
3. Check that blueprint_id matches (look at URL)
4. Verify RLS policies are set up (run `SETUP_RESOURCE_PERSISTENCE.sql`)

## Files Reference

- `CHECK_RESOURCE_TABLES.sql` - Check if tables exist
- `SETUP_RESOURCE_PERSISTENCE.sql` - Create tables if they don't exist
- `RESOURCE_PERSISTENCE_FIX.md` - Full documentation of the system

## Quick Answer to Your Question

**Q: Where in the database is it being saved?**

**A:** In the `blueprint_topic_resources` table in your Supabase PostgreSQL database. This table links:
- Your blueprint (`blueprint_id`)
- To a specific learning unit (`unit_id`)
- To a specific resource (`resource_id` → `curated_resources.id`)
- With the explanation (`resource_explanation`)

**Q: Do I need to run SQL migrations?**

**A:** **Maybe.** Run `CHECK_RESOURCE_TABLES.sql` first to see if the tables exist. If they don't exist, run `SETUP_RESOURCE_PERSISTENCE.sql` once. That's it!

## Timeline

These migrations were created earlier (based on the file timestamps):
- `add_web_search_resources.sql` - Created the main tables
- `add_resource_explanation_column.sql` - Added the explanation column

If you've been using the app for a while, these tables **probably already exist**. Run the check query to be sure!

