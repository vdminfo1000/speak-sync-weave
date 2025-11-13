-- Комплексное обновление БД с исправлениями безопасности и новыми функциями

-- 1. СОЗДАНИЕ SECURITY DEFINER ФУНКЦИЙ для избежания рекурсии RLS
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

-- 2. ДОБАВЛЕНИЕ НОВЫХ ПОЛЕЙ В СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true NOT NULL;

ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS chat_type text DEFAULT 'private' CHECK (chat_type IN ('private', 'group', 'channel'));

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS forwarded_from_chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS replied_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- 3. СОЗДАНИЕ ТАБЛИЦЫ РЕАКЦИЙ НА СООБЩЕНИЯ
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- 4. УДАЛЕНИЕ СТАРЫХ ПРОБЛЕМНЫХ ПОЛИТИК
DROP POLICY IF EXISTS "Users can view profiles of chat members" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles from chat requests" ON profiles;
DROP POLICY IF EXISTS "Users can view relevant profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can insert themselves into chats" ON chat_members;
DROP POLICY IF EXISTS "Users can create chats" ON chats;
DROP POLICY IF EXISTS "Channel members can only read messages" ON messages;

-- 5. СОЗДАНИЕ НОВЫХ БЕЗОПАСНЫХ ПОЛИТИК ДЛЯ PROFILES
CREATE POLICY "Users can view profiles (self or connected)"
ON profiles
FOR SELECT
USING (
  id = auth.uid()
  OR is_public = true
  OR public.is_chat_member_with_user(id)
  OR public.has_chat_request_with_user(id)
);

-- 6. СОЗДАНИЕ НОВЫХ ПОЛИТИК ДЛЯ CHAT_MEMBERS
CREATE POLICY "Users can view chat members of their chats"
ON chat_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.user_is_member_of_chat(chat_members.chat_id)
);

CREATE POLICY "Users can add members to chats"
ON chat_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can delete members"
ON chat_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update member roles"
ON chat_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- 7. СОЗДАНИЕ НОВЫХ ПОЛИТИК ДЛЯ CHATS
CREATE POLICY "Users can create chats"
ON chats
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update chat details"
ON chats
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
    AND chat_members.role IN ('owner', 'admin')
  )
);

-- 8. ПОЛИТИКА ДЛЯ КАНАЛОВ (только админы могут писать)
CREATE POLICY "Channel members can only read messages"
ON messages
FOR INSERT
WITH CHECK (
  (auth.uid() = sender_id) AND 
  (
    NOT EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id AND chats.chat_type = 'channel'
    )
    OR
    EXISTS (
      SELECT 1 FROM chat_members cm
      JOIN chats c ON c.id = cm.chat_id
      WHERE cm.chat_id = messages.chat_id 
      AND cm.user_id = auth.uid()
      AND c.chat_type = 'channel'
      AND cm.role IN ('owner', 'admin')
    )
  )
);

-- 9. ПОЛИТИКИ ДЛЯ MESSAGE_REACTIONS
CREATE POLICY "Users can view reactions in their chats"
ON message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN chat_members cm ON cm.chat_id = m.chat_id
    WHERE m.id = message_reactions.message_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add reactions"
ON message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM messages m
    JOIN chat_members cm ON cm.chat_id = m.chat_id
    WHERE m.id = message_reactions.message_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own reactions"
ON message_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- 10. ОБНОВЛЕНИЕ ФУНКЦИИ ПОИСКА ПРОФИЛЕЙ
DROP FUNCTION IF EXISTS public.public_profile_search(text);

CREATE OR REPLACE FUNCTION public.public_profile_search(search_query text)
RETURNS TABLE(id uuid, username text, phone_number text, display_name text, avatar_url text, status text)
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
  SELECT p.id, p.username, p.phone_number, p.display_name, p.avatar_url, p.status
  FROM profiles p
  WHERE p.id != auth.uid()
    AND p.is_public = true
    AND (
      p.username ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      COALESCE(p.display_name, '') ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      COALESCE(p.phone_number, '') ILIKE '%' || v_safe_query || '%' ESCAPE '\'
    )
  LIMIT 20;
END;
$$;

-- 11. СОЗДАНИЕ ИНДЕКСОВ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from ON messages(forwarded_from_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_replied_to ON messages(replied_to_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_role ON chat_members(role);
CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(chat_type);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON profiles(is_public);

-- 12. ВКЛЮЧЕНИЕ REALTIME ДЛЯ НОВЫХ ТАБЛИЦ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

-- 13. КОММЕНТАРИИ ДЛЯ ДОКУМЕНТАЦИИ
COMMENT ON COLUMN messages.forwarded_from_message_id IS 'Reference to original message if this is a forwarded message';
COMMENT ON COLUMN messages.replied_to_message_id IS 'Reference to message being replied to';
COMMENT ON COLUMN chats.chat_type IS 'Type of chat: private (1-on-1), group (multi-user), or channel (broadcast)';
COMMENT ON COLUMN chat_members.role IS 'User role in chat: owner, admin, or member';
COMMENT ON COLUMN profiles.is_public IS 'Whether profile is visible in public search results';