import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Play, Pause, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { getSignedFileUrl } from "@/utils/fileStorage";

interface RingtoneSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  contactId?: string;
  contactName?: string;
}

interface Ringtone {
  id: string;
  ringtone_url: string;
  ringtone_name: string;
  is_default: boolean;
  contact_id: string | null;
}

const RingtoneSettings = ({ isOpen, onClose, currentUserId, contactId, contactName }: RingtoneSettingsProps) => {
  const [ringtones, setRingtones] = useState<Ringtone[]>([]);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadRingtones();
    }
  }, [isOpen]);

  const loadRingtones = async () => {
    try {
      const { data, error } = await supabase
        .from("user_ringtones")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRingtones(data || []);
    } catch (error) {
      console.error("Error loading ringtones:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4"];
    if (!validTypes.includes(file.type)) {
      toast.error("Неподдерживаемый формат файла. Используйте MP3, WAV, OGG или M4A");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой. Максимальный размер 5 МБ");
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("ringtones")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Store file path instead of public URL for private bucket
      const { error: insertError } = await supabase
        .from("user_ringtones")
        .insert({
          user_id: currentUserId,
          contact_id: contactId || null,
          ringtone_url: fileName,
          ringtone_name: file.name,
          is_default: !contactId && ringtones.length === 0,
        });

      if (insertError) throw insertError;

      toast.success("Мелодия загружена");
      loadRingtones();
    } catch (error: any) {
      console.error("Error uploading ringtone:", error);
      toast.error("Ошибка загрузки мелодии");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePlay = async (ringtone: Ringtone) => {
    if (playingId === ringtone.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Generate signed URL for playback
    const filePath = ringtone.ringtone_url.includes('/') 
      ? ringtone.ringtone_url 
      : `${currentUserId}/${ringtone.ringtone_url}`;
    
    const signedUrl = await getSignedFileUrl('ringtones', filePath, 3600);
    
    if (!signedUrl) {
      toast.error("Не удалось загрузить мелодию");
      return;
    }

    audioRef.current = new Audio(signedUrl);
    audioRef.current.play();
    setPlayingId(ringtone.id);

    audioRef.current.onended = () => {
      setPlayingId(null);
    };
  };

  const handleSetDefault = async (ringtoneId: string) => {
    try {
      await supabase
        .from("user_ringtones")
        .update({ is_default: false })
        .eq("user_id", currentUserId)
        .is("contact_id", null);

      await supabase
        .from("user_ringtones")
        .update({ is_default: true })
        .eq("id", ringtoneId);

      toast.success("Мелодия установлена по умолчанию");
      loadRingtones();
    } catch (error) {
      console.error("Error setting default ringtone:", error);
      toast.error("Ошибка установки мелодии");
    }
  };

  const handleDelete = async (ringtone: Ringtone) => {
    try {
      // Extract just the filename from the stored path
      const filePath = ringtone.ringtone_url.includes('/') 
        ? ringtone.ringtone_url 
        : `${currentUserId}/${ringtone.ringtone_url}`;

      await supabase.storage
        .from("ringtones")
        .remove([filePath]);

      await supabase
        .from("user_ringtones")
        .delete()
        .eq("id", ringtone.id);

      toast.success("Мелодия удалена");
      loadRingtones();
    } catch (error) {
      console.error("Error deleting ringtone:", error);
      toast.error("Ошибка удаления мелодии");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contactName ? `Мелодия для ${contactName}` : "Настройки мелодий"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="ringtone-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-secondary/50 transition-colors">
                <Upload className="w-5 h-5" />
                <span>Загрузить мелодию звонка</span>
              </div>
            </Label>
            <input
              ref={fileInputRef}
              id="ringtone-upload"
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Поддерживаются MP3, WAV, OGG, M4A (макс. 5 МБ)
            </p>
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {ringtones.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Нет загруженных мелодий
                </p>
              ) : (
                ringtones.map((ringtone) => (
                  <div
                    key={ringtone.id}
                    className="flex items-center gap-2 p-3 border rounded-lg"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlay(ringtone)}
                      className="shrink-0"
                    >
                      {playingId === ringtone.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ringtone.ringtone_name}
                      </p>
                      {ringtone.is_default && !ringtone.contact_id && (
                        <p className="text-xs text-primary">По умолчанию</p>
                      )}
                    </div>

                    {!ringtone.contact_id && !ringtone.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(ringtone.id)}
                        title="Установить по умолчанию"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(ringtone)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RingtoneSettings;