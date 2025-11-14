import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  content: string | null;
  views_count: number;
  created_at: string;
  expires_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  is_viewed?: boolean;
}

export const useSocialStories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stories, isLoading } = useQuery({
    queryKey: ["social-stories"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: storiesData, error } = await supabase
        .from("social_stories")
        .select("*")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles and views
      const userIds = [...new Set(storiesData.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds);

      const { data: views } = await supabase
        .from("story_views")
        .select("story_id")
        .eq("user_id", user.id)
        .in("story_id", storiesData.map(s => s.id));

      const viewedStoryIds = new Set(views?.map(v => v.story_id) || []);

      const enrichedStories: Story[] = storiesData.map(story => ({
        ...story,
        profiles: profiles?.find(p => p.id === story.user_id),
        is_viewed: viewedStoryIds.has(story.id),
      }));

      return enrichedStories;
    },
  });

  const viewStory = useMutation({
    mutationFn: async (storyId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("story_views")
        .insert({ story_id: storyId, user_id: user.id });

      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-stories"] });
    },
  });

  const createStory = useMutation({
    mutationFn: async ({ file, content }: { file: File; content?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("stories")
        .getPublicUrl(fileName);

      // Create story
      const { error: storyError } = await supabase
        .from("social_stories")
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: file.type.startsWith("video") ? "video" : "image",
          content,
        });

      if (storyError) throw storyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-stories"] });
      toast({ title: "История опубликована!" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать историю", variant: "destructive" });
    },
  });

  return {
    stories,
    isLoading,
    viewStory: viewStory.mutate,
    createStory: createStory.mutate,
  };
};