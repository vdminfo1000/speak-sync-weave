import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhoneOff, Mic, MicOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Participant {
  userId: string;
  userName: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
  isMuted?: boolean;
}

interface GroupAudioCallProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserId: string;
  initialParticipants: Array<{ userId: string; userName: string }>;
  onAddParticipant?: () => void;
}

const GroupAudioCall = ({ 
  isOpen, 
  onClose, 
  roomId, 
  currentUserId, 
  initialParticipants,
  onAddParticipant 
}: GroupAudioCallProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>(
    initialParticipants.map(p => ({ userId: p.userId, userName: p.userName }))
  );
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
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
      console.log("GroupAudioCall opened");
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
        console.log("Initializing group audio call...");
      }
      
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
        if (import.meta.env.DEV) {
          console.warn("Failed with advanced constraints, using basic audio");
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      if (import.meta.env.DEV) {
        console.log("Microphone access granted, got stream:", stream.id);
      }
      setLocalStream(stream);

      await subscribeToRoom();

      await sendSignalingMessage({
        type: "user-joined",
        userId: currentUserId,
      }, null);

      for (const participant of participants) {
        if (participant.userId !== currentUserId) {
          await createPeerConnection(participant.userId, true, stream);
        }
      }

    } catch (error) {
      console.error("Error initializing call:", error);
      toast.error("Не удалось получить доступ к микрофону");
      onClose();
    }
  };

  const createPeerConnection = async (targetUserId: string, isInitiator: boolean, stream: MediaStream) => {
    if (import.meta.env.DEV) {
      console.log(`Creating peer connection to ${targetUserId}, isInitiator: ${isInitiator}`);
    }
    
    const pc = new RTCPeerConnection(configuration);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (import.meta.env.DEV) {
        console.log(`Received remote audio track from ${targetUserId}`);
      }
      const [remoteStream] = event.streams;
      
      const audioElement = new Audio();
      audioElement.srcObject = remoteStream;
      audioElement.autoplay = true;
      audioRefs.current.set(targetUserId, audioElement);
      
      setParticipants(prev => 
        prev.map(p => 
          p.userId === targetUserId 
            ? { ...p, stream: remoteStream, peerConnection: pc }
            : p
        )
      );
    };

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

    setParticipants(prev => 
      prev.map(p => 
        p.userId === targetUserId 
          ? { ...p, peerConnection: pc }
          : p
      )
    );

    if (isInitiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
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
          callType: 'group-audio'
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
        .channel(`group-audio-call-${roomId}`, {
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
              if (from !== currentUserId && !participants.find(p => p.userId === from)) {
                if (import.meta.env.DEV) {
                  console.log("New user joined:", from);
                }
                setParticipants(prev => [...prev, { userId: from, userName: "Участник" }]);
                
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
      
      const audioElement = audioRefs.current.get(userId);
      if (audioElement) {
        audioElement.pause();
        audioElement.srcObject = null;
        audioRefs.current.delete(userId);
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

  const handleEndCall = () => {
    sendSignalingMessage({ type: "user-left" }, null);
    cleanup();
    onClose();
  };

  const cleanup = () => {
    if (import.meta.env.DEV) {
      console.log("Cleaning up group audio call resources");
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        if (import.meta.env.DEV) {
          console.log("Stopped local audio track");
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
    
    audioRefs.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioRefs.current.clear();
    
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Групповой голосовой звонок</span>
            <span className="text-sm font-normal text-muted-foreground">
              {formatCallDuration(callDuration)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <ScrollArea className="h-64">
            <div className="grid grid-cols-2 gap-4 p-4">
              {/* Текущий пользователь */}
              <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-secondary/20">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    Вы
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">Вы</span>
                {isMuted && <span className="text-xs text-muted-foreground">(без звука)</span>}
              </div>

              {/* Другие участники */}
              {participants.map((participant) => (
                participant.userId !== currentUserId && (
                  <div key={participant.userId} className="flex flex-col items-center gap-2 p-4 border rounded-lg">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {participant.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{participant.userName}</span>
                    {!participant.stream && (
                      <span className="text-xs text-muted-foreground">Соединение...</span>
                    )}
                  </div>
                )
              ))}
            </div>
          </ScrollArea>

          {/* Элементы управления */}
          <div className="flex justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleMute}
              className="rounded-full w-16 h-16"
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            {onAddParticipant && (
              <Button
                variant="secondary"
                size="icon"
                onClick={onAddParticipant}
                className="rounded-full w-16 h-16"
              >
                <UserPlus className="w-6 h-6" />
              </Button>
            )}

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
      </DialogContent>
    </Dialog>
  );
};

export default GroupAudioCall;
