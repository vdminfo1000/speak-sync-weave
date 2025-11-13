-- Add columns for message attachments, editing and deletion (if not exist)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Drop old restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can upload to their chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can read chat files" ON storage.objects;

-- Create new RLS policy for profiles (restrict to chat participants only)
CREATE POLICY "Users can view relevant profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.chat_members cm1
    JOIN public.chat_members cm2 ON cm1.chat_id = cm2.chat_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
  ) OR
  EXISTS (
    SELECT 1 FROM public.chat_requests
    WHERE (sender_id = auth.uid() AND receiver_id = profiles.id)
       OR (receiver_id = auth.uid() AND sender_id = profiles.id)
  )
);

-- RLS policy: Users can update their own messages
CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
      AND chat_members.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
      AND chat_members.user_id = auth.uid()
  )
);

-- RLS policy: Users can delete (soft delete) their own messages
CREATE POLICY "Users can delete their own messages"
ON public.messages FOR DELETE
TO authenticated
USING (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
      AND chat_members.user_id = auth.uid()
  )
);

-- RLS policy: Users can upload files to their chats
CREATE POLICY "Users can upload to their chats"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  auth.uid() IS NOT NULL
);

-- RLS policy: Users can read files from their chats
CREATE POLICY "Users can read chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chat_members cm ON m.chat_id = cm.chat_id
    WHERE cm.user_id = auth.uid()
      AND m.file_url LIKE '%' || name || '%'
  )
);