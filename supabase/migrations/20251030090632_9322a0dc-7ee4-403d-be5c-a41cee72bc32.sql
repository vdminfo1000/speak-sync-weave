-- Улучшаем политики безопасности с проверкой JWT для таблицы chat_requests

-- Удаляем старые политики для chat_requests
DROP POLICY IF EXISTS "Users can send chat requests" ON public.chat_requests;
DROP POLICY IF EXISTS "Users can view their requests" ON public.chat_requests;
DROP POLICY IF EXISTS "Users can update received requests" ON public.chat_requests;
DROP POLICY IF EXISTS "Users can delete their sent requests" ON public.chat_requests;

-- Создаем улучшенные политики с проверкой JWT для chat_requests
CREATE POLICY "Authenticated users can send chat requests"
ON public.chat_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = sender_id 
  AND sender_id <> receiver_id
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Users can view their own requests"
ON public.chat_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (auth.uid() = sender_id OR auth.uid() = receiver_id)
);

CREATE POLICY "Receivers can update their requests"
ON public.chat_requests
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = receiver_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = receiver_id);

CREATE POLICY "Senders can delete their requests"
ON public.chat_requests
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

-- Улучшаем политики безопасности для таблицы chat_members

-- Удаляем старые политики для chat_members
DROP POLICY IF EXISTS "Users can insert themselves into chats" ON public.chat_members;
DROP POLICY IF EXISTS "Users can view chats they are members of" ON public.chat_members;

-- Создаем улучшенные политики с проверкой JWT для chat_members
CREATE POLICY "Authenticated users can add themselves to chats"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Users can view their chat memberships"
ON public.chat_members
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Улучшаем политики безопасности для таблицы chats

-- Удаляем старую политику INSERT
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;

-- Создаем улучшенную политику INSERT с проверкой JWT
CREATE POLICY "Authenticated users can create chats with validation"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
);

-- Улучшаем политики для таблицы messages

-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;

-- Создаем улучшенные политики с проверкой JWT для messages
CREATE POLICY "Chat members can insert messages with validation"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = sender_id
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Chat members can view messages with validation"
ON public.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);