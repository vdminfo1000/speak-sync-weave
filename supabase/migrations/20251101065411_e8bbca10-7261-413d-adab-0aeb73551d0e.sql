-- Fix infinite recursion in chat_members policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view members of their chats" ON chat_members;

-- Create security definer function to check chat membership
CREATE OR REPLACE FUNCTION public.is_chat_member(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_members
    WHERE chat_id = _chat_id
    AND user_id = _user_id
  );
$$;

-- Create new policy using the security definer function
CREATE POLICY "Users can view members of their chats" 
ON chat_members 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.is_chat_member(chat_id, auth.uid())
);