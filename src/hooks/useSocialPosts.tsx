import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SocialPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  social_likes?: { id: string; user_id: string }[];
  social_comments?: { id: string }[];
  saved_posts?: { id: string; user_id: string }[];
}

export const useSocialPosts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["social-posts"],
    queryFn: async () => {
      const { data: postsData, error } = await supabase
        .from("social_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles, likes, and comments separately
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds);

      const { data: likes } = await supabase
        .from("social_likes")
        .select("id, user_id, post_id")
        .in("post_id", postsData.map(p => p.id));

      const { data: comments } = await supabase
        .from("social_comments")
        .select("id, post_id")
        .in("post_id", postsData.map(p => p.id));

      const { data: savedPosts } = await supabase
        .from("saved_posts")
        .select("id, user_id, post_id")
        .in("post_id", postsData.map(p => p.id));

      // Combine data
      const enrichedPosts: SocialPost[] = postsData.map(post => ({
        ...post,
        profiles: profiles?.find(p => p.id === post.user_id),
        social_likes: likes?.filter(l => l.post_id === post.id) || [],
        social_comments: comments?.filter(c => c.post_id === post.id) || [],
        saved_posts: savedPosts?.filter(s => s.post_id === post.id) || [],
      }));

      return enrichedPosts;
    },
  });

  const createPost = useMutation({
    mutationFn: async ({ content, imageFile }: { content: string; imageFile?: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl: string | null = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('social-posts')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('social-posts')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      // Extract hashtags and mentions
      const hashtagRegex = /#(\w+)/g;
      const mentionRegex = /@(\w+)/g;
      const hashtags = [...content.matchAll(hashtagRegex)].map(match => match[1]);
      const mentions = [...content.matchAll(mentionRegex)].map(match => match[1]);

      const { data: post, error } = await supabase
        .from("social_posts")
        .insert({ user_id: user.id, content, image_url: imageUrl })
        .select()
        .single();

      if (error) throw error;

      // Create hashtags and link to post
      for (const tag of hashtags) {
        const { data: existingTag } = await supabase
          .from('hashtags')
          .select('id')
          .eq('name', tag)
          .single();

        let hashtagId: string;
        if (existingTag) {
          hashtagId = existingTag.id;
        } else {
          const { data: newTag, error: tagError } = await supabase
            .from('hashtags')
            .insert({ name: tag })
            .select('id')
            .single();
          if (tagError) throw tagError;
          hashtagId = newTag.id;
        }

        await supabase
          .from('post_hashtags')
          .insert({ post_id: post.id, hashtag_id: hashtagId });
      }

      // Create mentions
      for (const username of mentions) {
        const { data: mentionedUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .single();

        if (mentionedUser) {
          await supabase
            .from('post_mentions')
            .insert({ post_id: post.id, user_id: mentionedUser.id });
        }
      }

      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      toast({ title: "Пост опубликован!" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать пост", variant: "destructive" });
    },
  });

  const toggleLike = useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isLiked) {
        const { error } = await supabase
          .from("social_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("social_likes")
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    },
  });

  const savePost = useMutation({
    mutationFn: async ({ postId, isSaved }: { postId: string; isSaved: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isSaved) {
        const { error } = await supabase
          .from("saved_posts")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_posts")
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    },
  });

  const toggleFollow = useMutation({
    mutationFn: async ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isFollowing) {
        const { error } = await supabase
          .from("social_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("social_follows")
          .insert({ follower_id: user.id, following_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    },
  });

  return {
    posts,
    isLoading,
    createPost: (content: string, imageFile?: File) => createPost.mutate({ content, imageFile }),
    toggleLike: toggleLike.mutate,
    savePost: savePost.mutate,
    toggleFollow: toggleFollow.mutate,
  };
};
