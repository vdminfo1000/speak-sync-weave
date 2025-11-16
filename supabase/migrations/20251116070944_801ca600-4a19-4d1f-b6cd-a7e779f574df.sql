-- Add allow_member_messages column to chats table
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS allow_member_messages boolean DEFAULT true;

-- Update chats table description
COMMENT ON COLUMN public.chats.allow_member_messages IS 'Allow non-admin members to send messages in channels';

-- Create table for remembering devices
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  device_name text,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days'),
  UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS on trusted_devices
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- RLS policies for trusted_devices
CREATE POLICY "Users can view their own trusted devices"
ON public.trusted_devices
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trusted devices"
ON public.trusted_devices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trusted devices"
ON public.trusted_devices
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own trusted devices"
ON public.trusted_devices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);