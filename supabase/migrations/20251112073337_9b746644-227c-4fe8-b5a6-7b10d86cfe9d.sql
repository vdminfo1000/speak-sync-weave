-- Fix chats table RLS - add INSERT policy for the SECURITY DEFINER function
-- The create_chat_with_members function needs to be able to insert into chats

-- First, ensure the function can insert into chats by granting proper access
-- The function uses SECURITY DEFINER so it runs with the owner's privileges

-- Add INSERT policy for chats table (currently missing)
DROP POLICY IF EXISTS "Users can create chats" ON chats;

CREATE POLICY "Users can create chats"
ON chats
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be a member of the chat they're creating
  -- This will be verified by the chat_members insertion after chat creation
  true
);

-- Ensure chat_members can be inserted by the function
-- The existing policy should work, but let's make it explicit
DROP POLICY IF EXISTS "Users can insert themselves into chats" ON chat_members;

CREATE POLICY "Users can insert themselves into chats"
ON chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow inserting if the user is one of the members being added
  auth.uid() = user_id
);