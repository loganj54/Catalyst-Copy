@echo off
echo Deploying generate-resource-explanation function to Supabase...
call supabase functions deploy generate-resource-explanation --no-verify-jwt
echo Deployment complete!
pause

