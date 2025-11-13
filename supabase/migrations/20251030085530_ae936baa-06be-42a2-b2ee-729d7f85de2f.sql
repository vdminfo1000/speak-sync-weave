-- Удаляем существующую политику создания чатов (если есть)
DROP POLICY IF EXISTS "Users can create chats" ON public.chats;

-- Создаем правильную политику INSERT для авторизованных пользователей
CREATE POLICY "Authenticated users can create chats"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Добавляем политику UPDATE для участников чата
CREATE POLICY "Chat members can update chat"
ON public.chats
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

-- Добавляем политику DELETE для участников чата
CREATE POLICY "Chat members can delete chat"
ON public.chats
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);