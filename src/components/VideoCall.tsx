import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Minimize2, Maximize2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import InviteToGroupCallDialog from "./InviteToGroupCallDialog";
import { useCallHistory } from "@/hooks/useCallHistory";
import { playBusyTone } from "@/utils/busyTone";

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
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const isProcessingQueue = useRef(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const { recordCall, updateCallStatus } = useCallHistory(currentUserId);

  const configuration: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
        // ✅ ДОБАВЬТЕ TURN сервер:
        {
          urls: [
            'turn:web.goodok.org:3478',
            'turns:web.goodok.org:5349'
          ],
          username: 'turnuser',
          credential: 'turnpassword'
        }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10,
    };

  // Обработчик visibility change для сохранения соединения при сворачивании
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('[VideoCall] Visibility changed:', document.visibilityState);
      
      if (document.visibilityState === 'hidden') {
        // Страница скрыта - сохраняем треки активными
        console.log('[VideoCall] Page hidden, keeping tracks alive');
        
        // Предотвращаем паузу видео при сворачивании
        if (localVideoRef.current) {
          localVideoRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.play().catch(() => {});
        }
      } else if (document.visibilityState === 'visible') {
        // Страница снова видима
        console.log('[VideoCall] Page visible again, resuming playback');
        
        // Возобновляем воспроизведение
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current && remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          remoteVideoRef.current.play().catch(() => {});
        }
        
        // Проверяем состояние соединения
        const pc = peerConnectionRef.current;
        if (pc) {
          console.log('[VideoCall] Connection state after visibility:', {
            iceState: pc.iceConnectionState,
            connectionState: pc.connectionState,
            signalingState: pc.signalingState
          });
          
          // Если соединение разорвано, пробуем переподключиться
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.log('[VideoCall] Connection lost while hidden, attempting ICE restart');
            if (pc.restartIce) {
              pc.restartIce();
            }
          }
        }
      }
    };

    // Обработчик для закрытия страницы / навигации
    const handleBeforeUnload = () => {
      console.log('[VideoCall] Page unloading, cleaning up...');
      // Останавливаем все стримы синхронно
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };

    const handlePageHide = () => {
      console.log('[VideoCall] Page hide event, cleaning up...');
      handleBeforeUnload();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    console.log('[VideoCall] Component opened:', {
      isInitiator,
      currentUserId,
      otherUserId,
      chatId,
      timestamp: new Date().toISOString()
    });

    // Подписываемся на уведомления о занятости и отклонении звонка
    const busyChannel = supabase.channel(`call-notifications-${currentUserId}`)
      .on("broadcast", { event: "call-busy" }, (payload: any) => {
        console.log('[VideoCall] Received busy signal:', payload);
        if (payload.payload?.userId === otherUserId) {
          playBusyTone();
          toast.error("Абонент занят, попробуйте позже");
          handleEndCall();
        }
      })
      .on("broadcast", { event: "call-declined" }, (payload: any) => {
        console.log('[VideoCall] Received call-declined signal:', payload);
        if (payload.payload?.chatId === chatId) {
          playBusyTone();
          toast.info("Звонок отклонен");
          handleEndCall();
        }
      })
      .subscribe();

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
      supabase.removeChannel(busyChannel);
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

  // Восстанавливаем потоки при разворачивании окна
  useEffect(() => {
    console.log('[VideoCall] isMinimized changed:', isMinimized);
    
    // Восстанавливаем потоки для обоих режимов с небольшой задержкой
    const restoreTimeout = setTimeout(() => {
      if (localVideoRef.current && localStreamRef.current) {
        console.log('[VideoCall] Restoring local stream to video element');
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(err => {
          console.warn('[VideoCall] Failed to play local video:', err);
        });
      }
      
      if (remoteVideoRef.current && remoteStreamRef.current) {
        console.log('[VideoCall] Restoring remote stream to video element');
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(err => {
          console.warn('[VideoCall] Failed to play remote video:', err);
        });
      }
    }, 50);
    
    return () => clearTimeout(restoreTimeout);
  }, [isMinimized]);

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
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);
      peerConnectionRef.current = pc;
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
        remoteStreamRef.current = stream;
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

      // Обрабатываем ICE кандидаты с гарантированной доставкой и очередью
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[VideoCall] New ICE candidate:', {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            priority: event.candidate.priority
          });
          
          // Проверяем, установлен ли remote description
          if (!pc.remoteDescription) {
            console.log('[VideoCall] ⚠ Queueing ICE candidate (no remote description yet)');
            iceCandidatesQueue.current.push(event.candidate.toJSON());
          }
          
          sendSignalingMessage({
            type: "ice-candidate",
            candidate: event.candidate,
          }).catch(err => {
            console.error('[VideoCall] ✗ Failed to send ICE candidate:', err);
          });
        } else {
          console.log('[VideoCall] ✓ ICE candidate gathering completed');
        }
      };

      // Состояние ICE соединения с автоматическим переподключением
      pc.oniceconnectionstatechange = async () => {
        console.log('[VideoCall] ICE connection state changed:', {
          state: pc.iceConnectionState,
          gatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          timestamp: new Date().toISOString()
        });
        
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          if (callStatus !== "connected") {
            console.log('[VideoCall] ✓ Call successfully connected!');
            reconnectAttempts.current = 0; // Reset reconnect counter
            setCallStatus("connected");
            toast.success("Звонок подключен");
            if (isInitiator) {
              updateCallStatus(currentUserId, otherUserId, callStartTime, "completed");
            }
          }
        } else if (pc.iceConnectionState === "failed") {
          console.error('[VideoCall] ✗ ICE connection failed');
          
          // Пытаемся переподключиться
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            console.log(`[VideoCall] Attempting reconnect ${reconnectAttempts.current}/${maxReconnectAttempts}`);
            toast.warning(`Переподключение... (попытка ${reconnectAttempts.current})`);
            
            try {
              if (pc.restartIce) {
                pc.restartIce();
              } else {
                // Fallback: создаем новый offer
                if (isInitiator) {
                  const offer = await pc.createOffer({ iceRestart: true });
                  await pc.setLocalDescription(offer);
                  await sendSignalingMessage({ type: "offer", offer });
                }
              }
            } catch (err) {
              console.error('[VideoCall] Reconnect failed:', err);
            }
          } else {
            console.error('[VideoCall] Max reconnect attempts reached');
            toast.error("Не удалось восстановить соединение");
            handleEndCall();
          }
        } else if (pc.iceConnectionState === "disconnected") {
          console.warn('[VideoCall] ⚠ ICE connection disconnected, waiting for reconnect...');
          toast.warning("Переподключение...");
        } else if (pc.iceConnectionState === "checking") {
          console.log('[VideoCall] Checking ICE connectivity...');
        }
      };

      // Устанавливаем таймаут для ICE gathering (10 секунд максимум)
      const iceGatheringTimeout = setTimeout(() => {
        if (pc.iceGatheringState === 'gathering') {
          console.warn('[VideoCall] ⚠ ICE gathering timeout after 10 seconds, proceeding anyway');
        }
      }, 10000);

      pc.onicegatheringstatechange = () => {
        console.log('[VideoCall] ICE gathering state changed:', pc.iceGatheringState);
        if (pc.iceGatheringState === 'complete') {
          console.log('[VideoCall] ✓ ICE candidate gathering completed');
          clearTimeout(iceGatheringTimeout);
        }
      };

      // Мониторинг общего состояния соединения
      pc.onconnectionstatechange = () => {
        console.log('[VideoCall] Connection state changed:', {
          state: pc.connectionState,
          iceState: pc.iceConnectionState,
          signalingState: pc.signalingState,
          timestamp: new Date().toISOString()
        });
        
        if (pc.connectionState === 'connected') {
          console.log('[VideoCall] ✓ Peer connection fully established');
          // Начинаем мониторинг качества связи
          startQualityMonitoring(pc);
        } else if (pc.connectionState === 'failed') {
          console.error('[VideoCall] ✗ Peer connection failed');
          toast.error("Соединение потеряно");
        } else if (pc.connectionState === 'disconnected') {
          console.warn('[VideoCall] Peer connection disconnected');
        }
      };

      // Подписываемся на сообщения сигнализации ПЕРЕД созданием offer
      await subscribeToSignaling(pc);

      // Если мы инициатор звонка, создаем offer немедленно (Trickle ICE)
      if (isInitiator) {
        console.log('[VideoCall] Creating offer as initiator (Trickle ICE)');
        
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        console.log('[VideoCall] Offer created:', offer.type);
        
        await pc.setLocalDescription(offer);
        console.log('[VideoCall] Local description set, ICE gathering state:', pc.iceGatheringState);
        
        // Отправляем offer немедленно, не дожидаясь всех ICE-кандидатов
        await sendSignalingMessage({
          type: "offer",
          offer: offer,
        });
        console.log('[VideoCall] Offer sent immediately to peer');
        
        // Повторяем offer каждые 3 секунды пока не получим answer или не подключимся
        const offerRetryInterval = setInterval(async () => {
          if (pc.signalingState === 'have-local-offer' && callStatus === 'connecting') {
            console.log('[VideoCall] Retrying offer (no answer received yet)');
            await sendSignalingMessage({
              type: "offer",
              offer: pc.localDescription,
            });
          } else {
            clearInterval(offerRetryInterval);
          }
        }, 3000);
        
        // Очищаем интервал при закрытии
        setTimeout(() => clearInterval(offerRetryInterval), 30000);
      } else {
        // Получатель отправляет "ready" чтобы инициатор знал что можно отправлять offer
        console.log('[VideoCall] Sending ready signal as receiver');
        await sendSignalingMessage({ type: "ready" });
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
            if (message.type === "ready") {
              // Получатель готов, отправляем offer повторно
              console.log('[VideoCall] 📨 Receiver is ready, re-sending offer');
              if (isInitiator && pc.localDescription) {
                await sendSignalingMessage({
                  type: "offer",
                  offer: pc.localDescription,
                });
                console.log('[VideoCall] ✓ Offer re-sent to ready receiver');
              }
            } else if (message.type === "offer") {
              console.log('[VideoCall] 📨 Received offer from peer at', new Date().toISOString());
              
              // Проверяем состояние - если уже есть remote description, пропускаем
              if (pc.signalingState === 'stable' && pc.remoteDescription) {
                console.log('[VideoCall] ⚠ Already have remote description, ignoring duplicate offer');
                return;
              }
              
              await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
              console.log('[VideoCall] ✓ Remote description set (offer)');
              
              // Обрабатываем очередь ICE candidates после установки remote description
              await processQueuedIceCandidates(pc);
              
              const answer = await pc.createAnswer();
              console.log('[VideoCall] Answer created');
              
              await pc.setLocalDescription(answer);
              console.log('[VideoCall] ✓ Local description set (answer)');
              
              await sendSignalingMessage({
                type: "answer",
                answer: answer,
              });
              console.log('[VideoCall] ✓ Answer sent to peer at', new Date().toISOString());
            } else if (message.type === "answer") {
              console.log('[VideoCall] 📨 Received answer from peer at', new Date().toISOString());
              console.log('[VideoCall] Current signaling state:', pc.signalingState);
              
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                console.log('[VideoCall] ✓ Remote description set (answer)');
                
                // Обрабатываем очередь ICE candidates после установки remote description
                await processQueuedIceCandidates(pc);
              } else {
                console.warn('[VideoCall] ⚠ Cannot set answer - invalid signaling state:', pc.signalingState);
              }
            } else if (message.type === "ice-candidate" && message.candidate) {
              console.log('[VideoCall] Received ICE candidate');
              
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                  console.log('[VideoCall] ✓ ICE candidate added successfully');
                } catch (err) {
                  console.error("[VideoCall] ✗ Error adding ICE candidate:", err);
                }
              } else {
                console.warn('[VideoCall] ⚠ Queueing ICE candidate (no remote description)');
                iceCandidatesQueue.current.push(message.candidate);
              }
            } else if (message.type === "end-call") {
              console.log('[VideoCall] Received end-call signal');
              handleEndCall();
            }
          } catch (error) {
            console.error("[VideoCall] ✗ Error processing signaling message:", error);
            toast.error("Ошибка обработки сигнала");
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
        // Останавливаем треки демонстрации экрана
        if (screenStreamRef.current) {
          console.log('[VideoCall] Stopping screen share tracks');
          screenStreamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log(`[VideoCall] Stopped screen track: ${track.kind}, readyState: ${track.readyState}`);
          });
          screenStreamRef.current = null;
        }
        
        // Возвращаемся к камере
        if (originalStreamRef.current) {
          const videoTrack = originalStreamRef.current.getVideoTracks()[0];
          const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
          
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
            setLocalStream(originalStreamRef.current);
            localStreamRef.current = originalStreamRef.current;
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

        // Сохраняем ссылку на стрим демонстрации экрана
        screenStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');

        if (sender) {
          await sender.replaceTrack(screenTrack);
          setLocalStream(screenStream);
          localStreamRef.current = screenStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
          }

          // Обработка окончания демонстрации экрана (когда пользователь нажимает "Прекратить демонстрацию" в браузере)
          screenTrack.onended = () => {
            console.log('[VideoCall] Screen share ended by user');
            // Очищаем ссылку, чтобы избежать повторного вызова stop
            screenStreamRef.current = null;
            setIsScreenSharing(false);
            
            // Возвращаемся к камере
            if (originalStreamRef.current && peerConnectionRef.current) {
              const videoTrack = originalStreamRef.current.getVideoTracks()[0];
              const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
              
              if (sender && videoTrack) {
                sender.replaceTrack(videoTrack).then(() => {
                  setLocalStream(originalStreamRef.current);
                  localStreamRef.current = originalStreamRef.current;
                  if (localVideoRef.current) {
                    localVideoRef.current.srcObject = originalStreamRef.current;
                  }
                  toast.success("Демонстрация экрана остановлена");
                });
              }
            }
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

  const processQueuedIceCandidates = async (pc: RTCPeerConnection) => {
    if (isProcessingQueue.current || iceCandidatesQueue.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;
    console.log(`[VideoCall] Processing ${iceCandidatesQueue.current.length} queued ICE candidates`);

    const queue = [...iceCandidatesQueue.current];
    iceCandidatesQueue.current = [];

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[VideoCall] ✓ Queued ICE candidate added');
      } catch (err) {
        console.error('[VideoCall] ✗ Error adding queued ICE candidate:', err);
      }
    }

    isProcessingQueue.current = false;
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
    console.log('[VideoCall] Cleaning up call resources');
    
    // Stop screen share stream first
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[VideoCall] Stopped screen share ${track.kind} track`);
      });
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    
    // Stop local tracks using ref (more reliable than state)
    const streamToClean = localStreamRef.current || localStream;
    if (streamToClean) {
      streamToClean.getTracks().forEach((track) => {
        track.stop();
        console.log(`[VideoCall] Stopped local ${track.kind} track, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });
      localStreamRef.current = null;
    }
    
    // Stop original stream if exists (for screen sharing)
    if (originalStreamRef.current) {
      originalStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[VideoCall] Stopped original ${track.kind} track`);
      });
      originalStreamRef.current = null;
    }
    
    // Stop remote tracks using ref
    const remoteToClean = remoteStreamRef.current || remoteStream;
    if (remoteToClean) {
      remoteToClean.getTracks().forEach((track) => {
        track.stop();
        console.log(`[VideoCall] Stopped remote ${track.kind} track`);
      });
      remoteStreamRef.current = null;
    }
    
    // Clear video elements srcObject
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Close peer connection using ref
    const pcToClose = peerConnectionRef.current || peerConnection;
    if (pcToClose) {
      pcToClose.close();
      console.log('[VideoCall] Peer connection closed');
      peerConnectionRef.current = null;
    }
    
    // Remove Supabase channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      console.log('[VideoCall] Signaling channel removed');
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
    
    // Clear queues and refs
    iceCandidatesQueue.current = [];
    reconnectAttempts.current = 0;
    
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnection(null);
    setCallStatus("ended");
    setCallDuration(0);
    console.log('[VideoCall] Cleanup complete');
  };

  // Минимизированное представление - используем CSS visibility чтобы не пересоздавать DOM
  if (isMinimized) {
    return (
      <>
        {/* Скрытые видео элементы для сохранения потоков */}
        <div className="hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
          />
        </div>
        
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
      </>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-4xl"
        onCloseClick={handleEndCall}
        onInteractOutside={(e) => {
          e.preventDefault();
          setIsMinimized(true);
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          setIsMinimized(true);
        }}
      >
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
        roomId={chatId}
        callType="video"
        onInvite={handleInviteToGroup}
      />
    </Dialog>
  );
};

export default VideoCall;
