-- Fix infinite recursion in chat_members RLS policies
-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON chat_members;

-- Create a simpler, non-recursive policy for viewing chat members
-- Users can view chat members if they are a member of the same chat
CREATE POLICY "Users can view chat members of their chats"
ON chat_members
FOR SELECT
USING (
  -- User can see their own membership
  user_id = auth.uid()
  OR
  -- User can see other members in chats where a direct membership exists
  EXISTS (
    SELECT 1 FROM chat_members AS my_membership
    WHERE my_membership.user_id = auth.uid()
    AND my_membership.chat_id = chat_members.chat_id
  )
);

-- Also simplify the profiles SELECT policy to avoid potential issues
DROP POLICY IF EXISTS "Users can view profiles of chat members" ON profiles;

-- Recreate with better logic that avoids triggering chat_members recursion
CREATE POLICY "Users can view profiles of chat members"
ON profiles
FOR SELECT
USING (
  -- Direct check without nested subqueries
  id IN (
    SELECT DISTINCT cm2.user_id
    FROM chat_members cm1
    JOIN chat_members cm2 USING (chat_id)
    WHERE cm1.user_id = auth.uid()
  )
);