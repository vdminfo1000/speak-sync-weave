
-- Drop any existing policies if they exist
DROP POLICY IF EXISTS "Users can create chats" ON public.chats;
DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can update their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can delete their chats" ON public.chats;

DROP POLICY IF EXISTS "Users can add chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can remove chat members" ON public.chat_members;

-- Create policies for chats table
CREATE POLICY "Users can create chats"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can view their chats"
ON public.chats
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
  OR is_public = true
);

CREATE POLICY "Users can update their chats"
ON public.chats
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
    AND chat_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
    AND chat_members.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can delete their chats"
ON public.chats
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
    AND chat_members.role = 'owner'
  )
);

-- Create policies for chat_members table
CREATE POLICY "Users can add chat members"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can view chat members"
ON public.chat_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_members.chat_id
    AND chats.is_public = true
  )
);

CREATE POLICY "Users can remove chat members"
ON public.chat_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can update chat member roles"
ON public.chat_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'owner'
  )
);
