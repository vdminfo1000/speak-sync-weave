-- Drop existing view
DROP VIEW IF EXISTS public.public_profile_search;

-- Create a security definer function to search public profiles
CREATE OR REPLACE FUNCTION public.search_public_profiles(search_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    username,
    display_name,
    avatar_url
  FROM public.profiles
  WHERE username ILIKE '%' || search_username || '%'
  LIMIT 10;
$$;

-- Create view for public profile search that all authenticated users can access
CREATE VIEW public.public_profile_search 
WITH (security_invoker = off) AS
SELECT 
  id,
  username,
  display_name,
  avatar_url
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_profile_search TO authenticated;