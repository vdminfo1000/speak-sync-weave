import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Fingerprint, Key, Shield, FileKey, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const DigitalID = () => {
  const navigate = useNavigate();

  const biometricData = [
    { type: "Отпечаток пальца", status: "active", addedDate: "2024-01-10", icon: Fingerprint },
    { type: "Распознавание лица", status: "active", addedDate: "2024-01-15", icon: Shield },
  ];

  const digitalSignatures = [
    { name: "Основная ЭЦП", issuer: "УЦ Минцифры", validUntil: "2025-01-20", status: "active" },
    { name: "Корпоративная ЭЦП", issuer: "УЦ СберТех", validUntil: "2024-12-31", status: "expiring" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Цифровое ID</h1>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Добавить
        </Button>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ваш цифровой профиль</CardTitle>
            <CardDescription>Безопасное хранилище биометрических данных и цифровых подписей</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">Биометрия</p>
                <p className="text-2xl font-bold mt-1">2</p>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">ЭЦП</p>
                <p className="text-2xl font-bold mt-1">2</p>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">Уровень защиты</p>
                <p className="text-2xl font-bold mt-1 text-green-600">Высокий</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="biometric" className="w-full">
          <TabsList>
            <TabsTrigger value="biometric">Биометрия</TabsTrigger>
            <TabsTrigger value="signatures">ЭЦП</TabsTrigger>
            <TabsTrigger value="documents">Документы</TabsTrigger>
          </TabsList>

          <TabsContent value="biometric" className="space-y-3 mt-4">
            {biometricData.map((item, idx) => (
              <Card key={idx}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <item.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{item.type}</p>
                        <p className="text-sm text-muted-foreground">Добавлено {item.addedDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Активно
                      </Badge>
                      <Button variant="outline" size="sm">Управление</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="p-6 text-center">
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить биометрические данные
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signatures" className="space-y-3 mt-4">
            {digitalSignatures.map((sig, idx) => (
              <Card key={idx}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileKey className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{sig.name}</p>
                        <p className="text-sm text-muted-foreground">Издатель: {sig.issuer}</p>
                        <p className="text-sm text-muted-foreground">Действительна до: {sig.validUntil}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={sig.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'}>
                        {sig.status === 'active' ? 'Активна' : 'Истекает'}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Key className="w-4 h-4 mr-1" />
                        Подписать
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="p-6 text-center">
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить новую ЭЦП
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Здесь будут храниться ваши защищенные документы</p>
                <Button>Загрузить документ</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DigitalID;
