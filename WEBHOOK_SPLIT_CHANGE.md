# Webhook Splitting Fix

## Changes
- Modified `handleTriggerWebhook` in `src/pages/Blueprint.jsx`
- Now splits `search_queries` into individual webhook calls
- Sends one webhook per query to `https://hook.us2.make.com/4biukvihdmvo4aianlpqk5sbnewjbonh`
- Payload includes `search_query` (singular string) instead of `search_queries` (array)
- Added `query_index` and `total_queries` to payload for context

## Usage
Click "Activate Webhook" on a topic card. It will now trigger ~3 webhooks instead of 1.

