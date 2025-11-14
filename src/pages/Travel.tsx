import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Plane, Hotel, MapPin, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const Travel = () => {
  const navigate = useNavigate();

  const popularDestinations = [
    { city: "Париж", country: "Франция", price: "от $450", image: "🗼", deals: 12 },
    { city: "Токио", country: "Япония", price: "от $650", image: "🗾", deals: 8 },
    { city: "Нью-Йорк", country: "США", price: "от $380", image: "🗽", deals: 15 },
    { city: "Дубай", country: "ОАЭ", price: "от $320", image: "🏙️", deals: 10 },
  ];

  const upcomingTrips = [
    { destination: "Москва - Сочи", date: "15 февраля 2024", type: "Авиабилет", status: "confirmed" },
    { destination: "Отель Radisson", date: "15-20 февраля 2024", type: "Отель", status: "confirmed" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Путешествия</h1>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        {/* Search Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Откуда</label>
                <Input placeholder="Город отправления" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Куда</label>
                <Input placeholder="Город назначения" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Дата отправления</label>
                <Input type="date" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Дата возвращения</label>
                <Input type="date" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Пассажиры</label>
                <Input type="number" defaultValue="1" min="1" />
              </div>
              <div className="flex items-end">
                <Button className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Найти
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="flights" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="flights">
              <Plane className="w-4 h-4 mr-2" />
              Авиабилеты
            </TabsTrigger>
            <TabsTrigger value="hotels">
              <Hotel className="w-4 h-4 mr-2" />
              Отели
            </TabsTrigger>
            <TabsTrigger value="destinations">
              <MapPin className="w-4 h-4 mr-2" />
              Направления
            </TabsTrigger>
            <TabsTrigger value="trips">
              <Calendar className="w-4 h-4 mr-2" />
              Мои поездки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flights" className="mt-4">
            <Card>
              <CardContent className="p-8 text-center">
                <Plane className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Выберите направление и даты для поиска авиабилетов</p>
                <p className="text-sm text-muted-foreground">Лучшие цены от ведущих авиакомпаний</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hotels" className="mt-4">
            <Card>
              <CardContent className="p-8 text-center">
                <Hotel className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Найдите идеальный отель для вашего путешествия</p>
                <p className="text-sm text-muted-foreground">Более 2 миллионов отелей по всему миру</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="destinations" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Популярные направления</CardTitle>
                <CardDescription>Откройте для себя лучшие места для путешествий</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {popularDestinations.map((dest, idx) => (
                    <Card key={idx} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-4 p-4">
                          <div className="text-6xl">{dest.image}</div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{dest.city}</h3>
                            <p className="text-sm text-muted-foreground">{dest.country}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary">{dest.price}</Badge>
                              <span className="text-xs text-muted-foreground">{dest.deals} предложений</span>
                            </div>
                          </div>
                          <Button>Выбрать</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trips" className="mt-4 space-y-3">
            {upcomingTrips.length > 0 ? (
              upcomingTrips.map((trip, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          {trip.type === 'Авиабилет' ? (
                            <Plane className="w-6 h-6 text-primary" />
                          ) : (
                            <Hotel className="w-6 h-6 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{trip.destination}</p>
                          <p className="text-sm text-muted-foreground">{trip.date}</p>
                          <Badge variant="outline" className="mt-1">{trip.type}</Badge>
                        </div>
                      </div>
                      <Badge className="bg-green-600">Подтверждено</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">У вас пока нет запланированных поездок</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Travel;
