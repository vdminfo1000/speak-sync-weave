-- Улучшаем RLS политики для стабильной работы групповых чатов и доступа к контактам

-- Обеспечиваем доступ к профилям для всех аутентифицированных пользователей
DROP POLICY IF EXISTS "Users can view profiles (self or connected)" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Authenticated users can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Улучшаем политики для chat_members
DROP POLICY IF EXISTS "Chat creators can add initial members" ON chat_members;
DROP POLICY IF EXISTS "Chat creators can add other members" ON chat_members;

CREATE POLICY "Authenticated users can add chat members"
ON chat_members FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- Пользователь может добавить себя
    auth.uid() = user_id OR
    -- Или пользователь является владельцем/админом чата
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = chat_members.chat_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  )
);