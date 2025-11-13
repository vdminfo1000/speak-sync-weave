-- Drop all problematic recursive policies
DROP POLICY IF EXISTS "Users can view profiles of chat members" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles from chat requests" ON profiles;
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON chat_members;

-- Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_chat_member_with_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_members cm1
    JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_chat_request_with_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_requests
    WHERE (sender_id = auth.uid() AND receiver_id = target_user_id)
       OR (receiver_id = auth.uid() AND sender_id = target_user_id)
  );
$$;

-- Recreate chat_members policy without recursion
CREATE POLICY "Users can view chat members of their chats"
ON chat_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  chat_id IN (
    SELECT chat_id 
    FROM chat_members 
    WHERE user_id = auth.uid()
  )
);

-- Recreate profiles policies using security definer functions
CREATE POLICY "Users can view profiles of chat members"
ON profiles
FOR SELECT
USING (
  id = auth.uid()
  OR public.is_chat_member_with_user(id)
  OR public.has_chat_request_with_user(id)
);