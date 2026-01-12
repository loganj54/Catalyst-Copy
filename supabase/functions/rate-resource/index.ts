// ============================================================================
// RATE RESOURCE EDGE FUNCTION
// ============================================================================
// Allows authenticated users to submit a 1-5 star rating for a resource.
// Updates the resource's aggregate rating statistics.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        // Parse request body
        const { resource_id, rating } = await req.json();

        // Validate inputs
        if (!resource_id) {
            throw new Error('Missing resource_id');
        }
        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
            throw new Error('Rating must be a number between 1 and 5');
        }

        // Get user from auth header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // Create client with user's auth to get user ID
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await authClient.auth.getUser();
        if (authError || !user) {
            throw new Error('Unauthorized');
        }

        console.log(`[rate-resource] User ${user.id} rating resource ${resource_id} with ${rating} stars`);

        // Use service role client to call RPC (bypasses RLS for aggregate updates)
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Call the RPC function to submit rating
        const { data, error } = await supabase.rpc('submit_resource_rating', {
            p_resource_id: resource_id,
            p_user_id: user.id,
            p_rating: rating
        });

        if (error) {
            console.error('[rate-resource] RPC error:', error);
            throw new Error(`Failed to submit rating: ${error.message}`);
        }

        const result = data?.[0] || data;
        console.log(`[rate-resource] Success! New average: ${result?.new_average_rating}, count: ${result?.new_rating_count}`);

        return new Response(
            JSON.stringify({
                success: true,
                average_rating: result?.new_average_rating,
                rating_count: result?.new_rating_count,
                user_rating: rating
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[rate-resource] Error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            { status: error.message === 'Unauthorized' ? 401 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
