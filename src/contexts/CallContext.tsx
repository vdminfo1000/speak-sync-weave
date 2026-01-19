import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requestCallMediaPermission } from "@/lib/callMedia";
import { getUserFriendlyError } from "@/lib/errorHandler";

interface IncomingCall {
  chatId: string;
  callerName: string;
  callerId: string;
  callType: "audio" | "video";
  isGroupCall?: boolean;
  roomId?: string;
  participants?: Array<{ userId: string; userName: string }>;
}

interface ActiveCall {
  chatId: string;
  otherUserId: string;
  otherUserName: string;
  callType: "audio" | "video";
  isInitiator: boolean;
}

interface ActiveGroupCall {
  roomId: string;
  callType: "audio" | "video";
  participants: Array<{ userId: string; userName: string }>;
}

interface CallContextType {
  currentUserId: string;
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  activeGroupCall: ActiveGroupCall | null;
  setCurrentUserId: (id: string) => void;
  startCall: (params: { chatId: string; otherUserId: string; otherUserName: string; callType: "audio" | "video" }) => void;
  handleAcceptCall: () => Promise<void>;
  handleDeclineCall: () => Promise<void>;
  handleCloseCall: () => void;
  handleCloseGroupCall: () => void;
  handleTransitionToGroupCall: (roomId: string, callType: "audio" | "video", participants: Array<{ userId: string; userName: string }>) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallContext must be used within a CallProvider");
  }
  return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [activeGroupCall, setActiveGroupCall] = useState<ActiveGroupCall | null>(null);

  const incomingCallRef = useRef(incomingCall);
  const activeCallRef = useRef(activeCall);
  const activeGroupCallRef = useRef(activeGroupCall);

  incomingCallRef.current = incomingCall;
  activeCallRef.current = activeCall;
  activeGroupCallRef.current = activeGroupCall;

  useEffect(() => {
    if (!currentUserId) return;

    console.log('[CallContext] Setting up global call notifications for:', currentUserId);
    
    const callChannel = supabase
      .channel(`global-call-notifications-${currentUserId}`)
      .on(
        "broadcast",
        { event: "incoming-call" },
        async (payload: any) => {
          console.log("[CallContext] Global incoming call received:", payload);

          if (activeCallRef.current || activeGroupCallRef.current || incomingCallRef.current) {
            console.log("[CallContext] Already in a call, sending busy signal");
            const busyChannel = supabase.channel(`call-notifications-${payload.payload.callerId}`);
            await busyChannel.subscribe();
            await busyChannel.send({
              type: "broadcast",
              event: "call-busy",
              payload: { chatId: payload.payload.chatId, userId: currentUserId },
            });
            await supabase.removeChannel(busyChannel);
            return;
          }

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
            isGroupCall: payload.payload.isGroupCall || false,
            roomId: payload.payload.roomId,
            participants: payload.payload.participants,
          });
        }
      )
      .on("broadcast", { event: "call-declined" }, () => {
        setIncomingCall(null);
        toast.info("Звонок отклонен");
      })
      .on("broadcast", { event: "call-ended" }, (payload: any) => {
        console.log('[CallContext] Received call-ended signal:', payload);
        if (incomingCallRef.current?.callerId === payload.payload?.callerId) {
          setIncomingCall(null);
          toast.info("Звонок завершен");
        }
      })
      .subscribe((status) => {
        console.log('[CallContext] Call notifications channel status:', status);
      });

    return () => {
      supabase.removeChannel(callChannel);
    };
  }, [currentUserId]);

  const startCall = (params: { chatId: string; otherUserId: string; otherUserName: string; callType: "audio" | "video" }) => {
    setActiveCall({
      ...params,
      isInitiator: true,
    });
  };

  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    try {
      await requestCallMediaPermission(incomingCall.callType);
    } catch (error: any) {
      console.error("[CallContext] Media permission error:", error);
      toast.error(getUserFriendlyError(error) || "Разрешите доступ к камере/микрофону");
      return;
    }

    if (incomingCall.isGroupCall && incomingCall.roomId) {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", currentUserId)
        .single();

      const currentUserName = currentProfile?.full_name || currentProfile?.username || "Вы";

      const roster = incomingCall.participants?.length
        ? incomingCall.participants
        : [
            { userId: currentUserId, userName: currentUserName },
            { userId: incomingCall.callerId, userName: incomingCall.callerName },
          ];

      const map = new Map<string, { userId: string; userName: string }>();
      for (const p of roster) {
        if (p?.userId) map.set(p.userId, { userId: p.userId, userName: p.userName || "Участник" });
      }
      map.set(currentUserId, { userId: currentUserId, userName: currentUserName });

      setActiveGroupCall({
        roomId: incomingCall.roomId,
        callType: incomingCall.callType,
        participants: [...map.values()],
      });
      setIncomingCall(null);
      return;
    }

    const { data: membership, error } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', incomingCall.chatId)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (error || !membership) {
      toast.error('Вы не являетесь участником этого чата');
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
    setActiveCall(null);
  };

  const handleCloseGroupCall = () => {
    setActiveGroupCall(null);
  };

  const handleTransitionToGroupCall = (
    roomId: string,
    callType: "audio" | "video",
    participants: Array<{ userId: string; userName: string }>
  ) => {
    setActiveCall(null);
    setActiveGroupCall({ roomId, callType, participants });
  };

  return (
    <CallContext.Provider
      value={{
        currentUserId,
        incomingCall,
        activeCall,
        activeGroupCall,
        setCurrentUserId,
        startCall,
        handleAcceptCall,
        handleDeclineCall,
        handleCloseCall,
        handleCloseGroupCall,
        handleTransitionToGroupCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
