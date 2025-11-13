-- Add RLS policies for storage buckets to ensure files are accessible

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their ringtones" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their ringtones" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their ringtones" ON storage.objects;

-- Policy for message-attachments bucket (private files)
CREATE POLICY "Users can view their chat attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments' 
  AND auth.uid() IS NOT NULL
  AND (
    -- User is member of the chat
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.chat_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Users can upload to their chats"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments' 
  AND auth.uid() IS NOT NULL
  AND (
    -- User is member of the chat
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.chat_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Users can delete their chat attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message-attachments' 
  AND auth.uid() IS NOT NULL
  AND (
    -- User uploaded the file
    owner = auth.uid()
  )
);

-- Policy for ringtones bucket (private files)
CREATE POLICY "Users can view their ringtones"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ringtones' 
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);

CREATE POLICY "Users can upload their ringtones"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ringtones' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their ringtones"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ringtones' 
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);