import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface InviteToGroupCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  roomId: string;
  callType: "audio" | "video";
  onInvite: (contactId: string) => void;
}

const InviteToGroupCallDialog = ({
  isOpen,
  onClose,
  currentUserId,
  roomId,
  callType,
  onInvite,
}: InviteToGroupCallDialogProps) => {
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen, currentUserId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = contacts.filter(
        (contact) =>
          contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      console.log("[InviteToGroupCall] Loading contacts for user:", currentUserId);
      
      // Получаем все чаты пользователя
      const { data: userChats, error: chatsError } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", currentUserId);

      if (chatsError) {
        console.error("[InviteToGroupCall] Error loading user chats:", chatsError);
        throw chatsError;
      }

      const chatIds = userChats?.map(c => c.chat_id) || [];
      console.log("[InviteToGroupCall] User chat IDs:", chatIds);

      if (chatIds.length === 0) {
        setContacts([]);
        setFilteredContacts([]);
        setLoading(false);
        return;
      }

      // Получаем всех участников из всех чатов пользователя
      const { data: chatMembers, error: membersError } = await supabase
        .from("chat_members")
        .select("user_id")
        .in("chat_id", chatIds)
        .neq("user_id", currentUserId);

      if (membersError) {
        console.error("[InviteToGroupCall] Error loading chat members:", membersError);
        throw membersError;
      }

      // Получаем уникальные ID пользователей
      const uniqueUserIds = [...new Set(chatMembers?.map(m => m.user_id) || [])];
      console.log("[InviteToGroupCall] Unique user IDs:", uniqueUserIds);

      if (uniqueUserIds.length === 0) {
        setContacts([]);
        setFilteredContacts([]);
        setLoading(false);
        return;
      }

      // Отдельно получаем профили
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", uniqueUserIds);

      if (profilesError) {
        console.error("[InviteToGroupCall] Error loading profiles:", profilesError);
        throw profilesError;
      }

      console.log("[InviteToGroupCall] Loaded profiles:", profiles?.length);
      setContacts(profiles || []);
      setFilteredContacts(profiles || []);
    } catch (error) {
      console.error("[InviteToGroupCall] Error loading contacts:", error);
      toast.error("Не удалось загрузить контакты");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (contact: Profile) => {
    setInvitingId(contact.id);
    
    try {
      console.log("[InviteToGroupCall] Sending group call invitation to:", contact.id);
      
      // Получаем имя текущего пользователя
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", currentUserId)
        .single();
      
      const callerName = currentProfile?.full_name || currentProfile?.username || "Неизвестный";
      
      // Отправляем уведомление о входящем групповом звонке
      const channelName = `global-call-notifications-${contact.id}`;
      console.log("[InviteToGroupCall] Subscribing to channel:", channelName);
      
      const channel = supabase.channel(channelName);
      
      // Дожидаемся полной подписки на канал
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Subscription timeout"));
        }, 5000);
        
        channel.subscribe((status) => {
          console.log("[InviteToGroupCall] Channel subscription status:", status);
          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            clearTimeout(timeout);
            reject(new Error(`Channel subscription failed: ${status}`));
          }
        });
      });
      
      console.log("[InviteToGroupCall] Channel subscribed, sending invitation...");
      
      // Небольшая задержка для синхронизации
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await channel.send({
        type: "broadcast",
        event: "incoming-call",
        payload: {
          callerId: currentUserId,
          callerName,
          chatId: roomId,
          callType,
          isGroupCall: true,
          roomId,
        },
      });
      
      console.log("[InviteToGroupCall] Invitation sent, result:", result);
      
      // Очищаем канал после отправки
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 2000);
      
      // Вызываем onInvite для подготовки к подключению
      onInvite(contact.id);
      
      toast.success(`Приглашение отправлено ${contact.full_name || contact.username}`);
      onClose();
    } catch (error) {
      console.error("[InviteToGroupCall] Error sending invitation:", error);
      toast.error("Не удалось отправить приглашение");
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8">
            Пригласить в групповой {callType === "video" ? "видеозвонок" : "звонок"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск контактов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px] pr-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Загрузка контактов...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Контакты не найдены" : "Нет доступных контактов"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.avatar_url || undefined} />
                        <AvatarFallback>
                          {(contact.full_name || contact.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {contact.full_name || contact.username}
                        </p>
                        {contact.full_name && (
                          <p className="text-sm text-muted-foreground">
                            @{contact.username}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleInvite(contact)}
                      disabled={invitingId === contact.id}
                    >
                      {invitingId === contact.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteToGroupCallDialog;
