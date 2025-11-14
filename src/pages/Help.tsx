import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, MessageCircle, HelpCircle, Book, Video, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

const Help = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

  const faqItems = [
    { question: "Как создать группу?", answer: "Нажмите кнопку 'Создать группу/канал' и выберите участников." },
    { question: "Как изменить пароль?", answer: "Перейдите в настройки профиля и найдите раздел 'Изменить пароль'." },
    { question: "Как настроить уведомления?", answer: "Настройки уведомлений доступны в профиле пользователя." },
    { question: "Как удалить аккаунт?", answer: "Свяжитесь с технической поддержкой для удаления аккаунта." },
  ];

  const supportTickets = [
    { id: 1, subject: "Проблема с авторизацией", status: "open", date: "2024-01-20" },
    { id: 2, subject: "Вопрос по оплате", status: "resolved", date: "2024-01-15" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Помощь</h1>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-6 text-center">
              <Book className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold">База знаний</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-6 text-center">
              <Video className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold">Видеоуроки</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold">Чат с поддержкой</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-6 text-center">
              <Mail className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold">Email поддержка</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ai-chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai-chat">Чат с ИИ</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="tickets">Обращения</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-chat" className="mt-4">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle>Ассистент ИИ</CardTitle>
                <CardDescription>Задайте любой вопрос - ИИ поможет вам</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <Avatar>
                        <AvatarFallback>ИИ</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-accent p-3 rounded-lg">
                          <p className="text-sm">
                            Здравствуйте! Я ИИ-ассистент GoodOK. Чем могу помочь?
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Введите ваш вопрос..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <Button size="icon" className="h-[60px]">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="mt-4 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Часто задаваемые вопросы</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {faqItems.map((item, idx) => (
                  <div key={idx} className="border-b border-border pb-4 last:border-0">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold mb-2">{item.question}</p>
                        <p className="text-sm text-muted-foreground">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Мои обращения</CardTitle>
                  <CardDescription>История вашего общения с поддержкой</CardDescription>
                </div>
                <Button>Создать обращение</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {supportTickets.map((ticket) => (
                  <Card key={ticket.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">#{ticket.id} - {ticket.subject}</p>
                          <p className="text-sm text-muted-foreground">{ticket.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            ticket.status === 'open' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {ticket.status === 'open' ? 'Открыто' : 'Решено'}
                          </span>
                          <Button variant="outline" size="sm">Подробнее</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Help;
