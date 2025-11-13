-- Fix public_profile_search function - remove rate limiting that causes read-only transaction error
DROP FUNCTION IF EXISTS public.public_profile_search(text);

CREATE OR REPLACE FUNCTION public.public_profile_search(search_query text)
RETURNS TABLE(id uuid, username text, full_name text, avatar_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_safe_query text;
BEGIN
  -- Input validation
  IF length(trim(search_query)) < 2 THEN
    RAISE EXCEPTION 'Search query must be at least 2 characters';
  END IF;
  
  IF length(search_query) > 50 THEN
    RAISE EXCEPTION 'Search query too long (max 50 characters)';
  END IF;
  
  -- Sanitize input
  v_safe_query := replace(trim(search_query), '%', '\%');
  v_safe_query := replace(v_safe_query, '_', '\_');
  
  -- Return public profiles matching the search
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_url
  FROM profiles p
  WHERE p.id != auth.uid()
    AND p.is_public = true
    AND (
      p.username ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      p.full_name ILIKE '%' || v_safe_query || '%' ESCAPE '\'
    )
  LIMIT 20;
END;
$$;

-- Update profiles RLS policy to allow viewing public profiles
DROP POLICY IF EXISTS "Users can view profiles (self or connected)" ON profiles;

CREATE POLICY "Users can view profiles (self or connected)"
ON profiles
FOR SELECT
USING (
  -- Own profile
  id = auth.uid()
  -- Public profiles (for search)
  OR is_public = true
  -- Connected via chat
  OR public.is_chat_member_with_user(id)
  -- Connected via chat request
  OR public.has_chat_request_with_user(id)
);