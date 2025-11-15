import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

interface ChannelAdminSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

const ChannelAdminSettings = ({
  open,
  onOpenChange,
  chatId,
}: ChannelAdminSettingsProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadCurrentUser();
      loadMembers();
    }
  }, [open, chatId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_members")
        .select(`
          id,
          user_id,
          role,
          profile:user_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq("chat_id", chatId)
        .order("role");

      if (error) throw error;

      setMembers(data as any || []);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Ошибка при загрузке участников");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("chat_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Роль обновлена");
      loadMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Ошибка при обновлении роли");
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === currentUserId) {
      toast.error("Нельзя удалить себя из канала");
      return;
    }

    try {
      const { error } = await supabase
        .from("chat_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Участник удален");
      loadMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Ошибка при удалении участника");
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      owner: { label: "Владелец", variant: "default" },
      admin: { label: "Администратор", variant: "secondary" },
      moderator: { label: "Модератор", variant: "outline" },
      member: { label: "Участник", variant: "outline" },
    };
    return variants[role] || variants.member;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Управление администраторами
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-muted-foreground">Загрузка...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет участников
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={member.profile?.avatar_url || ""} />
                    <AvatarFallback>
                      {member.profile?.username?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.profile?.full_name || member.profile?.username}
                    </p>
                    <Badge
                      variant={getRoleBadge(member.role).variant}
                      className="mt-1"
                    >
                      {getRoleBadge(member.role).label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role !== "owner" && (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, value)
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Администратор</SelectItem>
                            <SelectItem value="moderator">Модератор</SelectItem>
                            <SelectItem value="member">Участник</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            handleRemoveMember(member.id, member.user_id)
                          }
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelAdminSettings;
