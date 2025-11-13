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
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Radio, Search } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Contact {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated: (chatId: string) => void;
}

const CreateGroupDialog = ({
  open,
  onOpenChange,
  onGroupCreated,
}: CreateGroupDialogProps) => {
  const [groupName, setGroupName] = useState("");
  const [chatType, setChatType] = useState<"group" | "channel">("group");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadContacts();
      setGroupName("");
      setSelectedContacts(new Set());
      setSearchQuery("");
      setChatType("group");
    }
  }, [open]);

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

  const loadContacts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all chats where user is a member
      const { data: chatMembers } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      if (!chatMembers) return;

      // Get all other members from these chats
      const chatIds = chatMembers.map((cm) => cm.chat_id);
      const { data: allMembers } = await supabase
        .from("chat_members")
        .select("user_id")
        .in("chat_id", chatIds)
        .neq("user_id", user.id);

      if (!allMembers) return;

      const uniqueUserIds = [...new Set(allMembers.map((m) => m.user_id))];
      
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

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error("Введите название");
      return;
    }

    if (selectedContacts.size === 0) {
      toast.error("Выберите хотя бы одного участника");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Необходима авторизация");
        return;
      }

      // Create chat
      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .insert({
          name: groupName,
          is_group: true,
          chat_type: chatType,
        })
        .select()
        .single();

      if (chatError) {
        console.error("Error creating chat:", chatError);
        toast.error("Ошибка при создании чата");
        return;
      }

      if (!chat) {
        toast.error("Чат не был создан");
        return;
      }

      // Add creator as owner first
      const { error: ownerError } = await supabase
        .from("chat_members")
        .insert({ chat_id: chat.id, user_id: user.id, role: "owner" });

      if (ownerError) {
        console.error("Error adding owner:", ownerError);
        toast.error("Ошибка при добавлении владельца");
        return;
      }

      // Then add other members
      if (selectedContacts.size > 0) {
        const otherMembers = Array.from(selectedContacts).map((contactId) => ({
          chat_id: chat.id,
          user_id: contactId,
          role: "member" as const,
        }));

        const { error: membersError } = await supabase
          .from("chat_members")
          .insert(otherMembers);

        if (membersError) {
          console.error("Error adding members:", membersError);
          toast.error("Ошибка при добавлении участников");
          return;
        }
      }

      toast.success(
        chatType === "channel" ? "Канал создан" : "Группа создана"
      );
      onGroupCreated(chat.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error(error?.message || "Ошибка при создании");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Создать группу или канал</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={chatType} onValueChange={(v) => setChatType(v as "group" | "channel")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="group" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Группа
              </TabsTrigger>
              <TabsTrigger value="channel" className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Канал
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="groupName">
              {chatType === "channel" ? "Название канала" : "Название группы"}
            </Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={chatType === "channel" ? "Мой канал" : "Моя группа"}
            />
          </div>

          <div className="space-y-2">
            <Label>Участники</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск контактов..."
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="h-[250px] border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContacts.has(contact.id);
                return (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => toggleContactSelection(contact.id)}
                  >
                    <Checkbox checked={isSelected} />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={contact.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(contact.full_name || contact.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">
                        {contact.full_name || contact.username}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{contact.username}
                      </p>
                    </div>
                  </div>
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
              onClick={handleCreate}
              disabled={loading || !groupName.trim() || selectedContacts.size === 0}
              className="flex-1"
            >
              Создать ({selectedContacts.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
