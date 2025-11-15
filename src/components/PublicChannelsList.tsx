import { useEffect, useState } from "react";
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
import { Search, Radio, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import CreateChannelDialog from "./CreateChannelDialog";

interface Channel {
  id: string;
  name: string;
  chat_type: string;
  created_at: string;
  description?: string;
  member_count?: number;
}

interface PublicChannelsListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelJoin: (channelId: string) => void;
}

const PublicChannelsList = ({
  open,
  onOpenChange,
  onChannelJoin,
}: PublicChannelsListProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadChannels();
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredChannels(
        channels.filter((channel) =>
          channel.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredChannels(channels);
    }
  }, [searchQuery, channels]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const { data: channelsData, error } = await supabase
        .from("chats")
        .select("id, name, chat_type, created_at, description")
        .eq("is_public", true)
        .eq("chat_type", "channel")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get member counts for each channel
      const channelsWithCounts = await Promise.all(
        (channelsData || []).map(async (channel) => {
          const { count } = await supabase
            .from("chat_members")
            .select("*", { count: "exact", head: true })
            .eq("chat_id", channel.id);

          return {
            ...channel,
            member_count: count || 0,
          };
        })
      );

      setChannels(channelsWithCounts);
      setFilteredChannels(channelsWithCounts);
    } catch (error) {
      console.error("Error loading channels:", error);
      toast.error("Ошибка при загрузке каналов");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("chat_members")
        .select("id")
        .eq("chat_id", channelId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingMember) {
        toast.info("Вы уже являетесь участником этого канала");
        onChannelJoin(channelId);
        onOpenChange(false);
        return;
      }

      // Join channel
      const { error } = await supabase
        .from("chat_members")
        .insert({
          chat_id: channelId,
          user_id: user.id,
          role: "member",
        });

      if (error) throw error;

      toast.success("Вы присоединились к каналу");
      onChannelJoin(channelId);
      onOpenChange(false);
    } catch (error) {
      console.error("Error joining channel:", error);
      toast.error("Ошибка при присоединении к каналу");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5" />
                Публичные каналы
              </div>
              <Button
                size="sm"
                onClick={() => setIsCreateChannelOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать канал
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск каналов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <p className="text-muted-foreground">Загрузка...</p>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Каналы не найдены" : "Нет публичных каналов"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Radio className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{channel.name}</h3>
                        {channel.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {channel.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Users className="w-3 h-3" />
                          <span>{channel.member_count} участников</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleJoinChannel(channel.id)}
                      >
                        Присоединиться
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <CreateChannelDialog
        open={isCreateChannelOpen}
        onOpenChange={setIsCreateChannelOpen}
        onChannelCreated={(chatId) => {
          loadChannels();
          onChannelJoin(chatId);
        }}
      />
    </>
  );
};

export default PublicChannelsList;
