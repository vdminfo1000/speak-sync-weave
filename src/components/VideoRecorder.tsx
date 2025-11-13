import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Video, StopCircle, X, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface VideoRecorderProps {
  onRecordingComplete: (videoBlob: Blob) => void;
  onCancel: () => void;
}

const VideoRecorder = ({ onRecordingComplete, onCancel }: VideoRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stopStream();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Не удалось получить доступ к камере");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleSend = () => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob);
    }
  };

  const handleRetry = () => {
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordingTime(0);
    startRecording();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="relative bg-card rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted={isRecording}
            playsInline
            src={recordedUrl || undefined}
            className="w-full h-full object-cover"
          />
          
          {isRecording && (
            <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground px-3 py-1 rounded-full flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="font-mono">{formatTime(recordingTime)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          {!recordedBlob ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="h-12 w-12"
              >
                <X className="h-6 w-6" />
              </Button>
              
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  size="icon"
                  className="h-16 w-16 rounded-full"
                >
                  <Video className="h-8 w-8" />
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="icon"
                  className="h-16 w-16 rounded-full"
                >
                  <StopCircle className="h-8 w-8" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="h-12 w-12"
              >
                <X className="h-6 w-6" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleRetry}
                className="h-12 w-12"
              >
                <RotateCcw className="h-6 w-6" />
              </Button>
              
              <Button
                onClick={handleSend}
                size="icon"
                className="h-16 w-16 rounded-full"
              >
                <Play className="h-8 w-8" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoRecorder;
