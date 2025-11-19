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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<{
    ping: number;
    packetLoss: number;
    videoQuality: string;
    audioQuality: string;
  }>({ ping: 0, packetLoss: 0, videoQuality: 'good', audioQuality: 'good' });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalStreamRef = useRef<MediaStream | null>(null);

  const { recordCall, updateCallStatus } = useCallHistory(currentUserId);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    if (!isOpen) return;

    console.log('[VideoCall] Component opened:', {
      isInitiator,
      currentUserId,
      otherUserId,
      chatId,
      timestamp: new Date().toISOString()
    });

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
      originalStreamRef.current = stream;
      if (import.meta.env.DEV) {
        console.log("PeerConnection created");
      }

      // Добавляем локальные треки с настройками для лучшего качества
      stream.getTracks().forEach((track) => {
        console.log(`[VideoCall] Adding local ${track.kind} track:`, {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted
        });
        const sender = pc.addTrack(track, stream);
        console.log(`[VideoCall] Track ${track.kind} added to peer connection`);
        
        // Настраиваем параметры отправки для видео
        if (track.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 2000000; // 2 Mbps
          params.encodings[0].maxFramerate = 30;
          sender.setParameters(params).then(() => {
            console.log('[VideoCall] Video encoding parameters set successfully');
          }).catch(err => {
            console.error('[VideoCall] Failed to set video parameters:', err);
          });
        }
      });

      // Обрабатываем входящие треки
      pc.ontrack = (event) => {
        console.log(`[VideoCall] Received remote ${event.track.kind} track:`, {
          trackId: event.track.id,
          trackLabel: event.track.label,
          trackEnabled: event.track.enabled,
          trackReadyState: event.track.readyState,
          trackMuted: event.track.muted,
          streamId: event.streams[0]?.id,
          streamActive: event.streams[0]?.active,
          streamTracks: event.streams[0]?.getTracks().length
        });
        
        const [stream] = event.streams;
        if (!stream) {
          console.error('[VideoCall] No stream in track event!');
          return;
        }
        
        // Проверяем, что трек активен
        if (event.track.readyState !== 'live') {
          console.warn('[VideoCall] Track is not live:', event.track.readyState);
        }
        
        setRemoteStream(stream);
        
        if (remoteVideoRef.current) {
          console.log('[VideoCall] Attaching remote stream to video element');
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.volume = 1.0;
          
          // Принудительно воспроизводим видео с обработкой ошибок
          const playPromise = remoteVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('[VideoCall] Remote video playing successfully');
              })
              .catch(err => {
                console.error('[VideoCall] Failed to play remote video:', err);
                // Пробуем еще раз через небольшую задержку
                setTimeout(() => {
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play().catch(e => 
                      console.error('[VideoCall] Retry play failed:', e)
                    );
                  }
                }, 500);
              });
          }
        } else {
          console.error('[VideoCall] Remote video ref is null!');
        }
      };

      // Обрабатываем ICE candidates с улучшенной обработкой ошибок
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          if (import.meta.env.DEV) {
            console.log("Sending ICE candidate");
          }
          try {
            await sendSignalingMessage({
              type: "ice-candidate",
              candidate: event.candidate,
            });
          } catch (error) {
            console.error("Failed to send ICE candidate:", error);
          }
        }
      };

      // Обрабатываем изменение состояния соединения с улучшенным reconnection
      pc.oniceconnectionstatechange = () => {
        console.log('[VideoCall] ICE connection state changed:', {
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          connectionState: pc.connectionState
        });
        
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          if (callStatus !== "connected") {
            console.log('[VideoCall] Call successfully connected!');
            setCallStatus("connected");
            toast.success("Звонок подключен");
            if (isInitiator) {
              updateCallStatus(currentUserId, otherUserId, callStartTime, "completed");
            }
          }
        } else if (pc.iceConnectionState === "failed") {
          console.error('[VideoCall] ICE connection failed, attempting restart');
          if (pc.restartIce) {
            pc.restartIce();
          } else {
            toast.error("Потеряно соединение");
            handleEndCall();
          }
        } else if (pc.iceConnectionState === "disconnected") {
          toast.warning("Переподключение...");
        }
      };

      // Мониторинг общего состояния соединения
      pc.onconnectionstatechange = () => {
        if (import.meta.env.DEV) {
          console.log("Connection state:", pc.connectionState);
        }
        
        if (pc.connectionState === 'failed') {
          toast.error("Соединение потеряно");
        } else if (pc.connectionState === 'connected') {
          // Начинаем мониторинг качества связи
          startQualityMonitoring(pc);
        }
      };

      // Подписываемся на сообщения сигнализации ПЕРЕД созданием offer
      await subscribeToSignaling(pc);

      // Если мы инициатор звонка, создаем offer
      if (isInitiator) {
        console.log('[VideoCall] Creating offer as initiator');
        // Даем время получателю подписаться на канал (2 секунды)
        console.log('[VideoCall] Waiting 2 seconds for receiver to subscribe...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[VideoCall] Proceeding with offer creation');
        
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        console.log('[VideoCall] Offer created:', offer.type);
        
        await pc.setLocalDescription(offer);
        console.log('[VideoCall] Local description set (offer)');
        
        await sendSignalingMessage({
          type: "offer",
          offer: offer,
        });
        console.log('[VideoCall] Offer sent to peer');
      }

    } catch (error) {
      console.error("Error initializing call:", error);
      toast.error("Не удалось получить доступ к камере/микрофону");
      onClose();
    }
  };

  const sendSignalingMessage = async (message: any) => {
    try {
      console.log('[VideoCall] Sending signaling message:', {
        type: message.type,
        to: otherUserId,
        chatId
      });
      
      // Get auth session for secure relay
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error("[VideoCall] No active session for signaling");
        return;
      }

      // Send through secure edge function relay
      const { data, error } = await supabase.functions.invoke('relay-signaling', {
        body: {
          to: otherUserId,
          message,
          chatId,
          callType: 'video'
        }
      });

      if (error) {
        console.error("[VideoCall] Error sending signaling message:", error);
        toast.error("Ошибка отправки сигнала");
      } else {
        console.log('[VideoCall] Signaling message sent successfully:', message.type);
      }
    } catch (error) {
      console.error("[VideoCall] Error in sendSignalingMessage:", error);
    }
  };

  const subscribeToSignaling = async (pc: RTCPeerConnection) => {
    return new Promise<void>((resolve, reject) => {
      console.log('[VideoCall] Subscribing to signaling channel:', `video-call-${chatId}`);
      
      const channel = supabase
        .channel(`video-call-${chatId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on("broadcast", { event: "signaling" }, async ({ payload }) => {
          console.log('[VideoCall] Received signaling message:', {
            type: payload.message?.type,
            from: payload.from,
            to: payload.to,
            currentUserId,
            otherUserId,
            timestamp: new Date().toISOString()
          });
          
          // Строгая фильтрация: сообщение должно быть ОТ другого пользователя И ДЛЯ нас
          if (payload.from === currentUserId) {
            console.log('[VideoCall] Ignoring our own message');
            return;
          }
          
          if (payload.to && payload.to !== currentUserId) {
            console.log('[VideoCall] Message is for someone else:', payload.to);
            return;
          }

          const { message, from } = payload;
          
          // Verify message is from expected peer
          if (from !== otherUserId) {
            console.warn('[VideoCall] Message from unexpected peer:', from, 'expected:', otherUserId);
            return;
          }

          try {
            if (message.type === "offer") {
              console.log('[VideoCall] Processing offer from peer');
              await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
              console.log('[VideoCall] Remote description set (offer)');
              
              const answer = await pc.createAnswer();
              console.log('[VideoCall] Answer created');
              
              await pc.setLocalDescription(answer);
              console.log('[VideoCall] Local description set (answer)');
              
              await sendSignalingMessage({
                type: "answer",
                answer: answer,
              });
              console.log('[VideoCall] Answer sent to peer');
            } else if (message.type === "answer") {
              console.log('[VideoCall] Processing answer from peer, signaling state:', pc.signalingState);
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                console.log('[VideoCall] Remote description set (answer)');
              } else {
                console.warn('[VideoCall] Invalid signaling state for answer:', pc.signalingState);
              }
            } else if (message.type === "ice-candidate" && message.candidate) {
              console.log('[VideoCall] Processing ICE candidate');
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                  console.log('[VideoCall] ICE candidate added successfully');
                } catch (err) {
                  console.error("[VideoCall] Error adding ICE candidate:", err);
                }
              } else {
                console.warn('[VideoCall] Cannot add ICE candidate - no remote description yet');
              }
            } else if (message.type === "end-call") {
              console.log('[VideoCall] Call ended by remote peer');
              handleEndCall();
            }
          } catch (error) {
            console.error("[VideoCall] Error processing signaling message:", error);
          }
        })
        .subscribe((status) => {
          console.log('[VideoCall] Channel subscription status:', status, {
            chatId,
            currentUserId,
            otherUserId,
            isInitiator,
            timestamp: new Date().toISOString()
          });
          if (status === "SUBSCRIBED") {
            console.log('[VideoCall] ✓ Successfully subscribed to signaling channel - ready to receive messages');
            channelRef.current = channel;
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error('[VideoCall] ✗ Subscription failed:', status);
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

  const toggleScreenShare = async () => {
    if (!peerConnection) return;

    try {
      if (isScreenSharing) {
        // Возвращаемся к камере
        if (originalStreamRef.current) {
          const videoTrack = originalStreamRef.current.getVideoTracks()[0];
          const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
          
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
            setLocalStream(originalStreamRef.current);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = originalStreamRef.current;
            }
          }
        }
        setIsScreenSharing(false);
        toast.success("Демонстрация экрана остановлена");
      } else {
        // Начинаем демонстрацию экрана
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');

        if (sender) {
          await sender.replaceTrack(screenTrack);
          setLocalStream(screenStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
          }

          // Обработка окончания демонстрации экрана
          screenTrack.onended = () => {
            toggleScreenShare();
          };
        }
        
        setIsScreenSharing(true);
        toast.success("Демонстрация экрана начата");
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
      toast.error("Не удалось переключить демонстрацию экрана");
    }
  };

  const startQualityMonitoring = (pc: RTCPeerConnection) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let currentRoundTripTime = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            if (report.packetsLost !== undefined) {
              packetsLost += report.packetsLost;
            }
            if (report.packetsReceived !== undefined) {
              packetsReceived += report.packetsReceived;
            }
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              currentRoundTripTime = report.currentRoundTripTime * 1000; // convert to ms
            }
          }
        });

        const packetLoss = packetsReceived > 0 
          ? (packetsLost / (packetsLost + packetsReceived)) * 100 
          : 0;

        const quality = {
          ping: Math.round(currentRoundTripTime),
          packetLoss: Math.round(packetLoss * 100) / 100,
          videoQuality: packetLoss < 5 ? 'good' : packetLoss < 15 ? 'fair' : 'poor',
          audioQuality: packetLoss < 3 ? 'good' : packetLoss < 10 ? 'fair' : 'poor',
        };

        setConnectionQuality(quality);

        // Предупреждение при плохом качестве
        if (quality.videoQuality === 'poor' || quality.audioQuality === 'poor') {
          toast.warning("Плохое качество связи");
        }
      } catch (error) {
        console.error("Error getting stats:", error);
      }
    }, 3000); // Обновляем каждые 3 секунды
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
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
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
              muted={true}
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
          <DialogTitle className="flex items-center justify-between pr-8">
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
              muted={false}
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
                muted={true}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                Вы
              </div>
            </div>
          </div>

          {/* Индикаторы качества связи */}
          {callStatus === "connected" && (
            <div className="flex justify-center gap-4 text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <span>Пинг: {connectionQuality.ping}мс</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Потери: {connectionQuality.packetLoss}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  connectionQuality.videoQuality === 'good' ? 'bg-green-500' :
                  connectionQuality.videoQuality === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span>Видео</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  connectionQuality.audioQuality === 'good' ? 'bg-green-500' :
                  connectionQuality.audioQuality === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span>Аудио</span>
              </div>
            </div>
          )}

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
              variant={isScreenSharing ? "default" : "secondary"}
              size="icon"
              onClick={toggleScreenShare}
              className="rounded-full w-12 h-12"
              title={isScreenSharing ? "Остановить демонстрацию экрана" : "Демонстрация экрана"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
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
