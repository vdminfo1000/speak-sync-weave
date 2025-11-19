import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { MoreVertical, Trash2, LogOut } from "lucide-react";
import { toast } from "sonner";

interface ChatActionsProps {
  chatId: string;
  isGroup: boolean;
  currentUserId: string;
  onChatDeleted?: () => void;
}

const ChatActions = ({ chatId, isGroup, currentUserId, onChatDeleted }: ChatActionsProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDeleteChat = async () => {
    try {
      setLoading(true);
      console.log('[ChatActions] Deleting chat:', chatId);

      // Удаляем все сообщения в чате
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("chat_id", chatId);

      if (messagesError) {
        console.error('[ChatActions] Error deleting messages:', messagesError);
        throw messagesError;
      }

      // Удаляем всех участников
      const { error: membersError } = await supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", chatId);

      if (membersError) {
        console.error('[ChatActions] Error deleting members:', membersError);
        throw membersError;
      }

      // Удаляем сам чат
      const { error: chatError } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId);

      if (chatError) {
        console.error('[ChatActions] Error deleting chat:', chatError);
        throw chatError;
      }

      console.log('[ChatActions] Chat deleted successfully');
      toast.success("Чат удален");
      setShowDeleteDialog(false);
      onChatDeleted?.();
    } catch (error: any) {
      console.error('[ChatActions] Error in handleDeleteChat:', error);
      toast.error("Ошибка при удалении чата");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      setLoading(true);
      console.log('[ChatActions] Leaving group:', chatId);

      // Удаляем текущего пользователя из участников группы
      const { error } = await supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", chatId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error('[ChatActions] Error leaving group:', error);
        throw error;
      }

      console.log('[ChatActions] Left group successfully');
      toast.success("Вы вышли из группы");
      setShowLeaveDialog(false);
      onChatDeleted?.();
    } catch (error: any) {
      console.error('[ChatActions] Error in handleLeaveGroup:', error);
      toast.error("Ошибка при выходе из группы");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isGroup ? (
            <DropdownMenuItem
              onClick={() => setShowLeaveDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Выйти из группы
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить чат
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Chat Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все сообщения в этом чате будут удалены навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Group Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выйти из группы?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы больше не будете получать сообщения из этой группы. Вы сможете вернуться только по приглашению.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Выход..." : "Выйти"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ChatActions;
