-- Create social network posts table
CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create likes table
CREATE TABLE public.social_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create comments table
CREATE TABLE public.social_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create follows table
CREATE TABLE public.social_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Enable RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_posts
CREATE POLICY "Users can view all posts"
  ON public.social_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own posts"
  ON public.social_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.social_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.social_posts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for social_likes
CREATE POLICY "Users can view all likes"
  ON public.social_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own likes"
  ON public.social_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.social_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for social_comments
CREATE POLICY "Users can view all comments"
  ON public.social_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own comments"
  ON public.social_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.social_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.social_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for social_follows
CREATE POLICY "Users can view all follows"
  ON public.social_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own follows"
  ON public.social_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows"
  ON public.social_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Create trigger for updated_at
CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_social_comments_updated_at
  BEFORE UPDATE ON public.social_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();