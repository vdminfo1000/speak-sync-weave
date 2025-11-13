-- Fix chat_members SELECT policy to allow viewing all members in user's chats
DROP POLICY IF EXISTS "jwt_verified_view_members" ON chat_members;

CREATE POLICY "Users can view members of their chats"
ON chat_members FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
  )
);

-- Add database constraint for message length
ALTER TABLE messages ADD CONSTRAINT message_length_check CHECK (length(content) > 0 AND length(content) <= 2000);