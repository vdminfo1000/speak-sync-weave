
-- Fix RLS policies for group chat creation
-- Drop and recreate the insert policy for chats table to ensure it works correctly
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;

-- Create a clear policy that allows authenticated users to create chats
CREATE POLICY "Authenticated users can create chats" 
ON public.chats 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure chat_members policies allow adding members during chat creation
-- This policy already exists but let's ensure it's correct
DROP POLICY IF EXISTS "Authenticated users can add themselves as members" ON public.chat_members;

CREATE POLICY "Authenticated users can add themselves as members" 
ON public.chat_members 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also ensure we can add other members when creating a chat
-- We need a more permissive policy for initial chat creation
DROP POLICY IF EXISTS "Chat creators can add initial members" ON public.chat_members;

CREATE POLICY "Chat creators can add initial members" 
ON public.chat_members 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Allow if user is adding themselves
  auth.uid() = user_id 
  OR 
  -- Or if they're an owner/admin of the chat (for adding others)
  EXISTS (
    SELECT 1 FROM chat_members cm 
    WHERE cm.chat_id = chat_members.chat_id 
    AND cm.user_id = auth.uid() 
    AND cm.role IN ('owner', 'admin')
  )
);
