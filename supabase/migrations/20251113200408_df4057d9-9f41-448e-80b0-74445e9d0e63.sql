-- Create table for group join requests
CREATE TABLE IF NOT EXISTS group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_join_requests
CREATE POLICY "Users can view join requests they sent or received"
  ON group_join_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Members can send join requests"
  ON group_join_requests FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id 
    AND EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_id = group_join_requests.chat_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Receivers can update join requests"
  ON group_join_requests FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Add channel permissions to chats table
ALTER TABLE chats 
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_reactions BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_file_uploads BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Create index for faster channel searches
CREATE INDEX IF NOT EXISTS idx_chats_public ON chats(is_public) WHERE is_public = true;

-- Create table for message delivery tracking
CREATE TABLE IF NOT EXISTS message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE message_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_deliveries
CREATE POLICY "Users can view deliveries in their chats"
  ON message_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE m.id = message_deliveries.message_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own deliveries"
  ON message_deliveries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE group_join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE message_deliveries;