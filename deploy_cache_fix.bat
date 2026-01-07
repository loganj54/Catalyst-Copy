@echo off
echo ========================================
echo DEPLOYING CACHE FIX
echo ========================================
echo.
echo This fixes the issue where cached sections from different
echo homeworks were being mixed up (e.g., Problem 3 from homework 9
echo being returned when querying for homework 10).
echo.
echo Solution:
echo - Use source_blueprint_id as the unique key (instead of text matching)
echo - Query cache by (blueprint_id, section_id) pair for exact matches
echo - Store source_blueprint_id when caching new sections
echo - Enhanced logging to show which blueprint's cache is being used
echo.
pause

echo.
echo Deploying generate-structure-legacy function...
call npx supabase functions deploy generate-structure-legacy --no-verify-jwt

echo.
echo ========================================
echo DEPLOYMENT COMPLETE
echo ========================================
echo.
echo The cache will now use blueprint_id as the unique key to ensure
echo each homework's cached data is kept separate and never mixed up.
echo.
echo Test by:
echo 1. Creating a new blueprint on homework 10 (radiation)
echo 2. Duplicating it - should get radiation cached data, not heat exchangers
echo.
pause

