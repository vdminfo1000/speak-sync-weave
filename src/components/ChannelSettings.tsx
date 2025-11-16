import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
import { toast } from "sonner";

interface ChannelSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

const ChannelSettings = ({
  open,
  onOpenChange,
  chatId,
}: ChannelSettingsProps) => {
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [allowFileUploads, setAllowFileUploads] = useState(true);
  const [allowMemberMessages, setAllowMemberMessages] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open, chatId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("allow_comments, allow_reactions, allow_file_uploads, allow_member_messages")
        .eq("id", chatId)
        .single();

      if (error) throw error;

      if (data) {
        setAllowComments(data.allow_comments ?? true);
        setAllowReactions(data.allow_reactions ?? true);
        setAllowFileUploads(data.allow_file_uploads ?? true);
        setAllowMemberMessages(data.allow_member_messages ?? true);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("chats")
        .update({
          allow_comments: allowComments,
          allow_reactions: allowReactions,
          allow_file_uploads: allowFileUploads,
          allow_member_messages: allowMemberMessages,
        })
        .eq("id", chatId);

      if (error) throw error;

      toast.success("Настройки сохранены");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Ошибка при сохранении настроек");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Настройки канала
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="comments">Комментарии</Label>
              <p className="text-xs text-muted-foreground">
                Разрешить участникам оставлять комментарии
              </p>
            </div>
            <Switch
              id="comments"
              checked={allowComments}
              onCheckedChange={setAllowComments}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reactions">Реакции</Label>
              <p className="text-xs text-muted-foreground">
                Разрешить ставить реакции на публикации
              </p>
            </div>
            <Switch
              id="reactions"
              checked={allowReactions}
              onCheckedChange={setAllowReactions}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="files">Отправка файлов</Label>
              <p className="text-xs text-muted-foreground">
                Разрешить загрузку файлов и медиа
              </p>
            </div>
            <Switch
              id="files"
              checked={allowFileUploads}
              onCheckedChange={setAllowFileUploads}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="member-messages">Сообщения участников</Label>
              <p className="text-xs text-muted-foreground">
                Разрешить подписчикам отправлять сообщения в канал
              </p>
            </div>
            <Switch
              id="member-messages"
              checked={allowMemberMessages}
              onCheckedChange={setAllowMemberMessages}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1"
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelSettings;
