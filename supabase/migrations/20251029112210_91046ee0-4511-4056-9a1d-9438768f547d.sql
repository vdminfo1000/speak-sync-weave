-- Create chat_requests table for contact/chat requests
CREATE TABLE public.chat_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

-- Users can send requests
CREATE POLICY "Users can send chat requests"
ON public.chat_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id AND sender_id != receiver_id);

-- Users can view their own sent and received requests
CREATE POLICY "Users can view their requests"
ON public.chat_requests FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can update requests they received (accept/reject)
CREATE POLICY "Users can update received requests"
ON public.chat_requests FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Users can delete their own sent requests (cancel)
CREATE POLICY "Users can delete their sent requests"
ON public.chat_requests FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Add trigger for updated_at
CREATE TRIGGER update_chat_requests_updated_at
BEFORE UPDATE ON public.chat_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add index for performance
CREATE INDEX idx_chat_requests_receiver ON public.chat_requests(receiver_id, status);
CREATE INDEX idx_chat_requests_sender ON public.chat_requests(sender_id, status);

-- Add INSERT policy for chats table (was missing)
CREATE POLICY "Users can create chats"
ON public.chats FOR INSERT
TO authenticated
WITH CHECK (true);