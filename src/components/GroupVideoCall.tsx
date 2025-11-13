import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Participant {
  userId: string;
  userName: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

interface GroupVideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserId: string;
  initialParticipants: Array<{ userId: string; userName: string }>;
  onAddParticipant?: () => void;
}

const GroupVideoCall = ({ 
  isOpen, 
  onClose, 
  roomId, 
  currentUserId, 
  initialParticipants,
  onAddParticipant 
}: GroupVideoCallProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>(
    initialParticipants.map(p => ({ userId: p.userId, userName: p.userName }))
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const channelRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      console.log("GroupVideoCall opened");
    }
    initializeCall();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  useEffect(() => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initializeCall = async () => {
    try {
      if (import.meta.env.DEV) {
        console.log("Initializing group video call...");
      }
      
      // Оптимизация для групповых звонков (меньше качество = лучше производительность)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const constraints = {
        video: {
          width: { ideal: isMobile ? 320 : 640 },
          height: { ideal: isMobile ? 240 : 480 },
          facingMode: "user",
          frameRate: { ideal: isMobile ? 15 : 24 },
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
        if (import.meta.env.DEV) {
          console.warn("Failed with ideal constraints, using basic media");
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

      // Подписываемся на канал комнаты
      await subscribeToRoom();

      // Оповещаем других участников о своем присоединении
      await sendSignalingMessage({
        type: "user-joined",
        userId: currentUserId,
      }, null);

      // Создаем connections к существующим участникам
      for (const participant of participants) {
        if (participant.userId !== currentUserId) {
          await createPeerConnection(participant.userId, true, stream);
        }
      }

    } catch (error) {
      console.error("Error initializing call:", error);
      toast.error("Не удалось получить доступ к камере/микрофону");
      onClose();
    }
  };

  const createPeerConnection = async (targetUserId: string, isInitiator: boolean, stream: MediaStream) => {
    if (import.meta.env.DEV) {
      console.log(`Creating peer connection to ${targetUserId}, isInitiator: ${isInitiator}`);
    }
    
    const pc = new RTCPeerConnection(configuration);

    // Добавляем локальные треки
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Обрабатываем входящие треки
    pc.ontrack = (event) => {
      if (import.meta.env.DEV) {
        console.log(`Received remote track from ${targetUserId}`);
      }
      const [remoteStream] = event.streams;
      
      setParticipants(prev => 
        prev.map(p => 
          p.userId === targetUserId 
            ? { ...p, stream: remoteStream, peerConnection: pc }
            : p
        )
      );
    };

    // Обрабатываем ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (import.meta.env.DEV) {
          console.log(`Sending ICE candidate to ${targetUserId}`);
        }
        sendSignalingMessage({
          type: "ice-candidate",
          candidate: event.candidate,
        }, targetUserId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (import.meta.env.DEV) {
        console.log(`ICE connection state with ${targetUserId}:`, pc.iceConnectionState);
      }
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        toast.error(`Потеряно соединение с участником`);
      }
    };

    // Обновляем состояние участников
    setParticipants(prev => 
      prev.map(p => 
        p.userId === targetUserId 
          ? { ...p, peerConnection: pc }
          : p
      )
    );

    // Если мы инициатор, создаем offer
    if (isInitiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      if (import.meta.env.DEV) {
        console.log(`Sending offer to ${targetUserId}`);
      }
      await sendSignalingMessage({
        type: "offer",
        offer: offer,
      }, targetUserId);
    }

    return pc;
  };

  const sendSignalingMessage = async (message: any, targetUserId: string | null) => {
    try {
      // Get auth session for secure relay
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (import.meta.env.DEV) {
          console.error("No active session for signaling");
        }
        return;
      }

      // Send through secure edge function relay
      const { error } = await supabase.functions.invoke('relay-signaling', {
        body: {
          to: targetUserId,
          message,
          roomId,
          callType: 'group-video'
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

  const subscribeToRoom = async () => {
    return new Promise<void>((resolve, reject) => {
      const channel = supabase
        .channel(`group-video-call-${roomId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on("broadcast", { event: "signaling" }, async ({ payload }) => {
          // Server-verified payload - 'from' field is now trustworthy
          if (payload.to && payload.to !== currentUserId) return;
          
          const { message, from } = payload;
          if (import.meta.env.DEV) {
            console.log("Received authenticated signaling message:", message.type, "from:", from);
          }

          try {
            if (message.type === "user-joined") {
              // Новый участник присоединился
              if (from !== currentUserId && !participants.find(p => p.userId === from)) {
                if (import.meta.env.DEV) {
                  console.log("New user joined:", from);
                }
                setParticipants(prev => [...prev, { userId: from, userName: "Участник" }]);
                
                // Создаем connection к новому участнику (мы инициатор)
                if (localStream) {
                  await createPeerConnection(from, true, localStream);
                }
              }
            } else if (message.type === "offer") {
              if (import.meta.env.DEV) {
                console.log("Processing offer from", from);
              }
              const participant = participants.find(p => p.userId === from);
              let pc = participant?.peerConnection;
              
              if (!pc && localStream) {
                pc = await createPeerConnection(from, false, localStream);
              }
              
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await sendSignalingMessage({
                  type: "answer",
                  answer: answer,
                }, from);
              }
            } else if (message.type === "answer") {
              if (import.meta.env.DEV) {
                console.log("Processing answer from", from);
              }
              const participant = participants.find(p => p.userId === from);
              const pc = participant?.peerConnection;
              
              if (pc && pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
              }
            } else if (message.type === "ice-candidate") {
              if (import.meta.env.DEV) {
                console.log("Adding ICE candidate from", from);
              }
              const participant = participants.find(p => p.userId === from);
              const pc = participant?.peerConnection;
              
              if (pc && pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
              }
            } else if (message.type === "user-left") {
              if (import.meta.env.DEV) {
                console.log("User left:", from);
              }
              handleParticipantLeft(from);
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

  const handleParticipantLeft = (userId: string) => {
    setParticipants(prev => {
      const participant = prev.find(p => p.userId === userId);
      if (participant?.peerConnection) {
        participant.peerConnection.close();
      }
      if (participant?.stream) {
        participant.stream.getTracks().forEach(track => track.stop());
      }
      return prev.filter(p => p.userId !== userId);
    });
    toast.info("Участник покинул звонок");
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
    sendSignalingMessage({ type: "user-left" }, null);
    cleanup();
    onClose();
  };

  const cleanup = () => {
    if (import.meta.env.DEV) {
      console.log("Cleaning up group video call resources");
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        if (import.meta.env.DEV) {
          console.log("Stopped local track:", track.kind);
        }
      });
    }
    
    participants.forEach(participant => {
      if (participant.peerConnection) {
        participant.peerConnection.close();
      }
      if (participant.stream) {
        participant.stream.getTracks().forEach(track => track.stop());
      }
    });
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    setLocalStream(null);
    setParticipants([]);
    setCallDuration(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-6xl h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Групповой видеозвонок</span>
            <span className="text-sm font-normal text-muted-foreground">
              {formatCallDuration(callDuration)} • {participants.length} участников
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full space-y-4">
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {/* Локальное видео */}
              <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      Вы
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">
                    Вы
                  </span>
                </div>
              </div>

              {/* Удаленные видео */}
              {participants.map((participant) => (
                participant.userId !== currentUserId && (
                  <div key={participant.userId} className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
                    <video
                      ref={(el) => {
                        if (el && participant.stream) {
                          el.srcObject = participant.stream;
                          remoteVideoRefs.current.set(participant.userId, el);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {!participant.stream && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Avatar className="w-16 h-16">
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                            {participant.userName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                      {participant.userName}
                    </div>
                  </div>
                )
              ))}
            </div>
          </ScrollArea>

          {/* Элементы управления */}
          <div className="flex justify-center gap-4 pb-4">
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

            {onAddParticipant && (
              <Button
                variant="secondary"
                size="icon"
                onClick={onAddParticipant}
                className="rounded-full w-12 h-12"
              >
                <UserPlus className="w-5 h-5" />
              </Button>
            )}

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
    </Dialog>
  );
};

export default GroupVideoCall;
