-- Fix infinite recursion in RLS policies
-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can add chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can remove chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can update chat member roles" ON public.chat_members;
DROP POLICY IF EXISTS "members_can_add_other_members" ON public.chat_members;
DROP POLICY IF EXISTS "users_can_add_self_as_first_member" ON public.chat_members;
DROP POLICY IF EXISTS "users_can_view_chat_members" ON public.chat_members;

DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can create chats" ON public.chats;
DROP POLICY IF EXISTS "Users can update their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can delete their chats" ON public.chats;
DROP POLICY IF EXISTS "authenticated_can_create_chats" ON public.chats;
DROP POLICY IF EXISTS "users_can_view_member_chats" ON public.chats;
DROP POLICY IF EXISTS "users_can_update_member_chats" ON public.chats;

-- Create non-recursive policies for chat_members
CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "chat_members_insert" ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_members_delete" ON public.chat_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "chat_members_update" ON public.chat_members
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create non-recursive policies for chats
CREATE POLICY "chats_select" ON public.chats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "chats_insert" ON public.chats
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "chats_update" ON public.chats
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "chats_delete" ON public.chats
  FOR DELETE
  TO authenticated
  USING (true);