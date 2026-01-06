# Load Resources Database - Setup Guide

## Overview

The "Load Resources Database" feature automatically finds YouTube videos, extracts transcripts, analyzes them with AI, and stores them in your database with vector embeddings for semantic search.

## Environment Variables

You've already set these up via the Supabase CLI. Here's the reference:

```bash
# Apify Configuration (YouTube video search)
APIFY_API_TOKEN=<your-token>
APIFY_ACTOR_ID=<your-actor-id>

# SupaData Configuration (transcript extraction)
SUPADATA_API_KEY=<your-key>
SUPADATA_API_ENDPOINT=<your-endpoint>

# XAI Grok Configuration (transcript analysis)
XAI_API_KEY=<your-key>

# Already configured (no action needed)
OPENAI_API_KEY=<existing>
PINECONE_API_KEY=<existing>
PINECONE_INDEX_NAME=<existing>
```

## How It Works

### Pipeline Flow

```
1. User clicks "Load Resources DB" button on a topic
   ↓
2. Apify Actor searches YouTube using the topic's search queries
   ↓
3. For each video found:
   a. SupaData extracts the transcript
   b. Grok 4.1 analyzes the transcript
   c. Stores in resources_from_make table
   d. Generates OpenAI embedding
   e. Stores embedding in Pinecone
   ↓
4. Returns success summary to user
```

### What Gets Stored

**Database (`resources_from_make` table)**:
- Video metadata (title, URL, channel, thumbnail, duration)
- Full transcript
- AI-generated summary
- 10 specific key phrases for matching
- Categories (Introduction/Visuals/Math-heavy)
- Problems covered (if any)

**Pinecone (`resources` namespace)**:
- 3072-dimensional embedding of the summary
- Metadata linking back to database via `resource_id`

## Usage

1. Navigate to a Blueprint page
2. Expand a topic/unit
3. Click the **"Load Resources DB"** button (cyan/teal colored)
4. Wait for the pipeline to complete (1-2 minutes for 5-10 videos)
5. See success message with summary
6. Click **"Search DB"** to find the loaded resources

## Integration with Existing Search

The loaded resources automatically work with the existing "Search DB" button because:
- Both use the same Pinecone `resources` namespace
- Both use the same `resource_id` linking system
- The search function queries Pinecone, then fetches full details from `resources_from_make`

## Troubleshooting

### Button doesn't appear
- Make sure you're on a Blueprint page with generated structure
- The button only appears for topics without resources yet

### "API key not configured" error
- Verify secrets are set: `supabase secrets list`
- Re-set if needed: `supabase secrets set KEY_NAME=value`

### "No videos found" error
- Check that the topic has search queries generated
- Try different search queries
- Verify Apify Actor ID is correct

### "Transcript not found" error
- Some videos don't have transcripts available
- The pipeline will skip these and continue with others
- Check SupaData API key and endpoint

### "Grok analysis failed" error
- Verify XAI API key is correct
- Check Grok model name: `grok-4-1-fast-non-reasoning`
- Ensure transcript isn't too long (should be handled automatically)

## API Rate Limits

Be aware of rate limits:
- **Apify**: Depends on your plan
- **SupaData**: Check your plan limits
- **Grok**: Check XAI rate limits
- **OpenAI**: Embedding API has generous limits
- **Pinecone**: Generous free tier limits

The function processes videos sequentially to avoid hitting rate limits.

## Cost Estimation

Per video processed:
- Apify: ~$0.001-0.01 (depends on actor)
- SupaData: Varies by plan
- Grok: ~$0.01-0.05 per analysis
- OpenAI: ~$0.0001 for embedding
- Pinecone: Free tier covers most usage

**Estimated total**: ~$0.02-0.10 per video

## Testing

To test the complete pipeline:

1. Go to a Blueprint with topics
2. Click "Load Resources DB" on a topic with 1-2 search queries
3. Monitor the browser console for detailed logs
4. Wait for completion (should take 1-2 minutes)
5. Verify resources appear in database:
   ```sql
   SELECT * FROM resources_from_make ORDER BY created_at DESC LIMIT 5;
   ```
6. Verify embeddings in Pinecone (check dashboard)
7. Click "Search DB" to verify resources are findable

## Next Steps

After loading resources:
1. Use "Search DB" to find relevant resources for topics
2. Resources will appear with summaries and "Why this helps" explanations
3. Students can click through to watch the videos
4. Build up your resource database over time

## Support

If you encounter issues:
1. Check browser console for detailed error logs
2. Check Supabase Edge Function logs
3. Verify all API keys are set correctly
4. Ensure all external APIs are accessible

