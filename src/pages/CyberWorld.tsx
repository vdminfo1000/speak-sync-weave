import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Building2, ShoppingBag, MapPin, Users, Eye, Store, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VirtualLocation {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  visitors: number;
  status: "online" | "coming_soon";
}

const CyberWorld = () => {
  const navigate = useNavigate();

  const locations: VirtualLocation[] = [
    {
      id: "main-square",
      name: "Главная площадь",
      description: "Центральная площадь виртуального города с фонтаном и зонами отдыха",
      category: "Площади",
      icon: "🏛️",
      visitors: 0,
      status: "coming_soon",
    },
    {
      id: "shopping-mall",
      name: "Торговый центр",
      description: "Виртуальный ТЦ с магазинами одежды, электроники и продуктов",
      category: "Магазины",
      icon: "🏬",
      visitors: 0,
      status: "coming_soon",
    },
    {
      id: "art-gallery",
      name: "Галерея искусств",
      description: "Выставка цифрового искусства и NFT коллекций",
      category: "Культура",
      icon: "🖼️",
      visitors: 0,
      status: "coming_soon",
    },
    {
      id: "park",
      name: "Городской парк",
      description: "Зелёная зона для прогулок и общения с друзьями",
      category: "Отдых",
      icon: "🌳",
      visitors: 0,
      status: "coming_soon",
    },
    {
      id: "cinema",
      name: "Кинотеатр",
      description: "Совместный просмотр фильмов и видео с друзьями",
      category: "Развлечения",
      icon: "🎬",
      visitors: 0,
      status: "coming_soon",
    },
    {
      id: "cafe",
      name: "Кафе «Встреча»",
      description: "Уютное место для виртуальных встреч и переговоров",
      category: "Общение",
      icon: "☕",
      visitors: 0,
      status: "coming_soon",
    },
    {
      id: "office-center",
      name: "Бизнес-центр",
      description: "Виртуальные офисы и переговорные комнаты",
      category: "Работа",
      icon: "🏢",
      visitors: 0,
      status: "coming_soon",
    },
    {
      id: "museum",
      name: "Музей истории",
      description: "Интерактивный музей с 3D экспонатами и экскурсиями",
      category: "Культура",
      icon: "🏛️",
      visitors: 0,
      status: "coming_soon",
    },
  ];

  const categories = [...new Set(locations.map((l) => l.category))];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Кибермир</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            0 онлайн
          </Badge>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{locations.length}</p>
                <p className="text-sm text-muted-foreground">Локаций</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Магазинов</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Посетителей</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Landmark className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Категорий</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Категории</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category} variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                {category}
              </Badge>
            ))}
          </div>
        </div>

        {/* Locations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {locations.map((location) => (
            <Card
              key={location.id}
              className="cursor-pointer hover:shadow-lg transition-shadow relative overflow-hidden"
            >
              <CardContent className="p-4">
                <div className="text-5xl mb-3 text-center">{location.icon}</div>
                <h3 className="font-semibold text-center">{location.name}</h3>
                <p className="text-sm text-muted-foreground text-center mt-1">{location.description}</p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    {location.category}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs">{location.visitors}</span>
                  </div>
                </div>
                {location.status === "coming_soon" && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <Badge className="bg-primary">Скоро</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coming Soon Banner */}
        <Card className="mt-6">
          <CardContent className="p-8 text-center">
            <Globe className="w-16 h-16 mx-auto mb-4 text-primary" />
            <CardTitle className="mb-2">Кибермир в разработке</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Мы создаём виртуальный мир с цифровыми двойниками зданий, магазинов и улиц. 
              Скоро вы сможете посещать виртуальные локации, делать покупки и общаться с друзьями!
            </CardDescription>
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button variant="outline" disabled>
                <MapPin className="w-4 h-4 mr-2" />
                Исследовать
              </Button>
              <Button variant="outline" disabled>
                <ShoppingBag className="w-4 h-4 mr-2" />
                Магазины
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CyberWorld;
