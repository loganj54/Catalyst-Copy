#!/bin/bash
# ============================================================================
# Deploy Irrelevant Resources Filter Fix
# ============================================================================
# This script deploys the fix for filtering out irrelevant web search results
#
# Changes:
# - Updated search-resources function to filter irrelevant resources
# - Added frontend safety checks in Blueprint.jsx
# ============================================================================

echo ""
echo "============================================================================"
echo "  DEPLOYING IRRELEVANT RESOURCES FILTER FIX"
echo "============================================================================"
echo ""
echo "This will deploy:"
echo "  1. Updated search-resources Edge Function (with relevance filtering)"
echo "  2. Frontend changes will require a separate build/deploy"
echo ""

# Check if Supabase CLI is available
if ! command -v npx &> /dev/null; then
    echo "ERROR: npx not found. Please install Node.js and npm."
    exit 1
fi

echo "Step 1: Deploying search-resources Edge Function..."
echo ""
npx supabase functions deploy search-resources

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to deploy search-resources function"
    echo "Please check your Supabase credentials and try again"
    exit 1
fi

echo ""
echo "============================================================================"
echo "  EDGE FUNCTION DEPLOYMENT COMPLETE"
echo "============================================================================"
echo ""
echo "Next steps:"
echo "  1. Build the frontend: npm run build"
echo "  2. Deploy the frontend to your hosting service"
echo "  3. Test the fix by searching for a technical topic"
echo ""
echo "The following should now work correctly:"
echo "  - Irrelevant resources are filtered out before display"
echo "  - Only resources relevant to the topic are shown"
echo "  - Clear messaging if no relevant resources are found"
echo ""
echo "For more details, see: IRRELEVANT_RESOURCES_FIX.md"
echo ""

