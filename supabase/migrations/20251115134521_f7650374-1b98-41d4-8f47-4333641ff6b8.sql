-- Добавить политику для просмотра публичных каналов
CREATE POLICY "Anyone can view public channels"
ON public.chats
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND is_public = true 
  AND chat_type = 'channel'
);

-- Добавить колонку description для каналов
ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS description text;