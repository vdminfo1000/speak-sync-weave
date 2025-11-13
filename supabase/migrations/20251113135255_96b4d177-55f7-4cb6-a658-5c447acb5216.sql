-- Исправление схемы БД для соответствия коду

-- 1. Переименование display_name в full_name в profiles
ALTER TABLE public.profiles 
RENAME COLUMN display_name TO full_name;

-- 2. Добавление недостающего поля ringtone_name
ALTER TABLE public.user_ringtones
ADD COLUMN IF NOT EXISTS ringtone_name TEXT;

-- 3. Удаление старой функции поиска
DROP FUNCTION IF EXISTS public.public_profile_search(text);

-- 4. Создание новой функции поиска профилей
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

-- 5. Обновление функции создания профиля
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, phone_number, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'phone_number',
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', 'User')
  );
  RETURN new;
END;
$$;