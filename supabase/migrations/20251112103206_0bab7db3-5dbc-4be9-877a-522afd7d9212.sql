-- Создание таблицы для истории звонков
CREATE TABLE IF NOT EXISTS public.call_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'audio', 'group-video', 'group-audio')),
  status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'declined', 'no-answer')) DEFAULT 'missed',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER DEFAULT 0,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_call_history_caller ON public.call_history(caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_history_receiver ON public.call_history(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_history_status ON public.call_history(status) WHERE status = 'missed';

-- RLS политики для call_history
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own call history"
  ON public.call_history
  FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own calls"
  ON public.call_history
  FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their own calls"
  ON public.call_history
  FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Создание storage bucket для рингтонов
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ringtones', 'ringtones', false)
ON CONFLICT (id) DO NOTHING;

-- Storage политики для ringtones
CREATE POLICY "Users can view their own ringtones"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'ringtones' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own ringtones"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'ringtones' 
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.extension(name)) IN ('mp3', 'wav', 'ogg', 'm4a')
  );

CREATE POLICY "Users can update their own ringtones"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'ringtones' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'ringtones' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own ringtones"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'ringtones' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Таблица для настроек рингтонов
CREATE TABLE IF NOT EXISTS public.user_ringtones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ringtone_url TEXT NOT NULL,
  ringtone_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_user_ringtones_user ON public.user_ringtones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ringtones_default ON public.user_ringtones(user_id) WHERE is_default = true;

-- RLS политики для user_ringtones
ALTER TABLE public.user_ringtones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ringtone settings"
  ON public.user_ringtones
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ringtone settings"
  ON public.user_ringtones
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ringtone settings"
  ON public.user_ringtones
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ringtone settings"
  ON public.user_ringtones
  FOR DELETE
  USING (auth.uid() = user_id);

-- Функция для получения количества пропущенных звонков
CREATE OR REPLACE FUNCTION public.get_missed_calls_count()
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM call_history
  WHERE receiver_id = auth.uid()
    AND status IN ('missed', 'no-answer')
    AND created_at > NOW() - INTERVAL '7 days';
$$;

-- Включаем realtime для call_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_history;