import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Trophy, Users, Star, Clock, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Game {
  id: string;
  name: string;
  description: string;
  category: string;
  players: string;
  rating: number;
  playTime: string;
  image: string;
  comingSoon: boolean;
}

const VirtualEnvironment = () => {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const games: Game[] = [
    {
      id: "tetris",
      name: "Тетрис",
      description: "Классическая головоломка с падающими блоками",
      category: "Головоломка",
      players: "1 игрок",
      rating: 4.8,
      playTime: "5-30 мин",
      image: "🎮",
      comingSoon: true,
    },
    {
      id: "snake",
      name: "Змейка",
      description: "Управляй змейкой и собирай еду",
      category: "Аркада",
      players: "1 игрок",
      rating: 4.5,
      playTime: "5-15 мин",
      image: "🐍",
      comingSoon: true,
    },
    {
      id: "2048",
      name: "2048",
      description: "Соединяй числа и достигни 2048",
      category: "Головоломка",
      players: "1 игрок",
      rating: 4.7,
      playTime: "10-30 мин",
      image: "🔢",
      comingSoon: true,
    },
    {
      id: "chess",
      name: "Шахматы",
      description: "Классическая стратегическая игра",
      category: "Стратегия",
      players: "2 игрока",
      rating: 4.9,
      playTime: "15-60 мин",
      image: "♟️",
      comingSoon: true,
    },
    {
      id: "checkers",
      name: "Шашки",
      description: "Простая но увлекательная настольная игра",
      category: "Стратегия",
      players: "2 игрока",
      rating: 4.3,
      playTime: "10-30 мин",
      image: "⚫",
      comingSoon: true,
    },
    {
      id: "poker",
      name: "Покер",
      description: "Техасский Холдем с друзьями",
      category: "Карточные",
      players: "2-8 игроков",
      rating: 4.6,
      playTime: "30-120 мин",
      image: "🃏",
      comingSoon: true,
    },
    {
      id: "durak",
      name: "Дурак",
      description: "Популярная карточная игра",
      category: "Карточные",
      players: "2-6 игроков",
      rating: 4.7,
      playTime: "15-45 мин",
      image: "🎴",
      comingSoon: true,
    },
    {
      id: "minesweeper",
      name: "Сапёр",
      description: "Найди все мины на поле",
      category: "Логика",
      players: "1 игрок",
      rating: 4.4,
      playTime: "5-20 мин",
      image: "💣",
      comingSoon: true,
    },
  ];

  const categories = [...new Set(games.map((g) => g.category))];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Виртуальная среда</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Trophy className="w-3 h-3" />
            0 побед
          </Badge>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{games.length}</p>
                <p className="text-sm text-muted-foreground">Игр доступно</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Ваши победы</p>
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
                <p className="text-sm text-muted-foreground">Друзья онлайн</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0ч</p>
                <p className="text-sm text-muted-foreground">Время в играх</p>
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

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {games.map((game) => (
            <Card
              key={game.id}
              className="cursor-pointer hover:shadow-lg transition-shadow relative overflow-hidden"
              onClick={() => setSelectedGame(game)}
            >
              <CardContent className="p-4">
                <div className="text-5xl mb-3 text-center">{game.image}</div>
                <h3 className="font-semibold text-center">{game.name}</h3>
                <p className="text-sm text-muted-foreground text-center mt-1">{game.description}</p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    {game.category}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs">{game.rating}</span>
                  </div>
                </div>
                {game.comingSoon && (
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
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-primary" />
            <CardTitle className="mb-2">Игры в разработке</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Мы активно работаем над добавлением новых игр. Скоро вы сможете играть прямо в мессенджере!
            </CardDescription>
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button variant="outline" disabled>
                <Play className="w-4 h-4 mr-2" />
                Начать игру
              </Button>
              <Button variant="outline" disabled>
                <Users className="w-4 h-4 mr-2" />
                Пригласить друзей
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VirtualEnvironment;