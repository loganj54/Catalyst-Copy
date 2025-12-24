@echo off
REM Deploy CORS fix to Supabase Edge Functions
REM This script redeploys all edge functions with the updated CORS configuration

echo ============================================
echo Deploying CORS Fix to Edge Functions
echo ============================================
echo.

echo Deploying analyze-document function...
call supabase functions deploy analyze-document --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to deploy analyze-document
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo Deploying generate-structure function...
call supabase functions deploy generate-structure --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to deploy generate-structure
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo Deploying search-resources function...
call supabase functions deploy search-resources --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to deploy search-resources
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo Deploying search-problem-walkthroughs function...
call supabase functions deploy search-problem-walkthroughs --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to deploy search-problem-walkthroughs
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo ============================================
echo CORS fix deployment completed successfully!
echo ============================================
echo.
echo All edge functions now have proper CORS headers:
echo - Access-Control-Allow-Origin: *
echo - Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
echo - Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE
echo - Access-Control-Max-Age: 86400 (24 hours)
echo.
echo The CORS preflight requests should now work on the first try!
echo.
pause

