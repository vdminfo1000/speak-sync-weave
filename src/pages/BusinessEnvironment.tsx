import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const BusinessEnvironment = () => {
  const navigate = useNavigate();

  const mockStocks = [
    { symbol: "AAPL", name: "Apple Inc.", price: 178.25, change: 2.5, changePercent: 1.42 },
    { symbol: "GOOGL", name: "Alphabet Inc.", price: 142.50, change: -1.20, changePercent: -0.83 },
    { symbol: "MSFT", name: "Microsoft", price: 380.90, change: 5.30, changePercent: 1.41 },
    { symbol: "TSLA", name: "Tesla Inc.", price: 242.80, change: -3.45, changePercent: -1.40 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Бизнес среда</h1>
      </div>

      <div className="container mx-auto p-4 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Баланс портфеля</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$125,430.50</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600">+$2,345.00 (1.9%)</span> сегодня
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Активные сделки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground mt-1">3 в прибыли, 2 в убытке</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Рыночный статус</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                <span className="text-xl font-bold">Открыт</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Закроется в 23:00</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="market" className="w-full">
          <TabsList>
            <TabsTrigger value="market">Рынок</TabsTrigger>
            <TabsTrigger value="portfolio">Портфолио</TabsTrigger>
            <TabsTrigger value="orders">Ордера</TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Котировки</CardTitle>
                <CardDescription>Актуальные цены на финансовые инструменты</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockStocks.map((stock) => (
                    <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{stock.symbol}</span>
                          <Badge variant="outline" className="text-xs">{stock.name}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${stock.price.toFixed(2)}</div>
                        <div className={`text-sm flex items-center gap-1 ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stock.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                      <div className="ml-4 space-x-2">
                        <Button size="sm" variant="outline" className="text-green-600">Купить</Button>
                        <Button size="sm" variant="outline" className="text-red-600">Продать</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="mt-4">
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Ваш портфель пуст. Начните с покупки активов.</p>
                <Button className="mt-4">Перейти на рынок</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">У вас нет активных ордеров</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BusinessEnvironment;
