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
import { LogOut, Plus, Shield, MessageCircle, Bell, User, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/errorHandler";
import IncomingCallNotification from "@/components/IncomingCallNotification";
import VideoCall from "@/components/VideoCall";
import AudioCall from "@/components/AudioCall";
import CallHistory from "@/components/CallHistory";
import SwipeablePanel from "@/components/SwipeablePanel";

const Messenger = () => {
  const navigate = useNavigate();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  // Global incoming call state
  const [incomingCall, setIncomingCall] = useState<{
    chatId: string;
    callerName: string;
    callerId: string;
    callType: "audio" | "video";
  } | null>(null);
  const [activeCall, setActiveCall] = useState<{
    chatId: string;
    otherUserId: string;
    otherUserName: string;
    callType: "audio" | "video";
    isInitiator: boolean;
  } | null>(null);

  // Отслеживаем статус пользователя
  useUserPresence(currentUserId || null);
  
  // Отслеживаем пропущенные звонки
  const { missedCallsCount } = useCallHistory(currentUserId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setCurrentUserId(session.user.id);
        // Обновляем статус на "online" при входе
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

    // Обновляем статус на "offline" при закрытии страницы
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

    // Global call notifications listener
    const callChannel = supabase
      .channel(`global-call-notifications-${currentUserId}`)
      .on(
        "broadcast",
        { event: "incoming-call" },
        async (payload: any) => {
          console.log("Global incoming call:", payload);
          
          // Get caller profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", payload.payload.callerId)
            .single();

          const callerName = profile?.full_name || profile?.username || "Unknown";
          
          setIncomingCall({
            chatId: payload.payload.chatId,
            callerName,
            callerId: payload.payload.callerId,
            callType: payload.payload.callType,
          });
        }
      )
      .on(
        "broadcast",
        { event: "call-declined" },
        () => {
          setIncomingCall(null);
          toast.info("Звонок отклонен");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(callChannel);
    };
  }, [currentUserId]);

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    
    setActiveCall({
      chatId: incomingCall.chatId,
      otherUserId: incomingCall.callerId,
      otherUserName: incomingCall.callerName,
      callType: incomingCall.callType,
      isInitiator: false,
    });
    setIncomingCall(null);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    
    const channel = supabase.channel(`call-notifications-${incomingCall.callerId}`);
    await channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: "call-declined",
      payload: { chatId: incomingCall.chatId },
    });
    await supabase.removeChannel(channel);
    
    setIncomingCall(null);
  };

  const handleCloseCall = () => {
    setActiveCall(null);
  };

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

      // Проверяем, существует ли уже чат
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

      // Проверяем существующий pending запрос
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

      // Удаляем старые отклоненные/принятые запросы
      await supabase
        .from("chat_requests")
        .delete()
        .eq("sender_id", user.id)
        .eq("receiver_id", targetProfileId)
        .in("status", ["rejected", "accepted"]);

      // Отправляем запрос
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
    <SwipeablePanel>
      <div className="flex h-screen bg-background w-full">
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">GoodOK</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Новый чат
              </Button>
            </DialogTrigger>
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

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setIsCreateGroupOpen(true)}
          >
            <Users className="w-4 h-4 mr-2" />
            Создать группу/канал
          </Button>

          <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full relative">
                <Bell className="w-4 h-4 mr-2" />
                Запросы
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

          <Button 
            variant="outline" 
            className="w-full relative" 
            onClick={() => setIsCallHistoryOpen(true)}
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

        <div className="flex-1 overflow-hidden">
          <ChatList
            onSelectChat={setSelectedChatId}
            selectedChatId={selectedChatId}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          <ChatWindow 
            chatId={selectedChatId} 
            onStartCall={(params) => {
              setActiveCall({
                ...params,
                isInitiator: true,
              });
            }}
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

      {/* Global incoming call notification */}
      {incomingCall && (
        <IncomingCallNotification
          callerName={incomingCall.callerName}
          callerId={incomingCall.callerId}
          currentUserId={currentUserId}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Call history dialog */}
      <CallHistory
        isOpen={isCallHistoryOpen}
        onClose={() => setIsCallHistoryOpen(false)}
        currentUserId={currentUserId}
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

      {/* Global active call dialogs */}
      {activeCall && activeCall.callType === "video" && (
        <VideoCall
          isOpen={true}
          onClose={handleCloseCall}
          chatId={activeCall.chatId}
          currentUserId={currentUserId}
          otherUserId={activeCall.otherUserId}
          isInitiator={activeCall.isInitiator}
        />
      )}
      
      {activeCall && activeCall.callType === "audio" && (
        <AudioCall
          isOpen={true}
          onClose={handleCloseCall}
          chatId={activeCall.chatId}
          currentUserId={currentUserId}
          otherUserId={activeCall.otherUserId}
          otherUserName={activeCall.otherUserName}
          isInitiator={activeCall.isInitiator}
        />
      )}
      </div>
    </SwipeablePanel>
  );
};

export default Messenger;
