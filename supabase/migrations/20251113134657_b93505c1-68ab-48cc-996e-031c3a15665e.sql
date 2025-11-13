-- Создание полной структуры БД для мессенджера (исправленный порядок)

-- 1. Создание таблицы профилей
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  phone_number TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 2. Создание таблицы чатов (БЕЗ политик)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 3. Создание таблицы участников чатов
CREATE TABLE IF NOT EXISTS public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_verified_insert_members"
ON public.chat_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "jwt_verified_view_members"
ON public.chat_members FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "jwt_verified_update_members"
ON public.chat_members FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "jwt_verified_delete_members"
ON public.chat_members FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (auth.uid() = user_id OR
   EXISTS (
     SELECT 1 FROM public.chat_members cm
     WHERE cm.chat_id = chat_members.chat_id
     AND cm.user_id = auth.uid()
     AND cm.role IN ('owner', 'admin')
   ))
);

-- 4. ТЕПЕРЬ создаем политики для chats (после того как chat_members уже есть)
CREATE POLICY "jwt_verified_create_chats"
ON public.chats FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "jwt_verified_view_chats"
ON public.chats FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "jwt_verified_update_chats"
ON public.chats FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "jwt_verified_delete_chats"
ON public.chats FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

-- 5. Создание таблицы сообщений
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

CREATE POLICY "jwt_verified_insert_messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "jwt_verified_view_messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "jwt_verified_update_messages"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = sender_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

CREATE POLICY "jwt_verified_delete_messages"
ON public.messages FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

-- 6. Создание таблицы запросов на чат
CREATE TABLE IF NOT EXISTS public.chat_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_verified_send_requests"
ON public.chat_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = sender_id 
  AND sender_id <> receiver_id
);

CREATE POLICY "jwt_verified_view_requests"
ON public.chat_requests FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (auth.uid() = sender_id OR auth.uid() = receiver_id)
);

CREATE POLICY "jwt_verified_update_requests"
ON public.chat_requests FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = receiver_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = receiver_id);

CREATE POLICY "jwt_verified_delete_requests"
ON public.chat_requests FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

-- 7. Создание таблицы истории звонков
CREATE TABLE IF NOT EXISTS public.call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'audio', 'group-video', 'group-audio')),
  status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'declined', 'no-answer')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration INTEGER DEFAULT 0,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their call history"
ON public.call_history FOR SELECT
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert call history"
ON public.call_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their call history"
ON public.call_history FOR UPDATE
TO authenticated
USING (auth.uid() = caller_id);

-- 8. Создание таблицы отметок о прочтении
CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view message reads in their chats"
ON public.message_reads FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chat_members cm ON m.chat_id = cm.chat_id
    WHERE m.id = message_reads.message_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own reads"
ON public.message_reads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 9. Создание таблицы рингтонов
CREATE TABLE IF NOT EXISTS public.user_ringtones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ringtone_url TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

ALTER TABLE public.user_ringtones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their ringtones"
ON public.user_ringtones FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 10. Создание функции для обновления updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 11. Создание триггеров для updated_at
CREATE TRIGGER set_updated_at_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_chats
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_chat_requests
BEFORE UPDATE ON public.chat_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 12. Создание функции для автоматического создания профиля
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, phone_number, display_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'phone_number',
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', 'User')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Создание функции для создания чата с участниками
CREATE OR REPLACE FUNCTION public.create_chat_with_members(
  other_user_id uuid,
  is_group_chat boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_chat_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  INSERT INTO chats (is_group) 
  VALUES (is_group_chat)
  RETURNING id INTO new_chat_id;
  
  INSERT INTO chat_members (chat_id, user_id, role) VALUES
    (new_chat_id, auth.uid(), 'owner'),
    (new_chat_id, other_user_id, 'member');
  
  RETURN new_chat_id;
END;
$$;

-- 14. Создание функции поиска профилей
CREATE OR REPLACE FUNCTION public.public_profile_search(search_query text)
RETURNS TABLE (
  id uuid,
  username text,
  phone_number text,
  display_name text,
  avatar_url text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.phone_number,
    p.display_name,
    p.avatar_url,
    p.status
  FROM profiles p
  WHERE 
    p.username ILIKE '%' || search_query || '%' OR
    p.phone_number ILIKE '%' || search_query || '%' OR
    p.display_name ILIKE '%' || search_query || '%'
  LIMIT 10;
END;
$$;

-- 15. Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_chat_requests_receiver ON public.chat_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_sender ON public.chat_requests(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_call_history_receiver ON public.call_history(receiver_id, started_at DESC);

-- 16. Включение realtime для необходимых таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;

-- 17. Создание storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('ringtones', 'ringtones', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- 18. Создание политик для storage
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own ringtones"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ringtones' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own ringtones"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ringtones' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own ringtones"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ringtones' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own ringtones"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ringtones' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Chat members can view chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files' 
  AND EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.user_id = auth.uid()
    AND (storage.foldername(name))[1]::uuid = cm.chat_id
  )
);

CREATE POLICY "Chat members can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.user_id = auth.uid()
    AND (storage.foldername(name))[1]::uuid = cm.chat_id
  )
);