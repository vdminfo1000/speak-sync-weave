import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { requestCallMediaPermission } from "@/lib/callMedia";

interface CallHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onStartCall?: (params: { chatId: string; otherUserId: string; otherUserName: string; callType: "audio" | "video" }) => void;
}

interface CallRecord {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: "video" | "audio" | "group-video" | "group-audio";
  status: "completed" | "missed" | "declined" | "no-answer";
  started_at: string;
  duration: number;
  caller_name?: string;
  receiver_name?: string;
}

const CallHistory = ({ isOpen, onClose, currentUserId, onStartCall }: CallHistoryProps) => {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadCallHistory();
    }
  }, [isOpen]);

  const loadCallHistory = async () => {
    try {
      setLoading(true);
      const { data: callsData, error } = await supabase
        .from("call_history")
        .select("*")
        .or(`caller_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch profiles separately
      const userIds = new Set<string>();
      callsData?.forEach(call => {
        userIds.add(call.caller_id);
        userIds.add(call.receiver_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedCalls = callsData?.map((call) => ({
        id: call.id,
        caller_id: call.caller_id,
        receiver_id: call.receiver_id,
        call_type: call.call_type as "video" | "audio" | "group-video" | "group-audio",
        status: call.status as "completed" | "missed" | "declined" | "no-answer",
        started_at: call.started_at,
        duration: call.duration || 0,
        caller_name: profileMap.get(call.caller_id)?.full_name || profileMap.get(call.caller_id)?.username || "Неизвестно",
        receiver_name: profileMap.get(call.receiver_id)?.full_name || profileMap.get(call.receiver_id)?.username || "Неизвестно",
      })) || [];

      setCalls(formattedCalls);
    } catch (error) {
      console.error("Error loading call history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCallIcon = (call: CallRecord) => {
    const isIncoming = call.receiver_id === currentUserId;
    const isVideo = call.call_type.includes("video");

    if (call.status === "missed" || call.status === "no-answer") {
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }

    if (isVideo) {
      return <Video className="w-4 h-4 text-primary" />;
    }

    return isIncoming ? (
      <PhoneIncoming className="w-4 h-4 text-green-500" />
    ) : (
      <PhoneOutgoing className="w-4 h-4 text-blue-500" />
    );
  };

  const handleCallClick = async (call: CallRecord) => {
    if (!onStartCall) return;

    const isIncoming = call.receiver_id === currentUserId;
    const otherUserId = isIncoming ? call.caller_id : call.receiver_id;
    const otherUserName = isIncoming ? call.caller_name : call.receiver_name;
    const callType = call.call_type.includes("video") ? "video" : "audio";

    // iOS Safari: getUserMedia должен быть вызван в рамках user gesture.
    // Делаем preflight до любых await.
    try {
      await requestCallMediaPermission(callType);
    } catch (error: any) {
      console.error("[CallHistory] Media permission error:", error);
      toast.error(getUserFriendlyError(error) || "Разрешите доступ к камере/микрофону");
      return;
    }

    // Find or create a private chat with this user
    try {
      const { data: existingChats } = await supabase
        .from("chat_members")
        .select("chat_id, chats!inner(chat_type, is_group)")
        .eq("user_id", currentUserId);

      let chatId: string | null = null;

      if (existingChats) {
        // Find private chat with this user
        for (const chat of existingChats) {
          const { data: otherMember } = await supabase
            .from("chat_members")
            .select("user_id")
            .eq("chat_id", chat.chat_id)
            .eq("user_id", otherUserId)
            .single();

          if (otherMember) {
            chatId = chat.chat_id;
            break;
          }
        }
      }

      if (!chatId) {
        // Create a new private chat
        const { data: newChat, error } = await supabase
          .from("chats")
          .insert({ chat_type: "private", is_group: false })
          .select()
          .single();

        if (error) throw error;
        chatId = newChat.id;

        // Add both users as members
        await supabase.from("chat_members").insert([
          { chat_id: chatId, user_id: currentUserId, role: "owner" },
          { chat_id: chatId, user_id: otherUserId, role: "member" },
        ]);
      }
      const channel = supabase.channel(`global-call-notifications-${otherUserId}`);
      await channel.subscribe();
      await channel.send({
        type: "broadcast",
        event: "incoming-call",
        payload: {
          chatId: chatId,
          callerId: currentUserId,
          callType: callType,
        },
      });
      await supabase.removeChannel(channel);
      
      toast.info("Звонок отправлен...");
      onStartCall({ chatId: chatId!, otherUserId, otherUserName: otherUserName!, callType });
      onClose();
    } catch (error) {
      console.error("Error initiating call:", error);
      toast.error("Не удалось начать звонок");
    }
  };

  const getCallDescription = (call: CallRecord) => {
    const isIncoming = call.receiver_id === currentUserId;
    const contactName = isIncoming ? call.caller_name : call.receiver_name;
    
    let statusText = "";
    if (call.status === "missed" || call.status === "no-answer") {
      statusText = "Пропущенный";
    } else if (call.status === "declined") {
      statusText = "Отклонен";
    } else {
      statusText = isIncoming ? "Входящий" : "Исходящий";
    }

    const typeText = call.call_type.includes("video") ? "видеозвонок" : "звонок";
    const groupText = call.call_type.includes("group") ? "групповой " : "";

    return {
      name: contactName,
      description: `${statusText} ${groupText}${typeText}`,
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8">История звонков</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px]">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-muted-foreground">Загрузка...</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Phone className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">История звонков пуста</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {calls.map((call) => {
                const info = getCallDescription(call);
                return (
                   <div
                     key={call.id}
                     className="p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                     onClick={() => handleCallClick(call)}
                   >
                     <div className="flex items-start gap-3">
                       <Avatar className="w-12 h-12">
                         <AvatarFallback className="bg-primary/10 text-primary">
                           {info.name.charAt(0).toUpperCase()}
                         </AvatarFallback>
                       </Avatar>

                       <div className="flex-1 min-w-0 space-y-1">
                         <div className="flex items-center gap-2">
                           {getCallIcon(call)}
                           <p className="font-semibold truncate">{info.name}</p>
                         </div>
                         <p className="text-sm text-muted-foreground">{info.description}</p>
                         
                         <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                           <span>
                             {format(new Date(call.started_at), "dd MMM yyyy, HH:mm", { locale: ru })}
                           </span>
                           {call.duration > 0 && (
                             <>
                               <span>•</span>
                               <span className="font-medium">
                                 Длительность: {formatDuration(call.duration)}
                               </span>
                             </>
                           )}
                         </div>
                       </div>
                     </div>
                   </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CallHistory;