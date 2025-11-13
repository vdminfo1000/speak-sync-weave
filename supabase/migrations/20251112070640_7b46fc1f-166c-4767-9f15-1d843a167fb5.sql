-- 1) Functions to avoid recursion
CREATE OR REPLACE FUNCTION public.user_is_member_of_chat(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_members
    WHERE user_id = auth.uid() AND chat_id = p_chat_id
  );
$$;

-- 2) Fix chat_members SELECT policy (remove self-reference)
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON chat_members;
CREATE POLICY "Users can view chat members of their chats"
ON chat_members
FOR SELECT
USING (
  -- see own membership or other members if user is a member of the chat
  user_id = auth.uid() OR public.user_is_member_of_chat(chat_members.chat_id)
);

-- 3) Rebuild profiles SELECT policies using definer functions only
DROP POLICY IF EXISTS "Users can view relevant profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles of chat members" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles from chat requests" ON profiles;

CREATE POLICY "Users can view profiles (self or connected)"
ON profiles
FOR SELECT
USING (
  id = auth.uid()
  OR public.is_chat_member_with_user(id)
  OR public.has_chat_request_with_user(id)
);

-- 4) Storage policies for avatars bucket (ensure upload works and public read)
-- Make avatar files publicly readable
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to upsert their own avatar under a folder named with their user id
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);