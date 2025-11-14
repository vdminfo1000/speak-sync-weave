import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Link as LinkIcon, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const IntegrationsPage = () => {
  const navigate = useNavigate();

  const availableIntegrations = [
    {
      name: "Google Workspace",
      description: "Синхронизация календаря, почты и документов",
      icon: "🔵",
      status: "available",
      category: "Продуктивность"
    },
    {
      name: "Slack",
      description: "Уведомления и командная работа",
      icon: "💬",
      status: "available",
      category: "Коммуникация"
    },
    {
      name: "Salesforce",
      description: "CRM и управление клиентами",
      icon: "☁️",
      status: "available",
      category: "Бизнес"
    },
    {
      name: "GitHub",
      description: "Управление кодом и разработка",
      icon: "🐙",
      status: "available",
      category: "Разработка"
    },
  ];

  const activeIntegrations = [
    {
      name: "Telegram API",
      description: "Мост между Telegram и GoodOK",
      icon: "✈️",
      status: "active",
      connectedDate: "2024-01-15"
    },
    {
      name: "Email Gateway",
      description: "Отправка и получение email",
      icon: "📧",
      status: "active",
      connectedDate: "2024-01-10"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Интеграции</h1>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Добавить интеграцию
        </Button>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Активные</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeIntegrations.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Доступные</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableIntegrations.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Статус</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold">Все работают</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Active Integrations */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Активные интеграции</h2>
            <div className="space-y-3">
              {activeIntegrations.map((integration, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{integration.icon}</div>
                        <div>
                          <p className="font-semibold">{integration.name}</p>
                          <p className="text-sm text-muted-foreground">{integration.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Подключено {integration.connectedDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch defaultChecked />
                        <Button variant="outline" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Available Integrations */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Доступные интеграции</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableIntegrations.map((integration, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="text-3xl">{integration.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{integration.name}</p>
                            <Badge variant="outline">{integration.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{integration.description}</p>
                        </div>
                      </div>
                      <Button size="sm">
                        <LinkIcon className="w-4 h-4 mr-1" />
                        Подключить
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
