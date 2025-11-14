import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Send, Download, TrendingUp, Wallet as WalletIcon, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Wallet = () => {
  const navigate = useNavigate();

  const cryptoWallets = [
    { name: "Bitcoin", symbol: "BTC", balance: 0.25, value: 11250.50, change: 2.4 },
    { name: "Ethereum", symbol: "ETH", balance: 2.5, value: 4875.25, change: -1.2 },
    { name: "USDT", symbol: "USDT", balance: 5000, value: 5000, change: 0 },
  ];

  const bankAccounts = [
    { bank: "Сбербанк", number: "**** 1234", balance: 125430.50, currency: "RUB" },
    { bank: "Тинькофф", number: "**** 5678", balance: 45200.00, currency: "RUB" },
  ];

  const recentTransactions = [
    { id: 1, type: "send", amount: 0.005, currency: "BTC", date: "2024-01-20", status: "completed" },
    { id: 2, type: "receive", amount: 500, currency: "USDT", date: "2024-01-19", status: "completed" },
    { id: 3, type: "send", amount: 1500, currency: "RUB", date: "2024-01-18", status: "pending" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Кошелек</h1>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Добавить кошелек
        </Button>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        {/* Total Balance */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Общий баланс</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$146,755.75</div>
            <div className="flex items-center gap-4 mt-4">
              <Button>
                <Send className="w-4 h-4 mr-2" />
                Отправить
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Получить
              </Button>
              <Button variant="outline">
                <TrendingUp className="w-4 h-4 mr-2" />
                Обменять
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="crypto" className="w-full">
          <TabsList>
            <TabsTrigger value="crypto">Криптовалюта</TabsTrigger>
            <TabsTrigger value="bank">Банковские счета</TabsTrigger>
            <TabsTrigger value="transactions">История</TabsTrigger>
          </TabsList>

          <TabsContent value="crypto" className="space-y-3 mt-4">
            {cryptoWallets.map((wallet) => (
              <Card key={wallet.symbol}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <WalletIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{wallet.name}</p>
                        <p className="text-sm text-muted-foreground">{wallet.balance} {wallet.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${wallet.value.toLocaleString()}</p>
                      <p className={`text-sm ${wallet.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {wallet.change >= 0 ? '+' : ''}{wallet.change}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="bank" className="space-y-3 mt-4">
            {bankAccounts.map((account, idx) => (
              <Card key={idx}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{account.bank}</p>
                        <p className="text-sm text-muted-foreground">{account.number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{account.balance.toLocaleString()} {account.currency}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="transactions" className="space-y-3 mt-4">
            {recentTransactions.map((tx) => (
              <Card key={tx.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'send' ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        {tx.type === 'send' ? (
                          <Send className="w-5 h-5 text-red-600" />
                        ) : (
                          <Download className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {tx.type === 'send' ? 'Отправлено' : 'Получено'}
                        </p>
                        <p className="text-sm text-muted-foreground">{tx.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {tx.type === 'send' ? '-' : '+'}{tx.amount} {tx.currency}
                      </p>
                      <p className={`text-xs ${
                        tx.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {tx.status === 'completed' ? 'Завершено' : 'В обработке'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Wallet;
