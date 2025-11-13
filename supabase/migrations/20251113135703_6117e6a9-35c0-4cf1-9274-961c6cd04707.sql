-- Финальные дополнения из пропущенных миграций

-- 1. Создание bucket message-attachments (код ожидает именно это имя)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage политики для message-attachments
DROP POLICY IF EXISTS "Users can upload files to their chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can read chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files from their chats" ON storage.objects;

CREATE POLICY "Users can upload files to their chats"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_id::text = (storage.foldername(name))[1]
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can read chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 
    FROM messages m
    JOIN chat_members cm ON m.chat_id = cm.chat_id
    WHERE cm.user_id = auth.uid()
    AND m.file_url LIKE '%/' || name
  )
);

-- 3. Создание алиаса функции users_share_chat (некоторый код может ее использовать)
CREATE OR REPLACE FUNCTION public.users_share_chat(user1_id uuid, user2_id uuid)
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
    WHERE cm1.user_id = user1_id
      AND cm2.user_id = user2_id
  );
$$;

-- 4. Обновление функции поиска профилей (убрать несуществующий check_rate_limit)
DROP FUNCTION IF EXISTS public.public_profile_search(text);

CREATE FUNCTION public.public_profile_search(search_query text)
RETURNS TABLE(id uuid, username text, phone_number text, full_name text, avatar_url text, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_safe_query text;
BEGIN
  IF length(trim(search_query)) < 2 THEN
    RAISE EXCEPTION 'Search query must be at least 2 characters';
  END IF;
  
  IF length(search_query) > 50 THEN
    RAISE EXCEPTION 'Search query too long (max 50 characters)';
  END IF;
  
  v_safe_query := replace(trim(search_query), '%', '\%');
  v_safe_query := replace(v_safe_query, '_', '\_');
  
  RETURN QUERY
  SELECT p.id, p.username, p.phone_number, p.full_name, p.avatar_url, p.status
  FROM profiles p
  WHERE p.id != auth.uid()
    AND p.is_public = true
    AND (
      p.username ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      COALESCE(p.full_name, '') ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      COALESCE(p.phone_number, '') ILIKE '%' || v_safe_query || '%' ESCAPE '\'
    )
  LIMIT 20;
END;
$$;

-- 5. Проверка и добавление необходимых индексов
CREATE INDEX IF NOT EXISTS idx_messages_file_url ON messages(file_url) WHERE file_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at DESC);

-- 6. Комментарии для документации
COMMENT ON FUNCTION public.users_share_chat IS 'Checks if two users share any common chats';
COMMENT ON FUNCTION public.is_chat_member_with_user IS 'Checks if current user shares a chat with target user';
COMMENT ON FUNCTION public.has_chat_request_with_user IS 'Checks if current user has chat request with target user';
COMMENT ON FUNCTION public.user_is_member_of_chat IS 'Checks if current user is member of specific chat';