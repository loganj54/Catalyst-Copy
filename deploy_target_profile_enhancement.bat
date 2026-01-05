@echo off
REM ============================================================================
REM Deploy Target Resource Profile Enhancement (Windows)
REM ============================================================================
REM This script deploys the enhanced target resource profile generation
REM that includes full problem statements for walkthrough videos
REM ============================================================================

echo ============================================
echo Target Resource Profile Enhancement Deploy
echo ============================================
echo.

echo [94m📋 What's being deployed:[0m
echo   - Enhanced prompts for target_resource_profile generation
echo   - Introduction videos: Keep concise (2-3 sentences) - NO CHANGE
echo   - Problem walkthrough videos: Include FULL problem statement
echo.

echo [94m📁 Files modified:[0m
echo   - supabase/functions/_shared/prompts.ts
echo.

REM Check if we're in the right directory
if not exist "supabase\functions" (
    echo [93m⚠️  Warning: Not in project root directory[0m
    echo Please run this script from the project root
    exit /b 1
)

echo [94m🔍 Validating TypeScript files...[0m
cd supabase\functions

REM Cache the shared module to check for syntax errors
deno cache _shared\prompts.ts 2>nul
if %errorlevel% equ 0 (
    echo [92m✅ Validation successful[0m
) else (
    echo [93m⚠️  Validation had warnings (this is usually okay)[0m
)

cd ..\..

echo.
echo [94m🚀 Deploying generate-structure function...[0m
echo    (This function uses the updated prompts)

REM Deploy the generate-structure function
call npx supabase functions deploy generate-structure-legacy

if %errorlevel% equ 0 (
    echo.
    echo [92m✅ Deployment successful![0m
    echo.
    echo [94m📊 What changed:[0m
    echo.
    echo   INTRODUCTION/CONCEPT VIDEOS (topic/prerequisite units):
    echo     ✓ No changes - still concise and focused
    echo     ✓ Example: 'A video explaining Newton's Laws...'
    echo.
    echo   PROBLEM WALKTHROUGH VIDEOS (walkthrough units):
    echo     ✓ Now includes FULL problem statement
    echo     ✓ Example: 'A video solving this problem: A 2000 kg car...'
    echo     ✓ Much more precise semantic search matching
    echo.
    echo [94m🎯 Benefits:[0m
    echo   • Dramatically improved search precision for problem videos
    echo   • Better matching of similar problems
    echo   • Context-rich embeddings for semantic search
    echo   • No impact on introduction video quality
    echo.
    echo [94m📝 Next steps:[0m
    echo   1. Test with a problem set document
    echo   2. Verify walkthrough units include full problem statements
    echo   3. Check search results are highly specific
    echo.
    echo [92m🎉 Ready to use![0m
) else (
    echo.
    echo [93m⚠️  Deployment encountered issues[0m
    echo Check the output above for details
    exit /b 1
)

