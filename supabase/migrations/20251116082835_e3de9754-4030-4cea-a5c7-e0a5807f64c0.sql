-- Fix RLS policy for creating chats
-- The current policy is too restrictive, preventing group chat creation
DROP POLICY IF EXISTS "jwt_verified_create_chats" ON chats;
DROP POLICY IF EXISTS "Users can create chats" ON chats;

-- Create a new policy that allows authenticated users to create chats
CREATE POLICY "Users can create chats" ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);