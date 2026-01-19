import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ChatList from "@/components/ChatList";
import ChatWindow from "@/components/ChatWindow";
import ContactSearch from "@/components/ContactSearch";
import ChatRequests from "@/components/ChatRequests";
import CreateGroupDialog from "@/components/CreateGroupDialog";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useCallHistory } from "@/hooks/useCallHistory";
import { useChannelUnreadCount } from "@/hooks/useChannelUnreadCount";
import { useMissedCallsCount } from "@/hooks/useMissedCallsCount";
import { LogOut, Plus, Shield, MessageCircle, Bell, User, Phone, Users, Radio } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/errorHandler";
import CallHistory from "@/components/CallHistory";
import { ThemeToggle } from "@/components/ThemeToggle";
import PublicChannelsList from "@/components/PublicChannelsList";
import { useIsMobile } from "@/hooks/use-mobile";
import AdditionalMenu from "@/components/AdditionalMenu";
import { useCallContext } from "@/contexts/CallContext";

const Messenger = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isPublicChannelsOpen, setIsPublicChannelsOpen] = useState(false);
  const [isChatsMenuOpen, setIsChatsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Use global call context
  const { currentUserId, setCurrentUserId, startCall } = useCallContext();

  // Отслеживаем статус пользователя
  useUserPresence(currentUserId || null);
  
  // Отслеживаем историю звонков
  useCallHistory(currentUserId);

  // Отслеживаем непрочитанные каналы
  const { unreadCount: channelUnreadCount, resetUnreadCount: resetChannelUnread } = 
    useChannelUnreadCount(currentUserId || null);

  // Отслеживаем пропущенные звонки
  const { missedCallsCount, resetMissedCallsCount } = useMissedCallsCount(currentUserId || null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setCurrentUserId(session.user.id);
        updateUserStatus(session.user.id, "online");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setCurrentUserId(session.user.id);
          updateUserStatus(session.user.id, "online");
        }
      }
    );

    const handleBeforeUnload = () => {
      if (currentUserId) {
        updateUserStatus(currentUserId, "offline");
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (currentUserId) {
        updateUserStatus(currentUserId, "offline");
      }
    };
  }, [navigate]);

  const updateUserStatus = async (userId: string, status: "online" | "offline") => {
    try {
      await supabase
        .from("profiles")
        .update({ 
          status,
          last_seen: new Date().toISOString()
        })
        .eq("id", userId);
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    const loadPendingRequests = async () => {
      const { data, error } = await supabase
        .from("chat_requests")
        .select("id")
        .eq("receiver_id", currentUserId)
        .eq("status", "pending");

      if (!error && data) {
        setPendingRequestsCount(data.length);
      }
    };

    loadPendingRequests();

    const requestsChannel = supabase
      .channel("requests_count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_requests",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => loadPendingRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, [currentUserId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const sendChatRequest = async (targetProfileId: string) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (targetProfileId === user.id) {
        toast.error("Нельзя отправить запрос самому себе");
        return;
      }

      const { data: existingMembers } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      if (existingMembers) {
        for (const member of existingMembers) {
          const { data: otherMember } = await supabase
            .from("chat_members")
            .select("chat_id")
            .eq("chat_id", member.chat_id)
            .eq("user_id", targetProfileId)
            .maybeSingle();

          if (otherMember) {
            setSelectedChatId(member.chat_id);
            setIsDialogOpen(false);
            toast.success("Чат уже существует");
            return;
          }
        }
      }

      const { data: existingRequest } = await supabase
        .from("chat_requests")
        .select("id, status")
        .eq("sender_id", user.id)
        .eq("receiver_id", targetProfileId)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        toast.info("Запрос уже отправлен");
        return;
      }

      await supabase
        .from("chat_requests")
        .delete()
        .eq("sender_id", user.id)
        .eq("receiver_id", targetProfileId)
        .in("status", ["rejected", "accepted"]);

      const { error } = await supabase
        .from("chat_requests")
        .insert({
          sender_id: user.id,
          receiver_id: targetProfileId,
        });

      if (error) throw error;

      setIsDialogOpen(false);
      toast.success("Запрос отправлен! Ожидайте подтверждения.");
    } catch (error: any) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background w-full overflow-hidden">
      {/* Sidebar - скрыта на мобильных когда открыт чат */}
      <div className={`${isMobile && selectedChatId ? 'hidden' : 'flex'} w-full md:w-80 border-r border-border flex-col bg-card`}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">GoodOK</h1>
            </div>
            <div className="flex items-center gap-1">
              <AdditionalMenu />
              <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
                <User className="w-5 h-5" />
              </Button>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-2">
            {/* Text buttons row */}
            <div className="flex gap-2 mb-2">
              <Dialog open={isChatsMenuOpen} onOpenChange={setIsChatsMenuOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1 relative">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Чаты
                    {pendingRequestsCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {pendingRequestsCount}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Управление чатами</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => {
                        setIsChatsMenuOpen(false);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Новый чат
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => {
                        setIsChatsMenuOpen(false);
                        setIsCreateGroupOpen(true);
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Создать группу
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start relative"
                      onClick={() => {
                        setIsChatsMenuOpen(false);
                        setIsRequestsOpen(true);
                      }}
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      Запросы
                      {pendingRequestsCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5 text-xs"
                        >
                          {pendingRequestsCount}
                        </Badge>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline" 
                className="flex-1 relative" 
                onClick={() => {
                  setIsPublicChannelsOpen(true);
                  resetChannelUnread();
                }}
              >
                <Radio className="w-4 h-4 mr-2" />
                Каналы
                {channelUnreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {channelUnreadCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Dialogs for New Chat and Requests */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Отправить запрос на чат</DialogTitle>
              </DialogHeader>
              <ContactSearch
                onSelectContact={(profile) => sendChatRequest(profile.id)}
                currentUserId={currentUserId}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Запросы на чат</DialogTitle>
              </DialogHeader>
              <ChatRequests
                currentUserId={currentUserId}
                onRequestAccepted={(chatId) => {
                  setIsRequestsOpen(false);
                  setSelectedChatId(chatId);
                }}
              />
            </DialogContent>
          </Dialog>

          <div className="flex-1 overflow-hidden">
            <ChatList
              onSelectChat={setSelectedChatId}
              selectedChatId={selectedChatId}
            />
          </div>

          <div className="p-4 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full relative" 
              onClick={() => {
                setIsCallHistoryOpen(true);
                resetMissedCallsCount();
              }}
            >
              <Phone className="w-4 h-4 mr-2" />
              История звонков
              {missedCallsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {missedCallsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className={`${isMobile && !selectedChatId ? 'hidden' : 'flex-1'} flex flex-col`}>
        {selectedChatId ? (
          <ChatWindow 
            chatId={selectedChatId}
            onBack={isMobile ? () => setSelectedChatId(null) : undefined}
            onStartCall={(params) => startCall(params)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="w-24 h-24 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-bold mb-2">Добро пожаловать в GoodOK</h2>
            <p className="text-muted-foreground max-w-md">
              Выберите чат слева или создайте новый, чтобы начать безопасное общение
            </p>
          </div>
        )}
      </div>

      {/* Call history dialog */}
      <CallHistory
        isOpen={isCallHistoryOpen}
        onClose={() => setIsCallHistoryOpen(false)}
        currentUserId={currentUserId}
        onStartCall={(params) => startCall(params)}
      />

      {/* Create group dialog */}
      <CreateGroupDialog
        open={isCreateGroupOpen}
        onOpenChange={setIsCreateGroupOpen}
        onGroupCreated={(chatId) => {
          setSelectedChatId(chatId);
          setIsCreateGroupOpen(false);
        }}
      />

      {/* Public channels dialog */}
      <PublicChannelsList
        open={isPublicChannelsOpen}
        onOpenChange={setIsPublicChannelsOpen}
        onChannelJoin={(channelId) => {
          setSelectedChatId(channelId);
          setIsPublicChannelsOpen(false);
        }}
      />
    </div>
  );
};

export default Messenger;
