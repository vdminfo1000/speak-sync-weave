-- Add forwarding support to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS forwarded_from_chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL;

-- Add channel type support to chats
ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS chat_type text DEFAULT 'private' CHECK (chat_type IN ('private', 'group', 'channel'));

-- Add admin/owner roles to chat_members
ALTER TABLE public.chat_members
ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from ON public.messages(forwarded_from_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_role ON public.chat_members(role);
CREATE INDEX IF NOT EXISTS idx_chats_type ON public.chats(chat_type);

-- Update RLS policies for channels (read-only for members)
CREATE POLICY "Channel members can only read messages"
ON public.messages
FOR INSERT
WITH CHECK (
  (auth.uid() = sender_id) AND 
  (
    NOT EXISTS (
      SELECT 1 FROM public.chats 
      WHERE chats.id = messages.chat_id AND chats.chat_type = 'channel'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.chat_members cm
      JOIN public.chats c ON c.id = cm.chat_id
      WHERE cm.chat_id = messages.chat_id 
      AND cm.user_id = auth.uid()
      AND c.chat_type = 'channel'
      AND cm.role IN ('owner', 'admin')
    )
  )
);

-- Add comment for clarity
COMMENT ON COLUMN public.messages.forwarded_from_message_id IS 'Reference to original message if this is a forwarded message';
COMMENT ON COLUMN public.chats.chat_type IS 'Type of chat: private (1-on-1), group (multi-user), or channel (broadcast)';
COMMENT ON COLUMN public.chat_members.role IS 'User role in chat: owner, admin, or member';