-- Fix RLS policies for group chat creation
-- Drop ALL existing policies for chats
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'chats' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON chats', pol.policyname);
    END LOOP;
END $$;

-- Drop ALL existing policies for chat_members
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'chat_members' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON chat_members', pol.policyname);
    END LOOP;
END $$;

-- Create comprehensive policies for chats table
CREATE POLICY "authenticated_can_create_chats"
ON chats FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "users_can_view_member_chats"
ON chats FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "users_can_update_member_chats"
ON chats FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

-- Create policies for chat_members
CREATE POLICY "users_can_view_chat_members"
ON chat_members FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "users_can_add_self_as_first_member"
ON chat_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "members_can_add_other_members"
ON chat_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_members AS existing
    WHERE existing.chat_id = chat_members.chat_id
    AND existing.user_id = auth.uid()
  )
);