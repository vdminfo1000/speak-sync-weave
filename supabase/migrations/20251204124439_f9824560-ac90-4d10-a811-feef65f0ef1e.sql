-- Add privacy settings columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_online_status boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_avatar boolean DEFAULT true;