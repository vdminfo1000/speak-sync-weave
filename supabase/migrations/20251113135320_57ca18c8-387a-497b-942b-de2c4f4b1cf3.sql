-- Обновление функции create_chat_with_members для поддержки массива участников

DROP FUNCTION IF EXISTS public.create_chat_with_members(uuid, boolean);
DROP FUNCTION IF EXISTS public.create_chat_with_members(uuid[]);
DROP FUNCTION IF EXISTS public.create_chat_with_members(uuid[], text);

CREATE FUNCTION public.create_chat_with_members(
  member_ids uuid[],
  chat_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_chat_id uuid;
  member_id uuid;
  is_group_chat boolean;
BEGIN
  -- Проверка, что текущий пользователь в списке участников
  IF NOT (auth.uid() = ANY(member_ids)) THEN
    RAISE EXCEPTION 'Unauthorized: You must be a member of the chat you create';
  END IF;
  
  -- Определяем, групповой ли это чат
  is_group_chat := array_length(member_ids, 1) > 2;
  
  -- Создаем чат
  INSERT INTO chats (is_group, name, chat_type) 
  VALUES (
    is_group_chat,
    chat_name,
    CASE 
      WHEN is_group_chat THEN 'group'
      ELSE 'private'
    END
  )
  RETURNING id INTO new_chat_id;
  
  -- Добавляем всех участников
  FOREACH member_id IN ARRAY member_ids
  LOOP
    INSERT INTO chat_members (chat_id, user_id, role)
    VALUES (
      new_chat_id,
      member_id,
      CASE 
        WHEN member_id = auth.uid() THEN 'owner'
        ELSE 'member'
      END
    );
  END LOOP;
  
  RETURN new_chat_id;
END;
$$;