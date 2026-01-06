@echo off
echo ================================================
echo DEPLOYING TRANSCRIPT PARSING FIX
echo ================================================
echo.
echo This fixes the issue where SupaData transcripts
echo were being stored as JSON arrays instead of text
echo.
echo Deploying updated functions...
echo.

REM Deploy the load-resources-database function
echo [1/2] Deploying load-resources-database...
call npx supabase functions deploy load-resources-database --no-verify-jwt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to deploy load-resources-database
    exit /b 1
)
echo.

REM Note: The _shared folder is automatically included when deploying functions
echo [2/2] Shared transcript.ts will be included automatically
echo.

echo ================================================
echo DEPLOYMENT COMPLETE
echo ================================================
echo.
echo The transcript parsing fix has been deployed.
echo.
echo What was fixed:
echo - Added parseTranscriptSegments() function to handle array format
echo - Transcripts are now properly converted from JSON arrays to text
echo - Added logging to show first 200 chars of parsed transcript
echo.
echo Next steps:
echo 1. Test with a new video resource load
echo 2. Check logs to verify transcript is parsed correctly
echo 3. Verify Grok analysis receives plain text, not JSON
echo.
pause

