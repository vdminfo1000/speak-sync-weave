import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Maximize2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import InviteToGroupCallDialog from "./InviteToGroupCallDialog";
import { useCallHistory } from "@/hooks/useCallHistory";

interface AudioCallProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  isInitiator: boolean;
}

const AudioCall = ({ isOpen, onClose, chatId, currentUserId, otherUserId, otherUserName, isInitiator }: AudioCallProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [callStartTime] = useState(new Date().toISOString());
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const channelRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { recordCall, updateCallStatus } = useCallHistory(currentUserId);

  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  useEffect(() => {
    if (!isOpen) return;

    if (import.meta.env.DEV) {
      console.log("AudioCall opened, isInitiator:", isInitiator);
    }

    // Записываем начало звонка
    if (isInitiator) {
      recordCall({
        caller_id: currentUserId,
        receiver_id: otherUserId,
        call_type: "audio",
        status: "no-answer",
        started_at: callStartTime,
        chat_id: chatId,
      });
    }

    initializeCall();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  useEffect(() => {
    if (callStatus === "connected") {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus]);

  // Таймер для автоматического завершения неотвеченного исходящего вызова
  useEffect(() => {
    if (isInitiator && callStatus === "connecting" && isOpen) {
      callTimeoutRef.current = setTimeout(() => {
        if (callStatus === "connecting") {
          toast.error("Вызов не отвечен");
          handleEndCall();
        }
      }, 45000); // 45 секунд
    }

    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };
  }, [isInitiator, callStatus, isOpen]);

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initializeCall = async () => {
    try {
      if (import.meta.env.DEV) {
        console.log("Initializing audio call, requesting microphone access...");
      }
      
      // Оптимизированные настройки для всех устройств
      const constraints = {
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback с базовыми настройками для старых устройств
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      if (import.meta.env.DEV) {
        console.log("Microphone access granted");
      }
      setLocalStream(stream);

      // Создаем peer connection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);

      // Добавляем локальные треки
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Обрабатываем входящие треки
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        }
        setCallStatus("connected");
        toast.success("Звонок подключен");

        // Обновляем статус звонка на "connected"
        if (isInitiator) {
          updateCallStatus(currentUserId, otherUserId, callStartTime, "completed");
        }
      };

      // Обрабатываем ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage({
            type: "ice-candidate",
            candidate: event.candidate,
          });
        }
      };

      // Обрабатываем изменение состояния соединения
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected") {
          setCallStatus("connected");
        } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          toast.error("Потеряно соединение");
          handleEndCall();
        }
      };

      // Подписываемся на сообщения сигнализации ПЕРЕД созданием offer
      await subscribeToSignaling(pc);

      // Если мы инициатор звонка, создаем offer
      if (isInitiator) {
        // Даем время на полную подписку канала
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(offer);
        await sendSignalingMessage({
          type: "offer",
          offer: offer,
        });
      }

    } catch (error) {
      console.error("Error initializing call:", error);
      toast.error("Не удалось получить доступ к микрофону");
      onClose();
    }
  };

  const sendSignalingMessage = async (message: any) => {
    try {
      // Get auth session for secure relay
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error("No active session for signaling");
        return;
      }

      // Send through secure edge function relay
      const { error } = await supabase.functions.invoke('relay-signaling', {
        body: {
          to: otherUserId,
          message,
          chatId,
          callType: 'audio'
        }
      });

      if (error) {
        console.error("Error sending signaling message:", error);
        toast.error("Ошибка отправки сигнала");
      }
    } catch (error) {
      console.error("Error sending signaling message:", error);
    }
  };

  const subscribeToSignaling = async (pc: RTCPeerConnection) => {
    return new Promise<void>((resolve, reject) => {
      const channel = supabase
        .channel(`audio-call-${chatId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on("broadcast", { event: "signaling" }, async ({ payload }) => {
          // Server-verified payload - 'from' field is now trustworthy
          if (payload.to && payload.to !== currentUserId) return;

          const { message, from } = payload;
          
          // Verify message is from expected peer
          if (from !== otherUserId) {
            return;
          }

          try {
            if (message.type === "offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignalingMessage({
                type: "answer",
                answer: answer,
              });
            } else if (message.type === "answer") {
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
              }
            } else if (message.type === "ice-candidate") {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
              }
            } else if (message.type === "end-call") {
              handleEndCall();
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.error("Error processing signaling message:", error);
            }
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channelRef.current = channel;
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(new Error(`Channel subscription failed: ${status}`));
          }
        });
    });
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleEndCall = () => {
    // Обновляем статус звонка
    if (isInitiator) {
      const finalStatus = callStatus === "connected" ? "completed" : "no-answer";
      updateCallStatus(currentUserId, otherUserId, callStartTime, finalStatus, callDuration);
    }

    if (channelRef.current) {
      sendSignalingMessage({ type: "end-call" });
    }
    cleanup();
    onClose();
  };

  const handleInviteToGroup = async (contactId: string) => {
    try {
      // Отправляем приглашение в групповой звонок
      const channel = supabase.channel(`global-call-notifications-${contactId}`);
      await channel.subscribe();
      
      await channel.send({
        type: "broadcast",
        event: "incoming-group-call",
        payload: {
          chatId: chatId,
          callerId: currentUserId,
          callType: "audio",
          isGroupInvite: true,
        },
      });
      
      await supabase.removeChannel(channel);
      toast.success("Приглашение отправлено");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error inviting to group call:", error);
      }
      toast.error("Не удалось отправить приглашение");
    }
  };

  const cleanup = () => {
    // Stop all local audio tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }
    
    // Remove Supabase channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Clear timers
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    setLocalStream(null);
    setPeerConnection(null);
    setCallStatus("ended");
    setCallDuration(0);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Голосовой звонок</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(false)}
              className="h-6 w-6"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {otherUserName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{otherUserName}</p>
              <p className="text-xs text-muted-foreground">
                {callStatus === "connected" && formatCallDuration(callDuration)}
                {callStatus === "connecting" && "Соединение..."}
              </p>
            </div>
          </div>
          
          <div className="flex justify-center gap-2">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleMute}
              className="rounded-full w-8 h-8"
            >
              {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowInviteDialog(true)}
              className="rounded-full w-8 h-8"
              title="Пригласить в групповой звонок"
            >
              <UserPlus className="w-3 h-3" />
            </Button>

            <Button
              variant="destructive"
              size="icon"
              onClick={handleEndCall}
              className="rounded-full w-8 h-8"
            >
              <PhoneOff className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <audio ref={audioRef} autoPlay />
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Голосовой звонок</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(true)}
              className="h-8 w-8"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-8">
          {/* Аватар собеседника */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                {otherUserName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="text-xl font-semibold">{otherUserName}</h3>
              <p className="text-sm text-muted-foreground">
                {callStatus === "connecting" && "Соединение..."}
                {callStatus === "connected" && formatCallDuration(callDuration)}
                {callStatus === "ended" && "Звонок завершен"}
              </p>
            </div>
          </div>

          {/* Элементы управления */}
          <div className="flex justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleMute}
              className="rounded-full w-16 h-16"
              disabled={callStatus !== "connected"}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowInviteDialog(true)}
              className="rounded-full w-16 h-16"
              title="Пригласить в групповой звонок"
            >
              <UserPlus className="w-6 h-6" />
            </Button>

            <Button
              variant="destructive"
              size="icon"
              onClick={handleEndCall}
              className="rounded-full w-16 h-16"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Скрытый audio элемент для воспроизведения удаленного аудио */}
        <audio ref={audioRef} autoPlay />
      </DialogContent>

      <InviteToGroupCallDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        currentUserId={currentUserId}
        chatId={chatId}
        callType="audio"
        onInvite={handleInviteToGroup}
      />
    </Dialog>
  );
};

export default AudioCall;
