-- Обновляем роли в chat_members для поддержки администраторов
-- Роли: owner, admin, moderator, member

-- Добавляем комментарий к колонке role для документации
COMMENT ON COLUMN chat_members.role IS 'User role in chat: owner, admin, moderator, member';

-- Создаем функцию для проверки прав администратора канала
CREATE OR REPLACE FUNCTION public.is_channel_admin(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_members cm
    JOIN chats c ON c.id = cm.chat_id
    WHERE cm.chat_id = p_chat_id
      AND cm.user_id = p_user_id
      AND c.chat_type = 'channel'
      AND cm.role IN ('owner', 'admin')
  );
$$;

-- Обновляем политику для обновления членов канала - разрешаем админам
DROP POLICY IF EXISTS "Admins can update member roles" ON chat_members;
CREATE POLICY "Admins can update member roles"
ON chat_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
);

-- Создаем таблицу для отслеживания непрочитанных сообщений в каналах
CREATE TABLE IF NOT EXISTS public.channel_read_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  last_read_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  last_read_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, chat_id)
);

-- Включаем RLS для channel_read_markers
ALTER TABLE public.channel_read_markers ENABLE ROW LEVEL SECURITY;

-- Политики для channel_read_markers
CREATE POLICY "Users can view their own read markers"
ON channel_read_markers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read markers"
ON channel_read_markers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read markers"
ON channel_read_markers
FOR UPDATE
USING (auth.uid() = user_id);

-- Добавляем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_channel_read_markers_user_chat 
ON channel_read_markers(user_id, chat_id);

CREATE INDEX IF NOT EXISTS idx_chat_members_role 
ON chat_members(role) WHERE role IN ('owner', 'admin');