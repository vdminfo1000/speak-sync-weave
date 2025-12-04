import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Volume2, Bell, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import RingtoneSettings from "@/components/RingtoneSettings";

const Settings = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notificationVolume, setNotificationVolume] = useState(70);
  const [ringtoneVolume, setRingtoneVolume] = useState(80);
  const [messageVolume, setMessageVolume] = useState(60);
  const [isRingtoneSettingsOpen, setIsRingtoneSettingsOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(session.user.id);
      
      // Load saved volume settings from localStorage
      const savedNotificationVolume = localStorage.getItem("notificationVolume");
      const savedRingtoneVolume = localStorage.getItem("ringtoneVolume");
      const savedMessageVolume = localStorage.getItem("messageVolume");
      
      if (savedNotificationVolume) setNotificationVolume(parseInt(savedNotificationVolume));
      if (savedRingtoneVolume) setRingtoneVolume(parseInt(savedRingtoneVolume));
      if (savedMessageVolume) setMessageVolume(parseInt(savedMessageVolume));
    };
    
    checkAuth();
  }, [navigate]);

  const handleVolumeChange = (type: string, value: number[]) => {
    const volume = value[0];
    
    switch (type) {
      case "notification":
        setNotificationVolume(volume);
        localStorage.setItem("notificationVolume", volume.toString());
        break;
      case "ringtone":
        setRingtoneVolume(volume);
        localStorage.setItem("ringtoneVolume", volume.toString());
        break;
      case "message":
        setMessageVolume(volume);
        localStorage.setItem("messageVolume", volume.toString());
        break;
    }
    
    // Play test sound
    playTestSound(volume);
  };

  const playTestSound = (volume: number) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.value = volume / 100 * 0.3;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Настройки приложения</h1>
        </div>

        <div className="space-y-6">
          {/* Sound Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Настройки звука
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Громкость уведомлений
                  </Label>
                  <span className="text-sm text-muted-foreground">{notificationVolume}%</span>
                </div>
                <Slider
                  value={[notificationVolume]}
                  onValueChange={(value) => handleVolumeChange("notification", value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    Громкость рингтона
                  </Label>
                  <span className="text-sm text-muted-foreground">{ringtoneVolume}%</span>
                </div>
                <Slider
                  value={[ringtoneVolume]}
                  onValueChange={(value) => handleVolumeChange("ringtone", value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Громкость сообщений
                  </Label>
                  <span className="text-sm text-muted-foreground">{messageVolume}%</span>
                </div>
                <Slider
                  value={[messageVolume]}
                  onValueChange={(value) => handleVolumeChange("message", value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ringtone Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Рингтоны
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setIsRingtoneSettingsOpen(true)}
              >
                Управление рингтонами
              </Button>
            </CardContent>
          </Card>
        </div>

        {currentUserId && (
          <RingtoneSettings
            isOpen={isRingtoneSettingsOpen}
            onClose={() => setIsRingtoneSettingsOpen(false)}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
};

export default Settings;
