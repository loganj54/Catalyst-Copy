# Load Resources Database Function

## Purpose
Orchestrates the complete pipeline for loading YouTube educational resources into the `resources_from_make` database with Pinecone vector embeddings for semantic search.

## Pipeline Flow

```
User Request
    ↓
1. Apify Actor → Search YouTube for videos
    ↓
2. SupaData API → Extract video transcripts
    ↓
3. Grok 4.1 → Analyze transcripts (categories, key phrases, summary, problems)
    ↓
4. Database → Store in resources_from_make table
    ↓
5. OpenAI → Generate vector embedding from summary
    ↓
6. Pinecone → Store embedding in 'resources' namespace
```

## Request Format

```typescript
POST /functions/v1/load-resources-database
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "unit_id": "uuid",
  "topic": "Heat Transfer Fundamentals",
  "search_queries": [
    "heat transfer conduction tutorial",
    "thermal conductivity examples"
  ],
  "blueprint_id": "uuid",
  "description": "Optional description"
}
```

## Response Format

### Success
```json
{
  "success": true,
  "summary": {
    "total": 10,
    "successful": 8,
    "failed": 2
  },
  "results": [
    {
      "success": true,
      "resource_id": "uuid",
      "url": "https://youtube.com/watch?v=...",
      "title": "Video Title"
    },
    {
      "success": false,
      "url": "https://youtube.com/watch?v=...",
      "title": "Video Title",
      "error": "Error message"
    }
  ]
}
```

### Error
```json
{
  "success": false,
  "error": "Error message"
}
```

## Environment Variables Required

```bash
# Apify Configuration
APIFY_API_TOKEN=<token>
APIFY_ACTOR_ID=<actor-id>

# SupaData Configuration
SUPADATA_API_KEY=<key>
SUPADATA_API_ENDPOINT=<endpoint-url>

# XAI Grok Configuration
XAI_API_KEY=<key>

# OpenAI Configuration (already configured)
OPENAI_API_KEY=<key>

# Pinecone Configuration (already configured)
PINECONE_API_KEY=<key>
PINECONE_INDEX_NAME=<index-name>
```

## Database Schema

Stores resources in `resources_from_make` table:
- `id`: UUID (primary key)
- `resource_id`: TEXT (unique, used for Pinecone linking)
- `url`: TEXT (YouTube URL)
- `title`: TEXT
- `description`: TEXT
- `platform`: TEXT ('YouTube')
- `channel_name`: TEXT
- `channel_url`: TEXT
- `thumbnail_url`: TEXT
- `duration_seconds`: INTEGER
- `resource_type`: TEXT ('video')
- `original_search_query`: TEXT
- `key_phrases`: TEXT[] (array of specific key phrases)
- `transcript`: TEXT (full transcript)
- `summary`: TEXT (AI-generated summary)
- `full_content_analysis`: TEXT (JSON with categories and problems)

## Pinecone Storage

Stores embeddings in the `resources` namespace:
- **ID**: Same as `resource_id` from database
- **Vector**: 3072-dimensional embedding of the summary
- **Metadata**:
  - `resource_id`: Links to database
  - `title`: Video title
  - `platform`: 'YouTube'
  - `url`: Video URL

## Error Handling

- **Apify failures**: Logs error, continues with other queries
- **SupaData failures**: Skips video, continues with others
- **Grok failures**: Skips video, continues with others
- **Database failures**: Skips video, continues with others
- **Pinecone failures**: Skips video, continues with others

The function is designed to be fault-tolerant - individual video failures don't stop the entire batch.

## Integration with Search

The existing `search-resources-database` function automatically finds resources loaded by this function because:
1. It searches the Pinecone `resources` namespace
2. Retrieves `resource_id` from Pinecone metadata
3. Queries `resources_from_make` table using those IDs

## Grok Analysis Output

The Grok model analyzes transcripts and returns:
- **categories**: Array of 1 category (Introduction/Visuals/Math-heavy)
- **key_phrases**: Array of 10 highly specific phrases for matching
- **summary**: 2-3 sentence summary
- **problems**: Array of specific problems covered (if any)

## Performance Notes

- Processes videos sequentially to avoid rate limits
- Apify actor run can take 10-30 seconds
- Each video transcript + analysis takes 5-15 seconds
- Total time: ~1-2 minutes for 5-10 videos

## Usage from Frontend

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/load-resources-database`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    unit_id: unit.unit_id,
    topic: unit.topic,
    search_queries: unit.search_queries,
    blueprint_id: blueprintId,
  }),
});

const data = await response.json();
```

