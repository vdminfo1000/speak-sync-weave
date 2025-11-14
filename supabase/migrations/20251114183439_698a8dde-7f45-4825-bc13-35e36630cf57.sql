-- Добавляем storage bucket для постов в социальной сети
INSERT INTO storage.buckets (id, name, public) 
VALUES ('social-posts', 'social-posts', true)
ON CONFLICT (id) DO NOTHING;

-- Политики для social-posts bucket
CREATE POLICY "Users can upload their own post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'social-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Post images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'social-posts');

CREATE POLICY "Users can update their own post images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'social-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'social-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Добавляем storage bucket для Stories
INSERT INTO storage.buckets (id, name, public) 
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Политики для stories bucket
CREATE POLICY "Users can upload their own stories"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Stories are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stories');

CREATE POLICY "Users can delete their own stories"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Таблица для Stories
CREATE TABLE IF NOT EXISTS public.social_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  content TEXT,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.social_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own stories"
ON public.social_stories FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all active stories"
ON public.social_stories FOR SELECT
TO authenticated
USING (expires_at > now());

CREATE POLICY "Users can delete their own stories"
ON public.social_stories FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Таблица для просмотров Stories
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.social_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(story_id, user_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own story views"
ON public.story_views FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Story owners can view their story views"
ON public.story_views FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.social_stories
  WHERE social_stories.id = story_views.story_id
  AND social_stories.user_id = auth.uid()
));

-- Таблица для сохраненных постов
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can save posts"
ON public.saved_posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their saved posts"
ON public.saved_posts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can unsave posts"
ON public.saved_posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Таблица для хештегов
CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  posts_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view hashtags"
ON public.hashtags FOR SELECT
TO public
USING (true);

-- Таблица связи постов и хештегов
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(post_id, hashtag_id)
);

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view post hashtags"
ON public.post_hashtags FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can add hashtags to their posts"
ON public.post_hashtags FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.social_posts
  WHERE social_posts.id = post_hashtags.post_id
  AND social_posts.user_id = auth.uid()
));

-- Таблица для упоминаний пользователей в постах
CREATE TABLE IF NOT EXISTS public.post_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view post mentions"
ON public.post_mentions FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can mention in their posts"
ON public.post_mentions FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.social_posts
  WHERE social_posts.id = post_mentions.post_id
  AND social_posts.user_id = auth.uid()
));

-- Таблица для уведомлений
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_social_stories_user_id ON public.social_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_social_stories_expires_at ON public.social_stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON public.saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_post_id ON public.post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_id ON public.post_hashtags(hashtag_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);