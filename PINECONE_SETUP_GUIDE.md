## Pinecone Setup Guide

### Step 1: Create Pinecone Account

1. Go to https://www.pinecone.io/
2. Click "Sign Up" (free tier: 1 index, 100K vectors)
3. Sign up with email or GitHub
4. Verify your email

### Step 2: Create Index

1. In Pinecone dashboard, click "Create Index"
2. **Index Name**: `catalyst-resources`
3. **Dimensions**: `3072`
4. **Metric**: `cosine`
5. **Cloud**: Choose region closest to your users
6. Click "Create Index"

### Step 3: Get Credentials

After creating the index, you'll see:
1. **API Key**: In "API Keys" section (starts with `pcsk_...`)
2. **Index Host**: In index details (looks like `catalyst-resources-xxxxx.svc.xxx.pinecone.io`)

### Step 4: Add to Supabase Secrets

```bash
cd "C:\Users\logan\OneDrive\Catalyst engineering Ed project folder"

# Set Pinecone credentials
supabase secrets set PINECONE_API_KEY=your_api_key_here
supabase secrets set PINECONE_INDEX_HOST=your_index_host_here
```

### Step 5: Run Database Migration

In Supabase SQL Editor, run:
```sql
-- See: supabase/migrations/add_pinecone_integration.sql
```

Or use the file I created: `supabase/migrations/add_pinecone_integration.sql`

### Step 6: Deploy Functions

```bash
supabase functions deploy
```

### Step 7: Test Integration

Create a test function or use the existing ones - they'll automatically use Pinecone when the credentials are set.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        YOUR APPLICATION                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─────────────────┬──────────────────┐
                            ▼                 ▼                  ▼
                    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                    │   SUPABASE   │  │   PINECONE   │  │    OPENAI    │
                    │              │  │              │  │              │
                    │  Metadata:   │  │  Vectors:    │  │  Generate:   │
                    │  - title     │  │  - 3072 dims │  │  - embeddings│
                    │  - url       │  │  - fast      │  │              │
                    │  - platform  │  │    search    │  │              │
                    │  - etc.      │  │              │  │              │
                    └──────────────┘  └──────────────┘  └──────────────┘
```

## Workflow

### Storing a Resource:

1. Generate 3072-dim embedding with OpenAI
2. Store metadata in Supabase `curated_resources` table
3. Store vector in Pinecone with resource ID
4. Link them via `pinecone_vector_id` column

### Searching for Resources:

1. Generate 3072-dim embedding for search query
2. Query Pinecone for similar vectors
3. Get resource IDs from Pinecone results
4. Fetch full resource details from Supabase

## Cost Estimate

### Pinecone Free Tier:
- 1 index
- 100K vectors
- Unlimited queries
- **Cost**: $0/month

### When You Exceed Free Tier:
- Standard: ~$70/month for 100K vectors
- Scale as needed

### Your Use Case:
- Estimated resources: 10K-50K initially
- **Fits in free tier!** 🎉

## Files Created

1. `supabase/functions/_shared/pinecone-client.ts` - Pinecone API wrapper
2. `supabase/functions/_shared/resource-vector-storage.ts` - High-level resource storage
3. `supabase/migrations/add_pinecone_integration.sql` - Database schema updates

## Next Steps

After setup:
1. Update resource storage functions to use Pinecone
2. Update search functions to query Pinecone
3. Migrate existing resources (optional - can do gradually)

## Benefits

✅ Full 3072-dimensional embeddings (better quality)
✅ Fast vector search (purpose-built for this)
✅ Scales to millions of vectors
✅ Free tier covers initial growth
✅ Metadata still in Supabase (single source of truth)

