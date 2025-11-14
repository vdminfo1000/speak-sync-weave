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

      // Combine data
      const enrichedPosts: SocialPost[] = postsData.map(post => ({
        ...post,
        profiles: profiles?.find(p => p.id === post.user_id),
        social_likes: likes?.filter(l => l.post_id === post.id) || [],
        social_comments: comments?.filter(c => c.post_id === post.id) || [],
      }));

      return enrichedPosts;
    },
  });

  const createPost = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("social_posts")
        .insert({ user_id: user.id, content })
        .select()
        .single();

      if (error) throw error;
      return data;
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

  return {
    posts,
    isLoading,
    createPost: createPost.mutate,
    toggleLike: toggleLike.mutate,
  };
};
