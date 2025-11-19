-- Fix RLS policy for adding members to group chats
-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;

-- Create a new policy that allows:
-- 1. Users to add themselves to any chat
-- 2. Chat creators/owners to add other members
CREATE POLICY "chat_members_insert_fixed" ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.chat_id = chat_members.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
    )
  );