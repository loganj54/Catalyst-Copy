#!/bin/bash
# Deploy CORS fix to Supabase Edge Functions
# This script redeploys all edge functions with the updated CORS configuration

echo "============================================"
echo "Deploying CORS Fix to Edge Functions"
echo "============================================"
echo ""

echo "Deploying analyze-document function..."
supabase functions deploy analyze-document --no-verify-jwt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to deploy analyze-document"
    exit 1
fi
echo ""

echo "Deploying generate-structure function..."
supabase functions deploy generate-structure --no-verify-jwt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to deploy generate-structure"
    exit 1
fi
echo ""

echo "Deploying search-resources function..."
supabase functions deploy search-resources --no-verify-jwt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to deploy search-resources"
    exit 1
fi
echo ""

echo "Deploying search-problem-walkthroughs function..."
supabase functions deploy search-problem-walkthroughs --no-verify-jwt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to deploy search-problem-walkthroughs"
    exit 1
fi
echo ""

echo "============================================"
echo "CORS fix deployment completed successfully!"
echo "============================================"
echo ""
echo "All edge functions now have proper CORS headers:"
echo "- Access-Control-Allow-Origin: *"
echo "- Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type"
echo "- Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE"
echo "- Access-Control-Max-Age: 86400 (24 hours)"
echo ""
echo "The CORS preflight requests should now work on the first try!"
echo ""

