-- Add missing file_type column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS file_type text;

-- Add comment to trigger type regeneration
COMMENT ON COLUMN public.messages.file_type IS 'MIME type of attached file';