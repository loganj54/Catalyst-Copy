#!/bin/bash

# Deploy the new Haiku 4.5 search function to Supabase

echo "Deploying search-resources-haiku function to Supabase..."

# Deploy the function
supabase functions deploy search-resources-haiku

echo "✅ Deployment complete!"
echo ""
echo "The new function is now available at:"
echo "  https://[YOUR_PROJECT_REF].supabase.co/functions/v1/search-resources-haiku"
echo ""
echo "This function uses Claude Haiku 4.5's web search to find 3 educational videos"
echo "with a single API call for cost efficiency."

