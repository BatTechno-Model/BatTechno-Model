-- Add avatar column to Profile table if it doesn't exist
-- Run this script in Neon SQL Editor or PostgreSQL

DO $$ 
BEGIN
    -- Check if column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Profile' 
        AND column_name = 'avatar'
    ) THEN
        ALTER TABLE "Profile" ADD COLUMN "avatar" TEXT;
        RAISE NOTICE 'Column avatar added successfully';
    ELSE
        RAISE NOTICE 'Column avatar already exists';
    END IF;
END $$;
