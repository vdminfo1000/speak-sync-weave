import { useState } from 'react';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, Trash2, Terminal, AlertTriangle, Wifi, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ErrorMonitor = () => {
  const { errors, clearLogs, exportLogs, errorCount } = useErrorLogger();
  const [open, setOpen] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'network':
        return <Wifi className="h-4 w-4" />;
      case 'console':
        return <Terminal className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadgeVariant = (type: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const errorsByType = errors.reduce((acc, error) => {
    acc[error.type] = (acc[error.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
        >
          <div className="relative">
            <Terminal className="h-5 w-5" />
            {errorCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {errorCount > 99 ? '99+' : errorCount}
              </Badge>
            )}
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Монитор ошибок
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Всего логов</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{errorCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">По типам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(errorsByType).map(([type, count]) => (
                    <Badge key={type} variant={getTypeBadgeVariant(type)}>
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button onClick={exportLogs} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Экспорт
            </Button>
            <Button onClick={clearLogs} variant="outline" className="flex-1">
              <Trash2 className="h-4 w-4 mr-2" />
              Очистить
            </Button>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="error">Ошибки</TabsTrigger>
              <TabsTrigger value="warning">Предупреждения</TabsTrigger>
              <TabsTrigger value="network">Сеть</TabsTrigger>
              <TabsTrigger value="console">Консоль</TabsTrigger>
            </TabsList>

            {['all', 'error', 'warning', 'network', 'console'].map((tabValue) => (
              <TabsContent key={tabValue} value={tabValue} className="mt-4">
                <ScrollArea className="h-[calc(100vh-400px)]">
                  <div className="space-y-3 pr-4">
                    {errors
                      .filter((error) => tabValue === 'all' || error.type === tabValue)
                      .map((error) => (
                        <Card key={error.id} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {getTypeIcon(error.type)}
                                <Badge variant={getTypeBadgeVariant(error.type)}>
                                  {error.type}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(error.timestamp).toLocaleString('ru-RU')}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <p className="text-sm font-medium break-words">{error.message}</p>
                            {error.component && (
                              <p className="text-xs text-muted-foreground">
                                Компонент: {error.component}
                              </p>
                            )}
                            {error.url && (
                              <p className="text-xs text-muted-foreground break-all">
                                URL: {error.url}
                              </p>
                            )}
                            {error.stack && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  Stack trace
                                </summary>
                                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                                  {error.stack}
                                </pre>
                              </details>
                            )}
                            {error.additionalData && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  Дополнительные данные
                                </summary>
                                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                                  {JSON.stringify(error.additionalData, null, 2)}
                                </pre>
                              </details>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    {errors.filter((error) => tabValue === 'all' || error.type === tabValue)
                      .length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Нет логов для отображения
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ErrorMonitor;
