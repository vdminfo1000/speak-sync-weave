import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelCreated: (chatId: string) => void;
}

const CreateChannelDialog = ({
  open,
  onOpenChange,
  onChannelCreated,
}: CreateChannelDialogProps) => {
  const [channelName, setChannelName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!channelName.trim()) {
      toast.error("Введите название канала");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Необходима авторизация");
        return;
      }

      // Create channel
      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .insert({
          name: channelName,
          is_group: true,
          chat_type: "channel",
          is_public: true,
        })
        .select()
        .single();

      if (chatError) {
        console.error("Error creating channel:", chatError);
        toast.error("Ошибка при создании канала");
        return;
      }

      if (!chat) {
        toast.error("Канал не был создан");
        return;
      }

      // Add creator as owner
      const { error: ownerError } = await supabase
        .from("chat_members")
        .insert({ chat_id: chat.id, user_id: user.id, role: "owner" });

      if (ownerError) {
        console.error("Error adding owner:", ownerError);
        toast.error("Ошибка при добавлении владельца");
        return;
      }

      toast.success("Канал создан");
      onChannelCreated(chat.id);
      onOpenChange(false);
      setChannelName("");
      setDescription("");
    } catch (error: any) {
      console.error("Error creating channel:", error);
      toast.error(error?.message || "Ошибка при создании");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5" />
            Создать канал
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channelName">Название канала</Label>
            <Input
              id="channelName"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Мой канал"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чем ваш канал..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Создание..." : "Создать канал"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChannelDialog;