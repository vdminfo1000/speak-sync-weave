import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Crown, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import ChannelAdminSettings from "./ChannelAdminSettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChannelOwnerSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  onDeleted?: () => void;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  profile: {
    username: string;
    full_name: string | null;
  };
}

const ChannelOwnerSettings = ({
  open,
  onOpenChange,
  chatId,
  onDeleted,
}: ChannelOwnerSettingsProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>("");

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_members")
        .select(`
          id,
          user_id,
          role,
          profile:user_id (
            username,
            full_name
          )
        `)
        .eq("chat_id", chatId)
        .neq("role", "owner");

      if (error) throw error;
      setMembers(data as any || []);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Ошибка при загрузке участников");
    }
  };

  const handleDeleteChannel = async () => {
    setLoading(true);
    try {
      // Delete all chat members first
      const { error: membersError } = await supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", chatId);

      if (membersError) throw membersError;

      // Delete all messages
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("chat_id", chatId);

      if (messagesError) throw messagesError;

      // Delete the chat
      const { error: chatError } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId);

      if (chatError) throw chatError;

      toast.success("Канал удален");
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      console.error("Error deleting channel:", error);
      toast.error("Ошибка при удалении канала");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) {
      toast.error("Выберите нового владельца");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      // Update current owner to admin
      const { error: currentOwnerError } = await supabase
        .from("chat_members")
        .update({ role: "admin" })
        .eq("chat_id", chatId)
        .eq("user_id", user.id);

      if (currentOwnerError) throw currentOwnerError;

      // Update selected member to owner
      const { error: newOwnerError } = await supabase
        .from("chat_members")
        .update({ role: "owner" })
        .eq("id", selectedNewOwner);

      if (newOwnerError) throw newOwnerError;

      toast.success("Права владельца переданы");
      onOpenChange(false);
    } catch (error) {
      console.error("Error transferring ownership:", error);
      toast.error("Ошибка при передаче прав");
    } finally {
      setLoading(false);
      setShowTransferConfirm(false);
    }
  };

  const handleOpenAdminSettings = async () => {
    await loadMembers();
    setShowAdminSettings(true);
  };

  const handleOpenTransferDialog = async () => {
    await loadMembers();
    setShowTransferConfirm(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Crown className="w-5 h-5" />
              Управление владением
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleOpenAdminSettings}
            >
              <Shield className="w-4 h-4 mr-2" />
              Управление администраторами
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleOpenTransferDialog}
            >
              <Crown className="w-4 h-4 mr-2" />
              Передать права владельца
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить канал
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ChannelAdminSettings
        open={showAdminSettings}
        onOpenChange={setShowAdminSettings}
        chatId={chatId}
      />

      <AlertDialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="pr-8">Передать права владельца?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы передадите права владельца выбранному участнику. После этого вы станете администратором канала.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedNewOwner} onValueChange={setSelectedNewOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите нового владельца" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.profile?.full_name || member.profile?.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={loading || !selectedNewOwner}
            >
              Передать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="pr-8">Удалить канал?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все сообщения и участники будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChannel}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ChannelOwnerSettings;
