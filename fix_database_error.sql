-- Run this script in your Supabase SQL Editor to fix the "Database Error Saving New User" issue.

-- 1. Drop the existing trigger and function to ensure a clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Ensure the public.users table exists with the correct schema
CREATE TABLE IF NOT EXISTS public.users (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  updated_at timestamp with time zone,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  website text,
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- 3. Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Ensure policies exist (idempotent checks)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Public users are viewable by everyone.'
    ) THEN
        CREATE POLICY "Public users are viewable by everyone." ON public.users FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can insert their own profile.'
    ) THEN
        CREATE POLICY "Users can insert their own profile." ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile.'
    ) THEN
        CREATE POLICY "Users can update own profile." ON public.users FOR UPDATE USING (auth.uid() = id);
    END IF;
END
$$;

-- 5. Create a robust handler function
-- Note: We explicitly set search_path to public for security and reliability
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url)
  VALUES (
    new.id, 
    -- Use COALESCE to ensure we don't insert NULL if metadata is missing (though column allows null)
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  -- If the user already exists (e.g. retry), update the record instead of failing
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
    
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the detailed error to Supabase logs for debugging
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    -- Reraise with a clear message
    RAISE EXCEPTION 'Database Error Saving New User: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Confirmation
SELECT 'Successfully updated handle_new_user trigger' as status;


