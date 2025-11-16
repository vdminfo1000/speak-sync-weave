-- Fix RLS policies for chats table to allow group chat creation

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can create chats" ON public.chats;
DROP POLICY IF EXISTS "jwt_verified_insert_chats" ON public.chats;

-- Create new policy that allows authenticated users to create chats
CREATE POLICY "Authenticated users can create chats"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure chat_members policies allow adding members during group creation
DROP POLICY IF EXISTS "Users can add members to chats" ON public.chat_members;
DROP POLICY IF EXISTS "jwt_verified_insert_members" ON public.chat_members;

CREATE POLICY "Authenticated users can add themselves as members"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Chat creators can add other members"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
);