@echo off
REM ============================================================================
REM Deploy Load Resources Database Edge Function
REM ============================================================================

echo ==========================================
echo Deploying load-resources-database function
echo ==========================================
echo.

REM Deploy the function
call supabase functions deploy load-resources-database

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Function deployed successfully!
    echo.
    echo Next steps:
    echo 1. Verify environment variables are set:
    echo    supabase secrets list
    echo.
    echo 2. Test the function from the Blueprint page
    echo.
    echo 3. Check logs if needed:
    echo    supabase functions logs load-resources-database
    echo.
) else (
    echo.
    echo ❌ Deployment failed!
    echo Check the error messages above.
    exit /b 1
)

