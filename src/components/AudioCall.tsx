import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Maximize2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import InviteToGroupCallDialog from "./InviteToGroupCallDialog";
import { useCallHistory } from "@/hooks/useCallHistory";
import { playBusyTone } from "@/utils/busyTone";

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
  const [connectionQuality, setConnectionQuality] = useState<{
    ping: number;
    packetLoss: number;
    audioQuality: string;
  }>({ ping: 0, packetLoss: 0, audioQuality: 'good' });
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const channelRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const isProcessingQueue = useRef(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const callInitStartedAtRef = useRef<number>(0);
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Ref для отслеживания активного состояния звонка (для Safari iOS)
  const isCallActiveRef = useRef(false);

  // Обработчик visibility change для сохранения соединения при сворачивании
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('[AudioCall] Visibility changed:', document.visibilityState);
      
      if (document.visibilityState === 'hidden') {
        // Страница скрыта - сохраняем треки активными
        console.log('[AudioCall] Page hidden, keeping audio track alive');
        
        // Предотвращаем паузу аудио при сворачивании
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      } else if (document.visibilityState === 'visible') {
        // Страница снова видима
        console.log('[AudioCall] Page visible again');
        
        // Возобновляем воспроизведение
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
        
        // Проверяем состояние соединения
        const pc = peerConnectionRef.current;
        if (pc) {
          console.log('[AudioCall] Connection state after visibility:', {
            iceState: pc.iceConnectionState,
            connectionState: pc.connectionState,
            signalingState: pc.signalingState
          });
          
          // Если соединение разорвано, пробуем переподключиться
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.log('[AudioCall] Connection lost while hidden, attempting ICE restart');
            if (pc.restartIce) {
              pc.restartIce();
            }
          }
        }
      }
    };

    // Обработчик для закрытия страницы / навигации
    // ВАЖНО: В Safari iOS pagehide может срабатывать при переключении между приложениями
    // Поэтому НЕ вызываем cleanup если звонок активен
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('[AudioCall] Page unloading, isCallActive:', isCallActiveRef.current);
      
      // Safari iOS: не очищаем ресурсы при pagehide если звонок активен
      const isSafariIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && 
                          /WebKit/.test(navigator.userAgent) && 
                          !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
      
      if (isSafariIOS && isCallActiveRef.current) {
        console.log('[AudioCall] Safari iOS: keeping call alive during page hide');
        return;
      }
      
      // Останавливаем все стримы синхронно только при реальном закрытии страницы
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };

    const handlePageHide = (e: PageTransitionEvent) => {
      console.log('[AudioCall] Page hide event, persisted:', e.persisted, 'isCallActive:', isCallActiveRef.current);
      
      // Safari iOS: e.persisted = true означает, что страница может быть восстановлена
      // В этом случае НЕ очищаем ресурсы
      const isSafariIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && 
                          /WebKit/.test(navigator.userAgent) && 
                          !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
      
      if (isSafariIOS && (e.persisted || isCallActiveRef.current)) {
        console.log('[AudioCall] Safari iOS: preserving call state during page hide');
        return;
      }
      
      if (!e.persisted) {
        // Manually handle cleanup without calling handleBeforeUnload
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
      }
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

    console.log('[AudioCall] Component opened:', {
      isInitiator,
      currentUserId,
      otherUserId,
      chatId,
      timestamp: new Date().toISOString()
    });

    // Подписываемся на уведомления о занятости и отклонении звонка
    const busyChannel = supabase.channel(`call-notifications-${currentUserId}`)
      .on("broadcast", { event: "call-busy" }, (payload: any) => {
        console.log('[AudioCall] Received busy signal:', payload);
        if (payload.payload?.userId === otherUserId) {
          playBusyTone();
          toast.error("Абонент занят, попробуйте позже");
          handleEndCall();
        }
      })
      .on("broadcast", { event: "call-declined" }, (payload: any) => {
        console.log('[AudioCall] Received call-declined signal:', payload);
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
        call_type: "audio",
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

  // Восстанавливаем аудио при разворачивании окна
  useEffect(() => {
    console.log('[AudioCall] isMinimized changed:', isMinimized);
    
    const restoreTimeout = setTimeout(() => {
      if (audioRef.current) {
        console.log('[AudioCall] Ensuring audio is playing');
        audioRef.current.play().catch(err => {
          console.warn('[AudioCall] Failed to play audio:', err);
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
      // Отмечаем звонок как активный для Safari iOS
      isCallActiveRef.current = true;
      callInitStartedAtRef.current = Date.now();

      console.log('[AudioCall] initializeCall start', {
        ua: navigator.userAgent,
        isInitiator,
        chatId,
        currentUserId,
        otherUserId,
        ts: new Date().toISOString(),
      });
      
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
      localStreamRef.current = stream;

      // Создаем peer connection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);
      peerConnectionRef.current = pc;

      // Добавляем локальные треки
      stream.getTracks().forEach((track) => {
        console.log(`[AudioCall] Adding local ${track.kind} track:`, {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState
        });
        pc.addTrack(track, stream);
        console.log(`[AudioCall] Track ${track.kind} added to peer connection`);
      });

      // Обрабатываем входящие треки
      pc.ontrack = (event) => {
        console.log(`[AudioCall] Received remote ${event.track.kind} track:`, {
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
          console.error('[AudioCall] No stream in track event!');
          return;
        }
        
        // Проверяем, что трек активен
        if (event.track.readyState !== 'live') {
          console.warn('[AudioCall] Track is not live:', event.track.readyState);
        }
        
        if (audioRef.current) {
          console.log('[AudioCall] Attaching remote stream to audio element');
          audioRef.current.srcObject = stream;
          audioRef.current.volume = 1.0;
          
          // Принудительно воспроизводим аудио с обработкой ошибок
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('[AudioCall] Remote audio playing successfully');
              })
              .catch(err => {
                console.error('[AudioCall] Failed to play remote audio:', err);
                // Пробуем еще раз через небольшую задержку
                setTimeout(() => {
                  if (audioRef.current) {
                    audioRef.current.play().catch(e => 
                      console.error('[AudioCall] Retry play failed:', e)
                    );
                  }
                }, 500);
              });
          }
        } else {
          console.error('[AudioCall] Audio ref is null!');
        }
      };

      // Обработ ICE кандидаты с гарантированной доставкой и очередью
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[AudioCall] New ICE candidate:', {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            priority: event.candidate.priority
          });
          
          // Проверяем, установлен ли remote description
          if (!pc.remoteDescription) {
            console.log('[AudioCall] ⚠ Queueing ICE candidate (no remote description yet)');
            iceCandidatesQueue.current.push(event.candidate.toJSON());
          }
          
          sendSignalingMessage({
            type: "ice-candidate",
            candidate: event.candidate,
          }).catch(err => {
            console.error('[AudioCall] ✗ Failed to send ICE candidate:', err);
          });
        } else {
          console.log('[AudioCall] ✓ ICE candidate gathering completed');
        }
      };

      // Состояние ICE соединения с автоматическим переподключением
      pc.oniceconnectionstatechange = async () => {
        console.log('[AudioCall] ICE connection state changed:', {
          state: pc.iceConnectionState,
          gatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          timestamp: new Date().toISOString()
        });
        
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          if (callStatus !== "connected") {
            console.log('[AudioCall] ✓ Call successfully connected!');
            reconnectAttempts.current = 0; // Reset reconnect counter
            setCallStatus("connected");
            toast.success("Звонок подключен");
            if (isInitiator) {
              updateCallStatus(currentUserId, otherUserId, callStartTime, "completed");
            }
            
            // Начинаем мониторинг качества связи
            startQualityMonitoring(pc);
          }
        } else if (pc.iceConnectionState === "failed") {
          console.error('[AudioCall] ✗ ICE connection failed');

          const safariIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) &&
            /WebKit/.test(navigator.userAgent) &&
            !/CriOS|FxiOS|OPiOS|mercury/i.test(navigator.userAgent);

          const sinceInitMs = Date.now() - (callInitStartedAtRef.current || Date.now());
          if (safariIOS && callStatus === 'connecting' && sinceInitMs < 8000) {
            console.warn('[AudioCall] Safari iOS: ignoring early ICE failed', { sinceInitMs });
            try {
              pc.restartIce?.();
            } catch (e) {
              console.error('[AudioCall] Safari iOS restartIce error:', e);
            }
            return;
          }
          
          // Пытаемся переподключиться
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            console.log(`[AudioCall] Attempting reconnect ${reconnectAttempts.current}/${maxReconnectAttempts}`);
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
              console.error('[AudioCall] Reconnect failed:', err);
            }
          } else {
            console.error('[AudioCall] Max reconnect attempts reached');
            toast.error("Не удалось восстановить соединение");
            handleEndCall();
          }
        } else if (pc.iceConnectionState === "disconnected") {
          console.warn('[AudioCall] ⚠ ICE connection disconnected, waiting for reconnect...');
          toast.warning("Переподключение...");
        } else if (pc.iceConnectionState === "checking") {
          console.log('[AudioCall] Checking ICE connectivity...');
        }
      };

      // Устанавливаем таймаут для ICE gathering (10 секунд максимум)
      const iceGatheringTimeout = setTimeout(() => {
        if (pc.iceGatheringState === 'gathering') {
          console.warn('[AudioCall] ⚠ ICE gathering timeout after 10 seconds, proceeding anyway');
        }
      }, 10000);

      pc.onicegatheringstatechange = () => {
        console.log('[AudioCall] ICE gathering state changed:', pc.iceGatheringState);
        if (pc.iceGatheringState === 'complete') {
          console.log('[AudioCall] ✓ ICE candidate gathering completed');
          clearTimeout(iceGatheringTimeout);
        }
      };

      // Мониторинг общего состояния соединения
      pc.onconnectionstatechange = () => {
        console.log('[AudioCall] Connection state changed:', {
          state: pc.connectionState,
          iceState: pc.iceConnectionState,
          signalingState: pc.signalingState,
          timestamp: new Date().toISOString()
        });
        
        if (pc.connectionState === 'connected') {
          console.log('[AudioCall] ✓ Peer connection fully established');
        } else if (pc.connectionState === 'failed') {
          console.error('[AudioCall] ✗ Peer connection failed');
          toast.error("Соединение потеряно");
        } else if (pc.connectionState === 'disconnected') {
          console.warn('[AudioCall] Peer connection disconnected');
        }
      };

      // Подписываемся на сообщения сигнализации ПЕРЕД созданием offer
      await subscribeToSignaling(pc);

      // Если мы инициатор звонка, создаем offer немедленно (Trickle ICE)
      if (isInitiator) {
        console.log('[AudioCall] Creating offer as initiator (Trickle ICE)');
        
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        console.log('[AudioCall] Offer created');
        
        await pc.setLocalDescription(offer);
        console.log('[AudioCall] Local description set, ICE gathering state:', pc.iceGatheringState);
        
        // Отправляем offer немедленно, не дожидаясь всех ICE-кандидатов
        await sendSignalingMessage({
          type: "offer",
          offer: offer,
        });
        console.log('[AudioCall] Offer sent immediately to peer');
        
        // Повторяем offer каждые 3 секунды пока не получим answer или не подключимся
        const offerRetryInterval = setInterval(async () => {
          if (pc.signalingState === 'have-local-offer' && callStatus === 'connecting') {
            console.log('[AudioCall] Retrying offer (no answer received yet)');
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
        console.log('[AudioCall] Sending ready signal as receiver');
        await sendSignalingMessage({ type: "ready" });
      }

    } catch (error) {
      console.error("Error initializing call:", error);
      isCallActiveRef.current = false;
      setCallStatus("ended");
      toast.error("Не удалось получить доступ к микрофону");
      // ВАЖНО: не закрываем окно автоматически (особенно на iOS Safari).
    }
  };

  // Специальная функция для отправки end-call с keepalive (работает в Safari)
  const sendEndCallSignal = () => {
    console.log('[AudioCall] Sending end-call with keepalive for Safari compatibility');
    
    try {
      const token = localStorage.getItem('sb-gfbssmplzvfubdidprom-auth-token');
      let accessToken = '';
      if (token) {
        try {
          const parsed = JSON.parse(token);
          accessToken = parsed.access_token || '';
        } catch (e) {
          console.error('[AudioCall] Failed to parse auth token:', e);
        }
      }

      if (!accessToken) {
        console.error('[AudioCall] No access token for end-call signal');
        return;
      }

      const body = JSON.stringify({
        to: otherUserId,
        message: { type: 'end-call' },
        chatId,
        callType: 'audio'
      });

      // Используем fetch с keepalive: true - это гарантирует доставку в Safari
      // даже если страница закрывается или компонент размонтируется
      fetch('https://gfbssmplzvfubdidprom.supabase.co/functions/v1/relay-signaling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYnNzbXBsenZmdWJkaWRwcm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzI4MTAsImV4cCI6MjA3ODYwODgxMH0.abI9fBl_dnHTKhHLPxh1kpDBU1ES_JT_dhv-502hHZo'
        },
        body,
        keepalive: true // Критично для Safari - запрос завершится даже при закрытии страницы
      }).then(res => {
        console.log('[AudioCall] End-call signal sent, status:', res.status);
      }).catch(err => {
        console.error('[AudioCall] End-call signal error:', err);
      });
    } catch (error) {
      console.error('[AudioCall] Error sending end-call signal:', error);
    }
  };

  const sendSignalingMessage = async (message: any) => {
    try {
      console.log('[AudioCall] Sending signaling message:', {
        type: message.type,
        to: otherUserId,
        chatId
      });
      
      // Get auth session for secure relay
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error("[AudioCall] No active session for signaling");
        return;
      }

      // Send through secure edge function relay
      const { data, error } = await supabase.functions.invoke('relay-signaling', {
        body: {
          to: otherUserId,
          message,
          chatId,
          callType: 'audio'
        }
      });

      if (error) {
        console.error("[AudioCall] Error sending signaling message:", error);
        toast.error("Ошибка отправки сигнала");
      } else {
        console.log('[AudioCall] Signaling message sent successfully:', message.type);
      }
    } catch (error) {
      console.error("[AudioCall] Error in sendSignalingMessage:", error);
    }
  };

  const subscribeToSignaling = async (pc: RTCPeerConnection) => {
    return new Promise<void>((resolve, reject) => {
      console.log('[AudioCall] Subscribing to signaling channel:', `audio-call-${chatId}`);
      
      const channel = supabase
        .channel(`audio-call-${chatId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on("broadcast", { event: "signaling" }, async ({ payload }) => {
          console.log('[AudioCall] Received signaling message:', {
            type: payload.message?.type,
            from: payload.from,
            to: payload.to,
            currentUserId,
            otherUserId,
            timestamp: new Date().toISOString()
          });
          
          // Строгая фильтрация: сообщение должно быть ОТ другого пользователя И ДЛЯ нас
          if (payload.from === currentUserId) {
            console.log('[AudioCall] Ignoring our own message');
            return;
          }
          
          if (payload.to && payload.to !== currentUserId) {
            console.log('[AudioCall] Message is for someone else:', payload.to);
            return;
          }

          const { message, from } = payload;
          
          // Verify message is from expected peer
          if (from !== otherUserId) {
            console.warn('[AudioCall] Message from unexpected peer:', from, 'expected:', otherUserId);
            return;
          }

          try {
            if (message.type === "ready") {
              // Получатель готов, отправляем offer повторно
              console.log('[AudioCall] 📨 Receiver is ready, re-sending offer');
              if (isInitiator && pc.localDescription) {
                await sendSignalingMessage({
                  type: "offer",
                  offer: pc.localDescription,
                });
                console.log('[AudioCall] ✓ Offer re-sent to ready receiver');
              }
            } else if (message.type === "offer") {
              console.log('[AudioCall] 📨 Received offer from peer at', new Date().toISOString());
              
              // Проверяем состояние - если уже есть remote description, пропускаем
              if (pc.signalingState === 'stable' && pc.remoteDescription) {
                console.log('[AudioCall] ⚠ Already have remote description, ignoring duplicate offer');
                return;
              }
              
              await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
              console.log('[AudioCall] ✓ Remote description set (offer)');
              
              // Обрабатываем очередь ICE candidates после установки remote description
              await processQueuedIceCandidates(pc);
              
              const answer = await pc.createAnswer();
              console.log('[AudioCall] Answer created');
              await pc.setLocalDescription(answer);
              console.log('[AudioCall] ✓ Local description set (answer), ICE gathering:', pc.iceGatheringState);
              
              await sendSignalingMessage({
                type: "answer",
                answer: answer,
              });
              console.log('[AudioCall] ✓ Answer sent to peer at', new Date().toISOString());
            } else if (message.type === "answer") {
              console.log('[AudioCall] 📨 Received answer from peer at', new Date().toISOString());
              console.log('[AudioCall] Current signaling state:', pc.signalingState);
              
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                console.log('[AudioCall] ✓ Remote description set (answer)');
                
                // Обрабатываем очередь ICE candidates после установки remote description
                await processQueuedIceCandidates(pc);
              } else {
                console.warn('[AudioCall] ⚠ Cannot set answer - invalid signaling state:', pc.signalingState);
              }
            } else if (message.type === "ice-candidate" && message.candidate) {
              console.log('[AudioCall] Received ICE candidate');
              
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                  console.log('[AudioCall] ✓ ICE candidate added successfully');
                } catch (err) {
                  console.error("[AudioCall] ✗ Error adding ICE candidate:", err);
                }
              } else {
                console.warn('[AudioCall] ⚠ Queueing ICE candidate (no remote description)');
                iceCandidatesQueue.current.push(message.candidate);
              }
            } else if (message.type === "end-call") {
              console.log('[AudioCall] Received end-call signal from peer');
              toast.info("Звонок завершен собеседником");
              // Вызываем cleanup напрямую, без отправки end-call обратно
              cleanup();
              onClose();
            }
          } catch (error) {
            console.error("[AudioCall] ✗ Error processing signaling message:", error);
            toast.error("Ошибка обработки сигнала");
          }
        })
        .subscribe((status) => {
          console.log('[AudioCall] Channel subscription status:', status, {
            chatId,
            currentUserId,
            otherUserId,
            isInitiator,
            timestamp: new Date().toISOString()
          });
          if (status === "SUBSCRIBED") {
            console.log('[AudioCall] ✓ Successfully subscribed to signaling channel - ready to receive messages');
            channelRef.current = channel;
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error('[AudioCall] ✗ Subscription failed:', status);
            reject(new Error(`Channel subscription failed: ${status}`));
          }
        });
    });
  };

  const processQueuedIceCandidates = async (pc: RTCPeerConnection) => {
    if (isProcessingQueue.current || iceCandidatesQueue.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;
    console.log(`[AudioCall] Processing ${iceCandidatesQueue.current.length} queued ICE candidates`);

    const queue = [...iceCandidatesQueue.current];
    iceCandidatesQueue.current = [];

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[AudioCall] ✓ Queued ICE candidate added');
      } catch (err) {
        console.error('[AudioCall] ✗ Error adding queued ICE candidate:', err);
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
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            currentRoundTripTime = report.currentRoundTripTime || 0;
          }
        });

        const packetLoss = packetsReceived > 0 ? (packetsLost / packetsReceived) * 100 : 0;
        const ping = currentRoundTripTime * 1000;

        setConnectionQuality({
          ping: Math.round(ping),
          packetLoss: Math.round(packetLoss * 10) / 10,
          audioQuality: packetLoss < 2 ? 'good' : packetLoss < 5 ? 'fair' : 'poor'
        });

        console.log('[AudioCall] Connection quality:', {
          ping: Math.round(ping),
          packetLoss: Math.round(packetLoss * 10) / 10,
          packetsLost,
          packetsReceived
        });
      } catch (err) {
        console.error('[AudioCall] Error getting connection stats:', err);
      }
    }, 3000);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleEndCall = async () => {
    console.log('[AudioCall] handleEndCall called', {
      isInitiator,
      callStatus,
      chatId,
      currentUserId,
      otherUserId,
      ts: new Date().toISOString(),
      pc: peerConnectionRef.current?.iceConnectionState,
    });
    console.log('[AudioCall] handleEndCall stack:', new Error().stack);

    // Обновляем статус звонка
    if (isInitiator) {
      const finalStatus = callStatus === "connected" ? "completed" : "no-answer";
      updateCallStatus(currentUserId, otherUserId, callStartTime, finalStatus, callDuration);
      
      // Если звонок не был принят, отправляем уведомление о завершении на глобальный канал
      if (callStatus === "connecting") {
        try {
          const callEndChannel = supabase.channel(`global-call-notifications-${otherUserId}`);
          await callEndChannel.subscribe();
          await callEndChannel.send({
            type: "broadcast",
            event: "call-ended",
            payload: { chatId, callerId: currentUserId },
          });
          await supabase.removeChannel(callEndChannel);
          console.log('[AudioCall] Sent call-ended notification to recipient');
        } catch (err) {
          console.error('[AudioCall] Error sending call-ended notification:', err);
        }
      }
    }

    // Используем синхронную функцию с keepalive для Safari
    sendEndCallSignal();

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
    console.log('[AudioCall] Cleaning up call resources');

    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }
    
    // Отмечаем звонок как неактивный
    isCallActiveRef.current = false;

    // Stop local tracks using ref (more reliable than state)
    const streamToClean = localStreamRef.current || localStream;
    if (streamToClean) {
      streamToClean.getTracks().forEach((track) => {
        track.stop();
        console.log(`[AudioCall] Stopped ${track.kind} track, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });
      localStreamRef.current = null;
    }
    
    // Clear audio element srcObject
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    
    // Close peer connection using ref
    const pcToClose = peerConnectionRef.current || peerConnection;
    if (pcToClose) {
      pcToClose.close();
      console.log('[AudioCall] Peer connection closed');
      peerConnectionRef.current = null;
    }
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      console.log('[AudioCall] Signaling channel removed');
    }
    
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
    setPeerConnection(null);
    setCallStatus("ended");
    setCallDuration(0);
    console.log('[AudioCall] Cleanup complete');
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
        <audio 
          ref={audioRef} 
          autoPlay 
          playsInline
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md"
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
        <audio 
          ref={audioRef} 
          autoPlay 
          playsInline
          style={{ display: 'none' }}
        />
      </DialogContent>

      <InviteToGroupCallDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        currentUserId={currentUserId}
        roomId={chatId}
        callType="audio"
        onInvite={handleInviteToGroup}
      />
    </Dialog>
  );
};

export default AudioCall;
