import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send } from "lucide-react";
import { toast } from "sonner";

interface Chat {
  id: string;
  name: string | null;
  chat_type: string;
  is_group: boolean;
  other_user?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  messageContent: string;
  onForward: (chatId: string) => void;
}

const ForwardMessageDialog = ({
  open,
  onOpenChange,
  messageId,
  messageContent,
  onForward,
}: ForwardMessageDialogProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadChats();
      setSelectedChats(new Set());
      setSearchQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredChats(
        chats.filter((chat) => {
          const name = chat.name || chat.other_user?.full_name || chat.other_user?.username || "";
          return name.toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    } else {
      setFilteredChats(chats);
    }
  }, [searchQuery, chats]);

  const loadChats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: chatMembers } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      if (!chatMembers) return;

      const chatIds = chatMembers.map((cm) => cm.chat_id);
      const { data: chatsData } = await supabase
        .from("chats")
        .select("id, name, chat_type, is_group")
        .in("id", chatIds);

      if (!chatsData) return;

      const chatsWithUsers = await Promise.all(
        chatsData.map(async (chat) => {
          if (!chat.is_group && chat.chat_type !== 'channel') {
            const { data: members } = await supabase
              .from("chat_members")
              .select("user_id")
              .eq("chat_id", chat.id)
              .neq("user_id", user.id)
              .single();

            if (members) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("username, full_name, avatar_url")
                .eq("id", members.user_id)
                .single();

              return { ...chat, other_user: profile };
            }
          }
          return chat;
        })
      );

      setChats(chatsWithUsers);
      setFilteredChats(chatsWithUsers);
    } catch (error) {
      console.error("Error loading chats:", error);
    }
  };

  const toggleChatSelection = (chatId: string) => {
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
  };

  const handleForward = async () => {
    if (selectedChats.size === 0) {
      toast.error("Выберите хотя бы один чат");
      return;
    }

    setLoading(true);
    try {
      for (const chatId of selectedChats) {
        await onForward(chatId);
      }
      toast.success(`Сообщение переслано в ${selectedChats.size} чат(ов)`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Ошибка при пересылке сообщения");
    } finally {
      setLoading(false);
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.is_group || chat.chat_type === 'channel') {
      return chat.name || "Группа";
    }
    return chat.other_user?.full_name || chat.other_user?.username || "Неизвестный";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Переслать сообщение</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск чатов..."
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {filteredChats.map((chat) => {
                const isSelected = selectedChats.has(chat.id);
                return (
                  <button
                    key={chat.id}
                    onClick={() => toggleChatSelection(chat.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={chat.other_user?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getChatName(chat).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{getChatName(chat)}</p>
                      {chat.chat_type === 'channel' && (
                        <p className="text-xs opacity-70">Канал</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              onClick={handleForward}
              disabled={selectedChats.size === 0 || loading}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Переслать ({selectedChats.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForwardMessageDialog;
