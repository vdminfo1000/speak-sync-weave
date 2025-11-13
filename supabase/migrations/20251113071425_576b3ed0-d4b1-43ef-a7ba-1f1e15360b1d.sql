-- Fix chat_members INSERT policy to allow group/channel creators to add members
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can insert themselves into chats" ON public.chat_members;

-- Create new policy that allows:
-- 1. Users to add themselves to any chat
-- 2. Existing owners/admins to add other members
CREATE POLICY "Users can add members to chats"
ON public.chat_members
FOR INSERT
WITH CHECK (
  -- User can add themselves
  auth.uid() = user_id
  OR
  -- User is owner/admin of this chat and can add others
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);