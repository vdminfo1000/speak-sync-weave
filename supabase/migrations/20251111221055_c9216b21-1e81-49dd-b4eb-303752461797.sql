-- Add is_public field to profiles table for profile visibility
ALTER TABLE public.profiles 
ADD COLUMN is_public boolean DEFAULT true NOT NULL;

-- Update the public_profile_search function to only return public profiles
CREATE OR REPLACE FUNCTION public.public_profile_search(search_query text)
RETURNS TABLE(id uuid, username text, full_name text, avatar_url text)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
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
    AND p.is_public = true
    AND (
      p.username ILIKE '%' || v_safe_query || '%' ESCAPE '\' OR
      p.full_name ILIKE '%' || v_safe_query || '%' ESCAPE '\'
    )
  LIMIT 20;
END;
$function$;