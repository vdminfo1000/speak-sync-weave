import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Heart, MessageCircle, Share2, Search, Home, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

const SocialNetwork = () => {
  const navigate = useNavigate();

  const mockPosts = [
    {
      id: 1,
      author: "Иван Петров",
      avatar: "",
      content: "Отличный день для новых начинаний! 🌟",
      image: null,
      likes: 24,
      comments: 5,
      timestamp: "2 часа назад"
    },
    {
      id: 2,
      author: "Мария Иванова",
      avatar: "",
      content: "Делюсь своими мыслями о важности общения",
      image: null,
      likes: 42,
      comments: 12,
      timestamp: "5 часов назад"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Социальная сеть</h1>
        </div>
        <Button size="icon">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
          {/* Left Sidebar - Navigation */}
          <div className="hidden md:block md:col-span-3">
            <Card className="sticky top-20">
              <CardContent className="p-4 space-y-2">
                <Button variant="ghost" className="w-full justify-start">
                  <Home className="w-4 h-4 mr-2" />
                  Главная
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Search className="w-4 h-4 mr-2" />
                  Поиск
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <User className="w-4 h-4 mr-2" />
                  Профиль
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-1 md:col-span-6 space-y-4">
            {/* Create Post */}
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Avatar>
                    <AvatarFallback>Вы</AvatarFallback>
                  </Avatar>
                  <Input placeholder="Что у вас нового?" className="flex-1" />
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed */}
            <Tabs defaultValue="feed" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="feed" className="flex-1">Лента</TabsTrigger>
                <TabsTrigger value="popular" className="flex-1">Популярное</TabsTrigger>
              </TabsList>
              
              <TabsContent value="feed" className="space-y-4 mt-4">
                {mockPosts.map((post) => (
                  <Card key={post.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={post.avatar} />
                          <AvatarFallback>{post.author[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">{post.author}</p>
                          <p className="text-sm text-muted-foreground">{post.timestamp}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p>{post.content}</p>
                      {post.image && (
                        <div className="rounded-lg overflow-hidden">
                          <img src={post.image} alt="Post" className="w-full" />
                        </div>
                      )}
                      <div className="flex items-center gap-4 pt-2">
                        <Button variant="ghost" size="sm">
                          <Heart className="w-4 h-4 mr-1" />
                          {post.likes}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MessageCircle className="w-4 h-4 mr-1" />
                          {post.comments}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Share2 className="w-4 h-4 mr-1" />
                          Поделиться
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              
              <TabsContent value="popular" className="mt-4">
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Популярные посты появятся здесь</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar - Suggestions */}
          <div className="hidden md:block md:col-span-3">
            <Card className="sticky top-20">
              <CardHeader>
                <h3 className="font-semibold">Рекомендации</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>U{i}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Пользователь {i}</p>
                      <p className="text-xs text-muted-foreground">@user{i}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      Подписаться
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialNetwork;
