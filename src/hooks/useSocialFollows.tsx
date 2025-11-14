import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSocialFollows = (userId: string) => {
  const { data: followers } = useQuery({
    queryKey: ["followers", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_follows")
        .select(`
          follower_id,
          profiles:follower_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq("following_id", userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: following } = useQuery({
    queryKey: ["following", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_follows")
        .select(`
          following_id,
          profiles:following_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq("follower_id", userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  return {
    followers: followers || [],
    following: following || [],
    followersCount: followers?.length || 0,
    followingCount: following?.length || 0,
  };
};
