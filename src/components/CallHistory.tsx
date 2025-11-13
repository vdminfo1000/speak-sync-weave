import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface CallHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
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

const CallHistory = ({ isOpen, onClose, currentUserId }: CallHistoryProps) => {
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
      const { data, error } = await supabase
        .from("call_history")
        .select(`
          *,
          caller:profiles!call_history_caller_id_fkey(username, full_name),
          receiver:profiles!call_history_receiver_id_fkey(username, full_name)
        `)
        .or(`caller_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedCalls = data?.map((call: any) => ({
        id: call.id,
        caller_id: call.caller_id,
        receiver_id: call.receiver_id,
        call_type: call.call_type,
        status: call.status,
        started_at: call.started_at,
        duration: call.duration || 0,
        caller_name: call.caller?.full_name || call.caller?.username || "Неизвестно",
        receiver_name: call.receiver?.full_name || call.receiver?.username || "Неизвестно",
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
          <DialogTitle>История звонков</DialogTitle>
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
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {info.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getCallIcon(call)}
                        <p className="font-medium truncate">{info.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(call.started_at), "d MMM, HH:mm", { locale: ru })}
                      </p>
                      {call.duration > 0 && (
                        <p className="text-xs text-muted-foreground">{formatDuration(call.duration)}</p>
                      )}
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