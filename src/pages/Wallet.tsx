import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Download, Coins, History, Users, Search, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  description: string | null;
  created_at: string;
  sender_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  receiver_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const Wallet = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Send dialog
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Profile | null>(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sendDescription, setSendDescription] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Receive dialog
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await fetchWalletData(user.id);
        await fetchUserProfile(user.id);
      }
      setLoading(false);
    };
    init();
  }, []);

  const fetchUserProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", uid)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchWalletData = async (uid: string) => {
    // Fetch or create wallet
    let { data: wallet } = await supabase
      .from("user_wallets")
      .select("balance")
      .eq("user_id", uid)
      .single();

    if (!wallet) {
      // Create wallet with initial balance
      const { data: newWallet } = await supabase
        .from("user_wallets")
        .insert({ user_id: uid, balance: 100 })
        .select("balance")
        .single();
      wallet = newWallet;
    }

    if (wallet) setBalance(Number(wallet.balance));

    // Fetch transactions
    const { data: txs } = await supabase
      .from("coin_transactions")
      .select("*")
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (txs) {
      // Fetch profiles for transactions
      const userIds = [...new Set(txs.flatMap((tx) => [tx.sender_id, tx.receiver_id]))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      const txsWithProfiles = txs.map((tx) => ({
        ...tx,
        sender_profile: profileMap.get(tx.sender_id),
        receiver_profile: profileMap.get(tx.receiver_id),
      }));

      setTransactions(txsWithProfiles);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq("id", userId)
        .limit(10);

      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sendCoins = async () => {
    if (!userId || !selectedRecipient || !sendAmount) return;

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    if (amount > balance) {
      toast.error("Недостаточно средств");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.rpc("transfer_coins", {
        p_receiver_id: selectedRecipient.id,
        p_amount: amount,
        p_description: sendDescription || null,
      });

      if (error) throw error;

      toast.success(`${amount} GOK отправлено`);
      await fetchWalletData(userId);
      setShowSendDialog(false);
      resetSendForm();
    } catch (error: any) {
      console.error("Transfer error:", error);
      toast.error(error.message || "Ошибка перевода");
    } finally {
      setIsSending(false);
    }
  };

  const resetSendForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedRecipient(null);
    setSendAmount("");
    setSendDescription("");
  };

  const getDisplayName = (profile?: { username: string | null; full_name: string | null }) => {
    return profile?.full_name || profile?.username || "Пользователь";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Кошелек</h1>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        {/* GoodOkCoin Balance */}
        <Card className="mb-6 bg-gradient-to-r from-primary/20 to-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Coins className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">GoodOkCoin</CardTitle>
                <p className="text-3xl font-bold">{balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} GOK</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button onClick={() => setShowSendDialog(true)}>
                <Send className="w-4 h-4 mr-2" />
                Отправить
              </Button>
              <Button variant="outline" onClick={() => setShowReceiveDialog(true)}>
                <Download className="w-4 h-4 mr-2" />
                Получить
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList>
            <TabsTrigger value="transactions">
              <History className="w-4 h-4 mr-2" />
              История
            </TabsTrigger>
            <TabsTrigger value="about">
              <Coins className="w-4 h-4 mr-2" />
              О GoodOkCoin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-3 mt-4">
            {transactions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">История транзакций пуста</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Отправьте или получите GoodOkCoin, чтобы начать
                  </p>
                </CardContent>
              </Card>
            ) : (
              transactions.map((tx) => {
                const isSent = tx.sender_id === userId;
                const otherProfile = isSent ? tx.receiver_profile : tx.sender_profile;

                return (
                  <Card key={tx.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isSent ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"
                            }`}
                          >
                            {isSent ? (
                              <Send className="w-5 h-5 text-red-600" />
                            ) : (
                              <Download className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {isSent ? "Отправлено" : "Получено"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {isSent ? "→ " : "← "}
                              {getDisplayName(otherProfile)}
                            </p>
                            {tx.description && (
                              <p className="text-xs text-muted-foreground">{tx.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${isSent ? "text-red-600" : "text-green-600"}`}>
                            {isSent ? "-" : "+"}{Number(tx.amount).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} GOK
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="about" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  GoodOkCoin (GOK)
                </CardTitle>
                <CardDescription>Внутренняя валюта GoodOK Messenger</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-border">
                    <p className="font-semibold mb-2">🎁 Стартовый бонус</p>
                    <p className="text-sm text-muted-foreground">
                      Каждый новый пользователь получает 100 GOK при регистрации
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border border-border">
                    <p className="font-semibold mb-2">💸 Мгновенные переводы</p>
                    <p className="text-sm text-muted-foreground">
                      Отправляйте GOK друзьям без комиссии
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border border-border">
                    <p className="font-semibold mb-2">🔒 Безопасность</p>
                    <p className="text-sm text-muted-foreground">
                      Все транзакции защищены и сохраняются в истории
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border border-border">
                    <p className="font-semibold mb-2">🎮 Использование</p>
                    <p className="text-sm text-muted-foreground">
                      Используйте GOK в играх и сервисах GoodOK
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={(open) => { setShowSendDialog(open); if (!open) resetSendForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отправить GoodOkCoin</DialogTitle>
            <DialogDescription>Найдите получателя и укажите сумму</DialogDescription>
          </DialogHeader>

          {!selectedRecipient ? (
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени или username"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {isSearching ? (
                  <div className="text-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <Card
                      key={user.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelectedRecipient(user)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {(user.full_name || user.username || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{user.full_name || user.username}</p>
                          {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : searchQuery.length >= 2 ? (
                  <p className="text-center text-muted-foreground py-4">Пользователи не найдены</p>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Введите минимум 2 символа для поиска</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <Card>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedRecipient.avatar_url || undefined} />
                      <AvatarFallback>
                        {(selectedRecipient.full_name || selectedRecipient.username || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedRecipient.full_name || selectedRecipient.username}</p>
                      {selectedRecipient.username && (
                        <p className="text-sm text-muted-foreground">@{selectedRecipient.username}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedRecipient(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>

              <div>
                <Label>Сумма GOK</Label>
                <Input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  max={balance}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Доступно: {balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} GOK
                </p>
              </div>

              <div>
                <Label>Комментарий (необязательно)</Label>
                <Input
                  value={sendDescription}
                  onChange={(e) => setSendDescription(e.target.value)}
                  placeholder="За кофе ☕"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Отмена
            </Button>
            {selectedRecipient && (
              <Button
                onClick={sendCoins}
                disabled={isSending || !sendAmount || parseFloat(sendAmount) <= 0 || parseFloat(sendAmount) > balance}
              >
                {isSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Отправить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Получить GoodOkCoin</DialogTitle>
            <DialogDescription>Поделитесь своим профилем для получения переводов</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <Avatar className="w-24 h-24 mx-auto mb-4">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {(userProfile?.full_name || userProfile?.username || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-xl font-bold">{userProfile?.full_name || userProfile?.username || "Пользователь"}</p>
            {userProfile?.username && (
              <Badge variant="secondary" className="mt-2">@{userProfile.username}</Badge>
            )}
            <p className="text-muted-foreground mt-4">
              Попросите отправителя найти вас по имени или username
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Wallet;