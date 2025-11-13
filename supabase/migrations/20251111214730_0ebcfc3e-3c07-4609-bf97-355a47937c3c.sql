-- ============================================
-- CRITICAL SECURITY FIXES (CORRECTED)
-- ============================================

-- 1. FIX INFINITE RECURSION IN chat_members RLS POLICY
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON public.chat_members;

CREATE POLICY "Users can view chat members of their chats"
ON public.chat_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  chat_id IN (
    SELECT chat_id FROM public.chat_members WHERE user_id = auth.uid()
  )
);

-- 2. FIX PROFILE SEARCH FUNCTION - Prevent SQL Injection & RLS Bypass
CREATE OR REPLACE FUNCTION public.public_profile_search(search_query text)
RETURNS TABLE(id uuid, username text, full_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
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
  SELECT p.id, p.username, p.full_name, p.avatar_url
  FROM profiles p
  WHERE p.id != auth.uid()
    AND (
      p.username ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      p.full_name ILIKE '%' || v_safe_query || '%' ESCAPE '\'
    )
  LIMIT 20;
END;
$$;

-- 3. FIX FILE STORAGE ACCESS POLICY
DROP POLICY IF EXISTS "Users can read chat files" ON storage.objects;

CREATE POLICY "Users can read chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 
    FROM public.messages m
    JOIN public.chat_members cm ON m.chat_id = cm.chat_id
    WHERE cm.user_id = auth.uid()
      AND m.file_url LIKE '%/' || name
  )
);

-- 4. ADD AUTHORIZATION TO create_chat_with_members FUNCTION
CREATE OR REPLACE FUNCTION public.create_chat_with_members(
  member_ids uuid[], 
  chat_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_chat_id UUID;
  member_id UUID;
BEGIN
  IF NOT (auth.uid() = ANY(member_ids)) THEN
    RAISE EXCEPTION 'Unauthorized: You must be a member of the chat you create';
  END IF;
  
  IF array_length(member_ids, 1) = 2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM chat_requests
      WHERE status = 'accepted'
        AND (
          (sender_id = member_ids[1] AND receiver_id = member_ids[2]) OR
          (sender_id = member_ids[2] AND receiver_id = member_ids[1])
        )
    ) THEN
      RAISE EXCEPTION 'A chat request must be accepted before creating a 1-on-1 chat';
    END IF;
  END IF;
  
  INSERT INTO public.chats (name, is_group)
  VALUES (chat_name, array_length(member_ids, 1) > 2)
  RETURNING id INTO new_chat_id;
  
  FOREACH member_id IN ARRAY member_ids
  LOOP
    INSERT INTO public.chat_members (chat_id, user_id)
    VALUES (new_chat_id, member_id);
  END LOOP;
  
  RETURN new_chat_id;
END;
$$;

-- 5. FIX SEARCH PATH FOR update_updated_at_column FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 6. ADD PHONE NUMBER VALIDATION
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS phone_number_format;

ALTER TABLE public.profiles
ADD CONSTRAINT phone_number_format
CHECK (
  phone_number IS NULL OR
  (
    length(phone_number) BETWEEN 10 AND 15 AND
    phone_number ~ '^\+?[0-9]+$'
  )
);

-- 7. RATE LIMITING INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rate limits" ON public.rate_limits;
CREATE POLICY "Users can view own rate limits"
ON public.rate_limits FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;
CREATE POLICY "System can manage rate limits"
ON public.rate_limits FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  SELECT count, window_start INTO v_count, v_window_start
  FROM rate_limits
  WHERE user_id = auth.uid() AND action = p_action;
  
  IF v_window_start IS NULL OR 
     v_window_start < now() - (p_window_minutes || ' minutes')::interval THEN
    INSERT INTO rate_limits (user_id, action, count, window_start)
    VALUES (auth.uid(), p_action, 1, now())
    ON CONFLICT (user_id, action) DO UPDATE
    SET count = 1, window_start = now();
    RETURN true;
  END IF;
  
  IF v_count >= p_max_requests THEN
    RAISE EXCEPTION 'Rate limit exceeded for action: %. Try again later.', p_action;
  END IF;
  
  UPDATE rate_limits
  SET count = count + 1
  WHERE user_id = auth.uid() AND action = p_action;
  
  RETURN true;
END;
$$;

-- Apply rate limiting to search function
CREATE OR REPLACE FUNCTION public.public_profile_search(search_query text)
RETURNS TABLE(id uuid, username text, full_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_safe_query text;
BEGIN
  PERFORM check_rate_limit('profile_search', 30, 1);
  
  IF length(trim(search_query)) < 2 THEN
    RAISE EXCEPTION 'Search query must be at least 2 characters';
  END IF;
  
  IF length(search_query) > 50 THEN
    RAISE EXCEPTION 'Search query too long (max 50 characters)';
  END IF;
  
  v_safe_query := replace(trim(search_query), '%', '\%');
  v_safe_query := replace(v_safe_query, '_', '\_');
  
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_url
  FROM profiles p
  WHERE p.id != auth.uid()
    AND (
      p.username ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      p.full_name ILIKE '%' || v_safe_query || '%' ESCAPE '\'
    )
  LIMIT 20;
END;
$$;