-- Add optional image_url column to listening_passages
ALTER TABLE listening_passages ADD COLUMN IF NOT EXISTS image_url TEXT;
