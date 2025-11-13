import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface InviteToGroupCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  chatId: string;
  callType: "audio" | "video";
  onInvite: (contactId: string) => void;
}

const InviteToGroupCallDialog = ({
  isOpen,
  onClose,
  currentUserId,
  chatId,
  callType,
  onInvite,
}: InviteToGroupCallDialogProps) => {
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen, currentUserId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = contacts.filter(
        (contact) =>
          contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      // Получаем все чаты пользователя
      const { data: userChats, error: chatsError } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", currentUserId);

      if (chatsError) throw chatsError;

      const chatIds = userChats?.map(c => c.chat_id) || [];

      // Получаем всех участников из всех чатов пользователя
      const { data: chatMembers, error } = await supabase
        .from("chat_members")
        .select(`
          user_id,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .in("chat_id", chatIds)
        .neq("user_id", currentUserId);

      if (error) throw error;

      // Получаем уникальных контактов
      const uniqueContacts = new Map<string, Profile>();
      chatMembers?.forEach((member: any) => {
        if (member.profiles && !uniqueContacts.has(member.profiles.id)) {
          uniqueContacts.set(member.profiles.id, member.profiles);
        }
      });

      setContacts(Array.from(uniqueContacts.values()));
      setFilteredContacts(Array.from(uniqueContacts.values()));
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Не удалось загрузить контакты");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (contactId: string) => {
    try {
      onInvite(contactId);
      toast.success("Приглашение отправлено");
      onClose();
    } catch (error) {
      console.error("Error inviting to group call:", error);
      toast.error("Не удалось отправить приглашение");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Пригласить в групповой {callType === "video" ? "видеозвонок" : "звонок"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск контактов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px] pr-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Загрузка контактов...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Контакты не найдены" : "Нет доступных контактов"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.avatar_url || undefined} />
                        <AvatarFallback>
                          {(contact.full_name || contact.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {contact.full_name || contact.username}
                        </p>
                        {contact.full_name && (
                          <p className="text-sm text-muted-foreground">
                            @{contact.username}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleInvite(contact.id)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteToGroupCallDialog;
