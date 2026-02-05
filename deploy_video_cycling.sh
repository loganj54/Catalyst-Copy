#!/bin/bash

echo "========================================"
echo "Deploying Video Cycling Enhancement"
echo "========================================"
echo ""
echo "This will deploy the updated find-videos-sandbox function"
echo "that returns ALL videos above threshold for cycling."
echo ""

# Deploy the function
echo "Deploying find-videos-sandbox..."
supabase functions deploy find-videos-sandbox

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ Deployment Complete!"
echo "========================================"
echo ""
echo "Changes:"
echo "- find-videos-sandbox now returns ALL videos above threshold"
echo "- Users can cycle through more video options"
echo "- No breaking changes to API"
echo ""
echo "Next steps:"
echo "1. Test by searching for a video in the app"
echo "2. Click the refresh icon to cycle through videos"
echo "3. Verify you can cycle through more than 5 videos"
echo ""
