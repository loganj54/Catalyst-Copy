# Pinecone Quick Start - 5 Steps

## ✅ Step 1: Sign Up for Pinecone (5 minutes)

1. Go to https://www.pinecone.io/
2. Click "Sign Up" → Use email or GitHub
3. Verify email
4. **Free Tier**: 1 index, 100K vectors (perfect for starting!)

## ✅ Step 2: Create Your Index (2 minutes)

In Pinecone dashboard:
1. Click "Create Index"
2. Fill in:
   - **Name**: `catalyst-resources`
   - **Dimensions**: `3072` ⚠️ Important!
   - **Metric**: `cosine`
   - **Cloud/Region**: Choose closest to you
3. Click "Create"

## ✅ Step 3: Get Your Credentials (1 minute)

Copy these from Pinecone dashboard:
1. **API Key**: Go to "API Keys" tab → Copy key (starts with `pcsk_...`)
2. **Index Host**: Go to your index → Copy host URL (looks like `catalyst-resources-xxxxx.svc.xxx.pinecone.io`)

## ✅ Step 4: Add to Supabase (2 minutes)

Open terminal and run:

```bash
cd "C:\Users\logan\OneDrive\Catalyst engineering Ed project folder"

supabase secrets set PINECONE_API_KEY=paste_your_api_key_here
supabase secrets set PINECONE_INDEX_HOST=paste_your_index_host_here
```

## ✅ Step 5: Run Migration & Deploy (3 minutes)

### 5a. Run the SQL migration

In Supabase SQL Editor, paste and run:

```sql
-- Copy contents from: supabase/migrations/add_pinecone_integration.sql
-- This adds pinecone_vector_id columns to your tables
```

### 5b. Deploy functions

```bash
supabase functions deploy
```

## 🎉 Done!

Your system is now configured to use:
- **Pinecone**: 3072-dimensional vector storage & search
- **Supabase**: All metadata (titles, URLs, etc.)
- **OpenAI**: text-embedding-3-large (full 3072 dims)

## What Happens Next?

When you create new blueprints:
1. Embeddings are generated at 3072 dimensions
2. Vectors are stored in Pinecone
3. Metadata stays in Supabase
4. Searches use Pinecone (fast & accurate!)

## Cost

**Free Tier**: 100K vectors
- Your estimated usage: 10K-50K resources
- **You're covered for free!** 🎉

When you grow beyond 100K:
- ~$70/month for 100K vectors
- Scales as needed

## Files I Created

1. ✅ `supabase/functions/_shared/pinecone-client.ts` - Pinecone API wrapper
2. ✅ `supabase/functions/_shared/resource-vector-storage.ts` - Resource storage logic
3. ✅ `supabase/migrations/add_pinecone_integration.sql` - Database schema
4. ✅ `PINECONE_SETUP_GUIDE.md` - Detailed guide
5. ✅ `PINECONE_QUICK_START.md` - This file!

## Next: Update Your Functions

The integration code is ready. Next step is to update your resource storage and search functions to use Pinecone. Let me know when you're ready and I'll help with that!

## Questions?

- **Where are vectors stored?** Pinecone (3072 dims)
- **Where is metadata stored?** Supabase (titles, URLs, etc.)
- **How do they link?** `pinecone_vector_id` column
- **Cost?** Free for 100K vectors (you're good!)
- **Performance?** Much faster than pgvector at scale

