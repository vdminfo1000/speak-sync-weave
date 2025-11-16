import { useState, useEffect } from "react";
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
import { Crown, Trash2, Shield, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    avatar_url: string | null;
  };
}

type ViewMode = "main" | "transfer" | "admins";

const ChannelOwnerSettings = ({
  open,
  onOpenChange,
  chatId,
  onDeleted,
}: ChannelOwnerSettingsProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("main");

  useEffect(() => {
    if (open && (viewMode === "transfer" || viewMode === "admins")) {
      loadMembers();
    }
  }, [open, viewMode, chatId]);

  const loadMembers = async () => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from("chat_members")
        .select("id, user_id, role")
        .eq("chat_id", chatId)
        .neq("role", "owner");

      if (membersError) throw membersError;

      const userIds = membersData.map(m => m.user_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const membersWithProfiles = membersData.map(member => ({
        ...member,
        profile: profilesData.find(p => p.id === member.user_id) || {
          username: "Unknown",
          full_name: null,
          avatar_url: null
        }
      }));

      setMembers(membersWithProfiles);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Ошибка при загрузке участников");
    }
  };

  const handleDeleteChannel = async () => {
    setLoading(true);
    try {
      const { error: membersError } = await supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", chatId);

      if (membersError) throw membersError;

      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("chat_id", chatId);

      if (messagesError) throw messagesError;

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
    if (!selectedMember) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      const { error: currentOwnerError } = await supabase
        .from("chat_members")
        .update({ role: "member" })
        .eq("chat_id", chatId)
        .eq("user_id", user.id);

      if (currentOwnerError) throw currentOwnerError;

      const { error: newOwnerError } = await supabase
        .from("chat_members")
        .update({ role: "owner" })
        .eq("id", selectedMember.id);

      if (newOwnerError) throw newOwnerError;

      toast.success("Права владельца переданы");
      setViewMode("main");
      onOpenChange(false);
    } catch (error) {
      console.error("Error transferring ownership:", error);
      toast.error("Ошибка при передаче прав");
    } finally {
      setLoading(false);
      setShowTransferConfirm(false);
      setSelectedMember(null);
    }
  };

  const handleToggleAdmin = async () => {
    if (!selectedMember) return;

    setLoading(true);
    try {
      const newRole = selectedMember.role === "admin" ? "member" : "admin";
      
      const { error } = await supabase
        .from("chat_members")
        .update({ role: newRole })
        .eq("id", selectedMember.id);

      if (error) throw error;

      toast.success(
        newRole === "admin" 
          ? "Участник назначен администратором" 
          : "Администратор снят с должности"
      );
      
      await loadMembers();
    } catch (error) {
      console.error("Error toggling admin:", error);
      toast.error("Ошибка при изменении статуса");
    } finally {
      setLoading(false);
      setShowAdminConfirm(false);
      setSelectedMember(null);
    }
  };

  const handleMemberClick = (member: Member) => {
    setSelectedMember(member);
    if (viewMode === "transfer") {
      setShowTransferConfirm(true);
    } else if (viewMode === "admins") {
      setShowAdminConfirm(true);
    }
  };

  const handleClose = () => {
    setViewMode("main");
    onOpenChange(false);
  };

  const renderMainView = () => (
    <div className="space-y-3 py-4">
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setViewMode("transfer")}
      >
        <div className="flex items-center">
          <Crown className="w-4 h-4 mr-2" />
          Передать права владельца
        </div>
        <ChevronRight className="w-4 h-4" />
      </Button>

      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setViewMode("admins")}
      >
        <div className="flex items-center">
          <Shield className="w-4 h-4 mr-2" />
          Управление администраторами
        </div>
        <ChevronRight className="w-4 h-4" />
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
  );

  const renderMembersList = () => (
    <div className="py-4">
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Нет участников
            </p>
          ) : (
            members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleMemberClick(member)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {(member.profile?.full_name || member.profile?.username || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium">
                    {member.profile?.full_name || member.profile?.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.role === "admin" ? "Администратор" : "Участник"}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              {viewMode === "main" && (
                <>
                  <Crown className="w-5 h-5" />
                  Управление каналом
                </>
              )}
              {viewMode === "transfer" && (
                <>
                  <Crown className="w-5 h-5" />
                  Передать права владельца
                </>
              )}
              {viewMode === "admins" && (
                <>
                  <Shield className="w-5 h-5" />
                  Управление администраторами
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewMode === "main" && renderMainView()}
          {(viewMode === "transfer" || viewMode === "admins") && renderMembersList()}

          {viewMode !== "main" && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setViewMode("main")}>
                Назад
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="pr-8">Передать права владельца?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы передадите права владельца участнику{" "}
              <strong>{selectedMember?.profile?.full_name || selectedMember?.profile?.username}</strong>.
              После этого вы станете обычным участником канала и потеряете доступ к настройкам владельца.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedMember(null)}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={loading}
            >
              Передать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAdminConfirm} onOpenChange={setShowAdminConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="pr-8">
              {selectedMember?.role === "admin" 
                ? "Снять администратора?" 
                : "Назначить администратором?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.role === "admin" ? (
                <>
                  Вы снимете{" "}
                  <strong>{selectedMember?.profile?.full_name || selectedMember?.profile?.username}</strong>{" "}
                  с должности администратора. Участник станет обычным участником канала.
                </>
              ) : (
                <>
                  Вы назначите{" "}
                  <strong>{selectedMember?.profile?.full_name || selectedMember?.profile?.username}</strong>{" "}
                  администратором канала. Администратор получит доступ к настройкам и модерации канала.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedMember(null)}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleAdmin}
              disabled={loading}
            >
              {selectedMember?.role === "admin" ? "Снять" : "Назначить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="pr-8">Удалить канал?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Все сообщения и данные канала будут удалены безвозвратно.
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
