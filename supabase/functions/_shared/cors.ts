// CORS headers for Edge Functions
// Allows requests from any origin (configure based on your security needs)

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

