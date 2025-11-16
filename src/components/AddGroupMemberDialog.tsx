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
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AddGroupMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

const AddGroupMemberDialog = ({
  open,
  onOpenChange,
  chatId,
}: AddGroupMemberDialogProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadAvailableContacts();
      setSelectedContacts(new Set());
      setSearchQuery("");
    }
  }, [open, chatId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredContacts(
        contacts.filter((contact) => {
          const name = contact.full_name || contact.username;
          return name.toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadAvailableContacts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current group members
      const { data: currentMembers } = await supabase
        .from("chat_members")
        .select("user_id")
        .eq("chat_id", chatId);

      const currentMemberIds = currentMembers?.map(m => m.user_id) || [];

      // Get user's contacts (from all chats)
      const { data: chatMembers } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      if (!chatMembers) return;

      const chatIds = chatMembers.map((cm) => cm.chat_id);
      const { data: allMembers } = await supabase
        .from("chat_members")
        .select("user_id")
        .in("chat_id", chatIds)
        .neq("user_id", user.id);

      if (!allMembers) return;

      const uniqueUserIds = [...new Set(allMembers.map((m) => m.user_id))]
        .filter(id => !currentMemberIds.includes(id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", uniqueUserIds);

      if (profiles) {
        setContacts(profiles);
        setFilteredContacts(profiles);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSendInvites = async () => {
    if (selectedContacts.size === 0) {
      toast.error("Выберите хотя бы одного участника");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Send invites to selected contacts
      const invites = Array.from(selectedContacts).map(receiverId => ({
        chat_id: chatId,
        sender_id: user.id,
        receiver_id: receiverId,
        status: 'pending'
      }));

      const { error } = await supabase
        .from("group_join_requests")
        .insert(invites);

      if (error) throw error;

      toast.success(`Приглашения отправлены (${selectedContacts.size})`);
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending invites:", error);
      toast.error("Ошибка при отправке приглашений");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8">Добавить участников</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск контактов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет доступных контактов
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => toggleContactSelection(contact.id)}
                  >
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleContactSelection(contact.id)}
                    />
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={contact.avatar_url || undefined} />
                      <AvatarFallback>
                        {(contact.full_name || contact.username || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {contact.full_name || contact.username}
                      </p>
                      {contact.full_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          @{contact.username}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
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
              onClick={handleSendInvites}
              disabled={loading || selectedContacts.size === 0}
              className="flex-1"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Отправить ({selectedContacts.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddGroupMemberDialog;
