import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Trash2, Shield, Crown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GroupManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatName: string;
  chatType: string;
  currentUserRole: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const GroupManagementDialog = ({
  open,
  onOpenChange,
  chatId,
  chatName: initialChatName,
  chatType,
  currentUserRole,
}: GroupManagementDialogProps) => {
  const [chatName, setChatName] = useState(initialChatName);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadMembers();
      setChatName(initialChatName);
    }
  }, [open, chatId]);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("chat_members")
      .select(`
        id,
        user_id,
        role,
        profiles:user_id (username, full_name, avatar_url)
      `)
      .eq("chat_id", chatId);

    if (error) {
      toast.error("Ошибка загрузки участников");
      return;
    }

    setMembers(data as any);
  };

  const handleUpdateChatName = async () => {
    if (!chatName.trim()) {
      toast.error("Введите название");
      return;
    }

    const { error } = await supabase
      .from("chats")
      .update({ name: chatName })
      .eq("id", chatId);

    if (error) {
      toast.error("Ошибка обновления названия");
      return;
    }

    toast.success("Название обновлено");
  };

  const handleSearchUsers = async () => {
    if (searchQuery.length < 2) return;

    setLoading(true);
    const { data, error } = await supabase.rpc("public_profile_search", {
      search_query: searchQuery,
    });

    if (error) {
      toast.error("Ошибка поиска");
      setLoading(false);
      return;
    }

    const memberIds = members.map(m => m.user_id);
    setSearchResults(data.filter((u: any) => !memberIds.includes(u.id)));
    setLoading(false);
  };

  const handleAddMember = async (userId: string) => {
    const { error } = await supabase
      .from("chat_members")
      .insert({ chat_id: chatId, user_id: userId, role: "member" });

    if (error) {
      toast.error("Ошибка добавления участника");
      return;
    }

    toast.success("Участник добавлен");
    setSearchQuery("");
    setSearchResults([]);
    loadMembers();
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase
      .from("chat_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error("Ошибка удаления участника");
      return;
    }

    toast.success("Участник удален");
    loadMembers();
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("chat_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast.error("Ошибка изменения роли");
      return;
    }

    toast.success("Роль изменена");
    loadMembers();
  };

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Управление {chatType === "channel" ? "каналом" : "группой"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isAdmin && (
            <div className="space-y-2">
              <Label>Название</Label>
              <div className="flex gap-2">
                <Input
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  placeholder="Название группы"
                />
                <Button onClick={handleUpdateChatName}>Сохранить</Button>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-2">
              <Label>Добавить участника</Label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск пользователей..."
                  onKeyPress={(e) => e.key === "Enter" && handleSearchUsers()}
                />
                <Button onClick={handleSearchUsers} disabled={loading}>
                  Найти
                </Button>
              </div>
              {searchResults.length > 0 && (
                <ScrollArea className="h-32 border rounded-md p-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.username}</p>
                          {user.full_name && (
                            <p className="text-xs text-muted-foreground">
                              {user.full_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddMember(user.id)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Участники ({members.length})</Label>
            <ScrollArea className="h-64 border rounded-md p-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 hover:bg-muted rounded"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {member.profiles.username[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member.profiles.username}
                      </p>
                      {member.profiles.full_name && (
                        <p className="text-xs text-muted-foreground">
                          {member.profiles.full_name}
                        </p>
                      )}
                    </div>
                    {member.role === "owner" && (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    )}
                    {member.role === "admin" && (
                      <Shield className="h-4 w-4 text-blue-500" />
                    )}
                  </div>

                  {isAdmin && member.role !== "owner" && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleChangeRole(member.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Участник</SelectItem>
                          <SelectItem value="admin">Админ</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupManagementDialog;
