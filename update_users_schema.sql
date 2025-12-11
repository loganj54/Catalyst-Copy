-- Update Users Table Schema
-- Run this in your Supabase SQL Editor to add recommended fields for education platform
-- This script is idempotent - safe to run multiple times

-- 1. Add new columns if they don't exist
DO $$ 
BEGIN
    -- Add email column to public.users for easier querying
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'email') THEN
        ALTER TABLE public.users ADD COLUMN email text UNIQUE;
    END IF;

    -- Add school/university
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'school') THEN
        ALTER TABLE public.users ADD COLUMN school text;
    END IF;

    -- Add major/field of study
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'major') THEN
        ALTER TABLE public.users ADD COLUMN major text;
    END IF;

    -- Add graduation year
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'graduation_year') THEN
        ALTER TABLE public.users ADD COLUMN graduation_year integer;
    END IF;

    -- Add created_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE public.users ADD COLUMN created_at timestamp with time zone DEFAULT now() NOT NULL;
    END IF;

    -- Ensure updated_at exists (it should already)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.users ADD COLUMN updated_at timestamp with time zone DEFAULT now();
    END IF;
END $$;

-- 2. Update the trigger function to populate email from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email,
    full_name, 
    avatar_url,
    created_at
  )
  VALUES (
    new.id,
    new.email, -- Get email from auth.users
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  -- Handle conflicts (e.g., if user already exists)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
    
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log detailed error for debugging
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RAISE EXCEPTION 'Database Error Saving New User: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Backfill email for existing users (sync from auth.users)
UPDATE public.users u
SET email = au.email
FROM auth.users au
WHERE u.id = au.id
AND u.email IS NULL;

-- 4. Make sure the trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at ON public.users;
CREATE TRIGGER handle_updated_at 
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Confirmation message
SELECT 'Successfully updated users table schema! New fields: email, school, major, graduation_year, created_at' as status;

-- Show the current schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

