#!/bin/bash

# ============================================================================
# Deploy Load Resources Database Edge Function
# ============================================================================

echo "=========================================="
echo "Deploying load-resources-database function"
echo "=========================================="

# Deploy the function
supabase functions deploy load-resources-database

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Function deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Verify environment variables are set:"
    echo "   supabase secrets list"
    echo ""
    echo "2. Test the function from the Blueprint page"
    echo ""
    echo "3. Check logs if needed:"
    echo "   supabase functions logs load-resources-database"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error messages above."
    exit 1
fi

