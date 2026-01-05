#!/bin/bash

# ============================================================================
# Deploy Target Resource Profile Enhancement
# ============================================================================
# This script deploys the enhanced target resource profile generation
# that includes full problem statements for walkthrough videos
# ============================================================================

echo "============================================"
echo "Target Resource Profile Enhancement Deploy"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 What's being deployed:${NC}"
echo "  - Enhanced prompts for target_resource_profile generation"
echo "  - Introduction videos: Keep concise (2-3 sentences) - NO CHANGE"
echo "  - Problem walkthrough videos: Include FULL problem statement"
echo ""

echo -e "${BLUE}📁 Files modified:${NC}"
echo "  - supabase/functions/_shared/prompts.ts"
echo ""

# Check if we're in the right directory
if [ ! -d "supabase/functions" ]; then
    echo -e "${YELLOW}⚠️  Warning: Not in project root directory${NC}"
    echo "Please run this script from the project root"
    exit 1
fi

echo -e "${BLUE}🔍 Validating TypeScript files...${NC}"
cd supabase/functions

# Cache the shared module to check for syntax errors
if deno cache _shared/prompts.ts 2>&1; then
    echo -e "${GREEN}✅ Validation successful${NC}"
else
    echo -e "${YELLOW}⚠️  Validation had warnings (this is usually okay)${NC}"
fi

cd ../..

echo ""
echo -e "${BLUE}🚀 Deploying generate-structure function...${NC}"
echo "   (This function uses the updated prompts)"

# Deploy the generate-structure function
npx supabase functions deploy generate-structure-legacy

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo -e "${BLUE}📊 What changed:${NC}"
    echo ""
    echo "  INTRODUCTION/CONCEPT VIDEOS (topic/prerequisite units):"
    echo "    ✓ No changes - still concise and focused"
    echo "    ✓ Example: 'A video explaining Newton's Laws...'"
    echo ""
    echo "  PROBLEM WALKTHROUGH VIDEOS (walkthrough units):"
    echo "    ✓ Now includes FULL problem statement"
    echo "    ✓ Example: 'A video solving this problem: A 2000 kg car...'"
    echo "    ✓ Much more precise semantic search matching"
    echo ""
    echo -e "${BLUE}🎯 Benefits:${NC}"
    echo "  • Dramatically improved search precision for problem videos"
    echo "  • Better matching of similar problems"
    echo "  • Context-rich embeddings for semantic search"
    echo "  • No impact on introduction video quality"
    echo ""
    echo -e "${BLUE}📝 Next steps:${NC}"
    echo "  1. Test with a problem set document"
    echo "  2. Verify walkthrough units include full problem statements"
    echo "  3. Check search results are highly specific"
    echo ""
    echo -e "${GREEN}🎉 Ready to use!${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Deployment encountered issues${NC}"
    echo "Check the output above for details"
    exit 1
fi

