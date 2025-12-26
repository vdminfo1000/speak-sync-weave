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
import { requestCallMediaPermission } from "@/lib/callMedia";
import IncomingCallNotification from "@/components/IncomingCallNotification";
import VideoCall from "@/components/VideoCall";
import AudioCall from "@/components/AudioCall";
import GroupVideoCall from "@/components/GroupVideoCall";
import GroupAudioCall from "@/components/GroupAudioCall";
import CallHistory from "@/components/CallHistory";
import { ThemeToggle } from "@/components/ThemeToggle";
import PublicChannelsList from "@/components/PublicChannelsList";
import { useIsMobile } from "@/hooks/use-mobile";
import AdditionalMenu from "@/components/AdditionalMenu";
import { useRef } from "react";

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
  const [isSocialNetworkOpen, setIsSocialNetworkOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  // Global incoming call state
  const [incomingCall, setIncomingCall] = useState<{
    chatId: string;
    callerName: string;
    callerId: string;
    callType: "audio" | "video";
    isGroupCall?: boolean;
    roomId?: string;
  } | null>(null);
  const [activeCall, setActiveCall] = useState<{
    chatId: string;
    otherUserId: string;
    otherUserName: string;
    callType: "audio" | "video";
    isInitiator: boolean;
  } | null>(null);
  const [activeGroupCall, setActiveGroupCall] = useState<{
    roomId: string;
    callType: "audio" | "video";
    participants: Array<{ userId: string; userName: string }>;
  } | null>(null);

  // Refs для отслеживания актуального состояния звонков (для callback closures)
  const incomingCallRef = useRef(incomingCall);
  const activeCallRef = useRef(activeCall);
  const activeGroupCallRef = useRef(activeGroupCall);
  
  // Синхронизируем refs с состоянием
  incomingCallRef.current = incomingCall;
  activeCallRef.current = activeCall;
  activeGroupCallRef.current = activeGroupCall;

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
    console.log('[Messenger] Setting up global call notifications channel for:', currentUserId);
    const callChannel = supabase
      .channel(`global-call-notifications-${currentUserId}`)
      .on(
        "broadcast",
        { event: "incoming-call" },
        async (payload: any) => {
          console.log("[Messenger] Global incoming call received:", payload);
          
          // Проверяем, есть ли уже активный звонок (используем refs для актуальных значений)
          if (activeCallRef.current || activeGroupCallRef.current || incomingCallRef.current) {
            console.log("[Messenger] Already in a call, ignoring incoming call");
            
            // Отправляем сигнал "занято" вызывающему
            const busyChannel = supabase.channel(`call-notifications-${payload.payload.callerId}`);
            await busyChannel.subscribe();
            await busyChannel.send({
              type: "broadcast",
              event: "call-busy",
              payload: { 
                chatId: payload.payload.chatId,
                userId: currentUserId 
              },
            });
            await supabase.removeChannel(busyChannel);
            return;
          }
          
          // Get caller profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", payload.payload.callerId)
            .single();

          const callerName = profile?.full_name || profile?.username || "Unknown";
          
          console.log("[Messenger] Setting incoming call state:", {
            chatId: payload.payload.chatId,
            callerName,
            callerId: payload.payload.callerId,
            callType: payload.payload.callType,
            isGroupCall: payload.payload.isGroupCall,
            roomId: payload.payload.roomId,
          });
          
          setIncomingCall({
            chatId: payload.payload.chatId,
            callerName,
            callerId: payload.payload.callerId,
            callType: payload.payload.callType,
            isGroupCall: payload.payload.isGroupCall || false,
            roomId: payload.payload.roomId,
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
      .on(
        "broadcast",
        { event: "call-ended" },
        (payload: any) => {
          console.log('[Messenger] Received call-ended signal:', payload);
          // Закрываем уведомление о входящем звонке, если звонок был от того же звонящего
          if (incomingCallRef.current?.callerId === payload.payload?.callerId) {
            setIncomingCall(null);
            toast.info("Звонок завершен");
          }
        }
      )
      .subscribe((status) => {
        console.log('[Messenger] Call notifications channel status:', status);
      });

    return () => {
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(callChannel);
    };
  }, [currentUserId]);

  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    // iOS Safari: getUserMedia должен быть вызван в рамках user gesture.
    // Делаем preflight до любых await.
    try {
      await requestCallMediaPermission(incomingCall.callType);
    } catch (error: any) {
      console.error("[Messenger] Media permission error:", error);
      toast.error(getUserFriendlyError(error) || "Разрешите доступ к камере/микрофону");
      return;
    }
    
    console.log('[Messenger] Accepting call:', incomingCall);
    
    // Для групповых звонков
    if (incomingCall.isGroupCall && incomingCall.roomId) {
      console.log('[Messenger] Accepting group call invitation');
      
      // Получаем имя текущего пользователя
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", currentUserId)
        .single();
      
      const currentUserName = currentProfile?.full_name || currentProfile?.username || "Вы";
      
      setActiveGroupCall({
        roomId: incomingCall.roomId,
        callType: incomingCall.callType,
        participants: [
          { userId: currentUserId, userName: currentUserName },
          { userId: incomingCall.callerId, userName: incomingCall.callerName },
        ],
      });
      setIncomingCall(null);
      return;
    }
    
    // Verify chat membership before accepting regular call
    try {
      const { data: membership, error } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', incomingCall.chatId)
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      console.log('[Messenger] Membership check:', { membership, error, chatId: incomingCall.chatId, userId: currentUserId });
      
      if (error) {
        console.error('[Messenger] Error checking membership:', error);
        toast.error('Ошибка проверки членства в чате');
        setIncomingCall(null);
        return;
      }
      
      if (!membership) {
        console.error('[Messenger] User is not a member of this chat');
        toast.error('Вы не являетесь участником этого чата');
        setIncomingCall(null);
        return;
      }
    } catch (err) {
      console.error('[Messenger] Exception during membership check:', err);
      toast.error('Не удалось проверить доступ к чату');
      setIncomingCall(null);
      return;
    }
    
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
    
    console.log('[Messenger] Declining call:', incomingCall);
    
    const channel = supabase.channel(`call-notifications-${incomingCall.callerId}`);
    await channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: "call-declined",
      payload: { chatId: incomingCall.chatId },
    });
    await supabase.removeChannel(channel);
    
    setIncomingCall(null);
    toast.info("Звонок отклонен");
  };

  const handleCloseCall = () => {
    console.log('[Messenger] handleCloseCall: closing activeCall');
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
          callType={incomingCall.callType}
          isGroupCall={incomingCall.isGroupCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Call history dialog */}
      <CallHistory
        isOpen={isCallHistoryOpen}
        onClose={() => setIsCallHistoryOpen(false)}
        currentUserId={currentUserId}
        onStartCall={(params) => {
          setActiveCall({
            ...params,
            isInitiator: true,
          });
        }}
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

      {/* Group call dialogs */}
      {activeGroupCall && activeGroupCall.callType === "video" && (
        <GroupVideoCall
          isOpen={true}
          onClose={() => setActiveGroupCall(null)}
          roomId={activeGroupCall.roomId}
          currentUserId={currentUserId}
          initialParticipants={activeGroupCall.participants}
        />
      )}
      
      {activeGroupCall && activeGroupCall.callType === "audio" && (
        <GroupAudioCall
          isOpen={true}
          onClose={() => setActiveGroupCall(null)}
          roomId={activeGroupCall.roomId}
          currentUserId={currentUserId}
          initialParticipants={activeGroupCall.participants}
        />
      )}
    </div>
  );
};

export default Messenger;
