@echo off
REM ============================================================================
REM Deploy Irrelevant Resources Filter Fix
REM ============================================================================
REM This script deploys the fix for filtering out irrelevant web search results
REM
REM Changes:
REM - Updated search-resources function to filter irrelevant resources
REM - Added frontend safety checks in Blueprint.jsx
REM ============================================================================

echo.
echo ============================================================================
echo  DEPLOYING IRRELEVANT RESOURCES FILTER FIX
echo ============================================================================
echo.
echo This will deploy:
echo   1. Updated search-resources Edge Function (with relevance filtering)
echo   2. Frontend changes will require a separate build/deploy
echo.

REM Check if Supabase CLI is available
where npx >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npx not found. Please install Node.js and npm.
    exit /b 1
)

echo Step 1: Deploying search-resources Edge Function...
echo.
npx supabase functions deploy search-resources

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to deploy search-resources function
    echo Please check your Supabase credentials and try again
    exit /b 1
)

echo.
echo ============================================================================
echo  EDGE FUNCTION DEPLOYMENT COMPLETE
echo ============================================================================
echo.
echo Next steps:
echo   1. Build the frontend: npm run build
echo   2. Deploy the frontend to your hosting service
echo   3. Test the fix by searching for a technical topic
echo.
echo The following should now work correctly:
echo   - Irrelevant resources are filtered out before display
echo   - Only resources relevant to the topic are shown
echo   - Clear messaging if no relevant resources are found
echo.
echo For more details, see: IRRELEVANT_RESOURCES_FIX.md
echo.

pause

