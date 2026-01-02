-- Apply the figures library migration
-- Run this in your Supabase SQL Editor

-- First, check if the table already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blueprint_unit_figures') THEN
        RAISE NOTICE 'blueprint_unit_figures table does not exist - will create it';
    ELSE
        RAISE NOTICE 'blueprint_unit_figures table already exists - skipping';
    END IF;
END $$;

-- Create the tables from the migration file
\i supabase/migrations/add_figures_library.sql

