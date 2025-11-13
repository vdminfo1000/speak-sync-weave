import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Minimize2, Maximize2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import InviteToGroupCallDialog from "./InviteToGroupCallDialog";
import { useCallHistory } from "@/hooks/useCallHistory";

interface VideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  currentUserId: string;
  otherUserId: string;
  isInitiator: boolean;
}

const VideoCall = ({ isOpen, onClose, chatId, currentUserId, otherUserId, isInitiator }: VideoCallProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [callStartTime] = useState(new Date().toISOString());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
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
      console.log("VideoCall opened, isInitiator:", isInitiator);
    }

    // Записываем начало звонка
    if (isInitiator) {
      recordCall({
        caller_id: currentUserId,
        receiver_id: otherUserId,
        call_type: "video",
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
        console.log("Initializing call, requesting media access...");
      }
      
      // Адаптивные настройки для разных устройств
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const constraints = {
        video: {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          facingMode: "user",
          frameRate: { ideal: isMobile ? 24 : 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback для устройств с ограниченными возможностями
        if (import.meta.env.DEV) {
          console.warn("Failed with ideal constraints, trying basic media");
        }
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      }
      
      if (import.meta.env.DEV) {
        console.log("Media access granted, got stream:", stream.id);
      }
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);
      if (import.meta.env.DEV) {
        console.log("PeerConnection created");
      }

      // Добавляем локальные треки
      stream.getTracks().forEach((track) => {
        if (import.meta.env.DEV) {
          console.log("Adding track:", track.kind);
        }
        pc.addTrack(track, stream);
      });

      // Обрабатываем входящие треки
      pc.ontrack = (event) => {
        if (import.meta.env.DEV) {
          console.log("Received remote track:", event.track.kind);
        }
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
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
          if (import.meta.env.DEV) {
            console.log("Sending ICE candidate");
          }
          sendSignalingMessage({
            type: "ice-candidate",
            candidate: event.candidate,
          });
        }
      };

      // Обрабатываем изменение состояния соединения
      pc.oniceconnectionstatechange = () => {
        if (import.meta.env.DEV) {
          console.log("ICE connection state:", pc.iceConnectionState);
        }
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
        if (import.meta.env.DEV) {
          console.log("Creating offer as initiator");
        }
        // Даем время на полную подписку канала
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        if (import.meta.env.DEV) {
          console.log("Sending offer");
        }
        await sendSignalingMessage({
          type: "offer",
          offer: offer,
        });
      }

    } catch (error) {
      console.error("Error initializing call:", error);
      toast.error("Не удалось получить доступ к камере/микрофону");
      onClose();
    }
  };

  const sendSignalingMessage = async (message: any) => {
    try {
      if (import.meta.env.DEV) {
        console.log("Sending signaling message:", message.type);
      }

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
          callType: 'video'
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
        .channel(`video-call-${chatId}`, {
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
            if (import.meta.env.DEV) {
              console.warn("Received message from unexpected peer:", from);
            }
            return;
          }

          if (import.meta.env.DEV) {
            console.log("Received authenticated signaling message:", message.type);
          }

          try {
            if (message.type === "offer") {
              if (import.meta.env.DEV) {
                console.log("Processing offer");
              }
              await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (import.meta.env.DEV) {
                console.log("Sending answer");
              }
              await sendSignalingMessage({
                type: "answer",
                answer: answer,
              });
            } else if (message.type === "answer") {
              if (import.meta.env.DEV) {
                console.log("Processing answer");
              }
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
              }
            } else if (message.type === "ice-candidate") {
              if (import.meta.env.DEV) {
                console.log("Adding ICE candidate");
              }
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
              }
            } else if (message.type === "end-call") {
              if (import.meta.env.DEV) {
                console.log("Call ended by remote peer");
              }
              handleEndCall();
            }
          } catch (error) {
            console.error("Error processing signaling message:", error);
          }
        })
        .subscribe((status) => {
          if (import.meta.env.DEV) {
            console.log("Channel subscription status:", status);
          }
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

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
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
          callType: "video",
          isGroupInvite: true,
        },
      });
      
      await supabase.removeChannel(channel);
      toast.success("Приглашение отправлено");
    } catch (error) {
      console.error("Error inviting to group call:", error);
      toast.error("Не удалось отправить приглашение");
    }
  };

  const cleanup = () => {
    if (import.meta.env.DEV) {
      console.log("Cleaning up video call resources");
    }
    
    // Stop all local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        if (import.meta.env.DEV) {
          console.log("Stopped local track:", track.kind);
        }
      });
    }
    
    // Stop all remote tracks
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        track.stop();
        if (import.meta.env.DEV) {
          console.log("Stopped remote track:", track.kind);
        }
      });
    }
    
    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
      if (import.meta.env.DEV) {
        console.log("Closed peer connection");
      }
    }
    
    // Remove Supabase channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      if (import.meta.env.DEV) {
        console.log("Removed Supabase channel");
      }
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
    setRemoteStream(null);
    setPeerConnection(null);
    setCallStatus("ended");
    setCallDuration(0);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Видеозвонок</span>
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
          
          <div className="relative aspect-video bg-secondary rounded overflow-hidden mb-2">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="text-xs text-muted-foreground text-center mb-2">
            {callStatus === "connected" && formatCallDuration(callDuration)}
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
              variant={isVideoOff ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleVideo}
              className="rounded-full w-8 h-8"
            >
              {isVideoOff ? <VideoOff className="w-3 h-3" /> : <VideoIcon className="w-3 h-3" />}
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
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Видеозвонок</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-normal text-muted-foreground">
                {callStatus === "connecting" && "Соединение..."}
                {callStatus === "connected" && formatCallDuration(callDuration)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                className="h-8 w-8"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Удаленное видео */}
            <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  Ожидание подключения...
                </div>
              )}
            </div>

            {/* Локальное видео */}
            <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                Вы
              </div>
            </div>
          </div>

          {/* Элементы управления */}
          <div className="flex justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleMute}
              className="rounded-full w-12 h-12"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              variant={isVideoOff ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleVideo}
              className="rounded-full w-12 h-12"
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowInviteDialog(true)}
              className="rounded-full w-12 h-12"
              title="Пригласить в групповой звонок"
            >
              <UserPlus className="w-5 h-5" />
            </Button>

            <Button
              variant="destructive"
              size="icon"
              onClick={handleEndCall}
              className="rounded-full w-12 h-12"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </DialogContent>

      <InviteToGroupCallDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        currentUserId={currentUserId}
        chatId={chatId}
        callType="video"
        onInvite={handleInviteToGroup}
      />
    </Dialog>
  );
};

export default VideoCall;
