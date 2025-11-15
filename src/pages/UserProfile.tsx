import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Heart, MessageCircle, Bookmark } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      setProfile(profileData);

      // Load posts
      const { data: postsData } = await supabase
        .from("social_posts")
        .select(`
          *,
          profiles (username, full_name, avatar_url),
          social_likes (user_id),
          social_comments (id),
          saved_posts (user_id)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      setPosts(postsData || []);

      // Load followers/following counts
      const { count: followers } = await supabase
        .from("social_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

      const { count: following } = await supabase
        .from("social_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId);

      setFollowersCount(followers || 0);
      setFollowingCount(following || 0);

      // Check if current user follows this profile
      if (user) {
        const { data: followData } = await supabase
          .from("social_follows")
          .select("*")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .maybeSingle();

        setIsFollowing(!!followData);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading profile:", error);
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) return;

    if (isFollowing) {
      await supabase
        .from("social_follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", userId);
      setIsFollowing(false);
      setFollowersCount(prev => prev - 1);
    } else {
      await supabase
        .from("social_follows")
        .insert({ follower_id: currentUserId, following_id: userId });
      setIsFollowing(true);
      setFollowersCount(prev => prev + 1);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Загрузка...</div>;
  }

  const isOwnProfile = currentUserId === userId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center gap-4 sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/social-network")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">{profile?.username || "Профиль"}</h1>
      </div>

      <div className="container mx-auto max-w-4xl p-4">
        {/* Profile Header */}
        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="text-2xl">
                  {profile?.full_name?.[0] || profile?.username?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold mb-1">
                  {profile?.full_name || profile?.username}
                </h2>
                <p className="text-muted-foreground mb-4">@{profile?.username}</p>
                
                <div className="flex gap-6 justify-center md:justify-start mb-4">
                  <div>
                    <span className="font-bold">{posts.length}</span>
                    <span className="text-muted-foreground ml-1">постов</span>
                  </div>
                  <div>
                    <span className="font-bold">{followersCount}</span>
                    <span className="text-muted-foreground ml-1">подписчиков</span>
                  </div>
                  <div>
                    <span className="font-bold">{followingCount}</span>
                    <span className="text-muted-foreground ml-1">подписок</span>
                  </div>
                </div>

                {!isOwnProfile && (
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    onClick={handleFollow}
                  >
                    {isFollowing ? "Отписаться" : "Подписаться"}
                  </Button>
                )}
                {isOwnProfile && (
                  <Button variant="outline" onClick={() => navigate("/profile")}>
                    Редактировать профиль
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts Grid */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1">Посты</TabsTrigger>
            {isOwnProfile && <TabsTrigger value="saved" className="flex-1">Сохраненное</TabsTrigger>}
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="aspect-square cursor-pointer relative group"
                  onClick={() => navigate(`/social-network`)}
                >
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center p-2">
                      <p className="text-xs text-center line-clamp-4">{post.content}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                    <div className="flex items-center gap-1">
                      <Heart className="w-5 h-5 fill-white" />
                      <span>{post.social_likes?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-5 h-5 fill-white" />
                      <span>{post.social_comments?.length || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Постов пока нет</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="saved" className="mt-4">
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Сохраненные посты появятся здесь</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default UserProfile;
