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
import { Badge } from "@/components/ui/badge";
import { Search, Radio, Users, Plus, Settings, Crown, ArrowLeft, UserMinus } from "lucide-react";
import { toast } from "sonner";
import CreateChannelDialog from "./CreateChannelDialog";
import ChatWindow from "./ChatWindow";
import ChannelSettings from "./ChannelSettings";
import ChannelAdminSettings from "./ChannelAdminSettings";
import { useIsMobile } from "@/hooks/use-mobile";

interface Channel {
  id: string;
  name: string;
  chat_type: string;
  created_at: string;
  description?: string;
  member_count?: number;
  user_role?: string;
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
  const [showMyChannels, setShowMyChannels] = useState(false);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isChannelSettingsOpen, setIsChannelSettingsOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [settingsChannelId, setSettingsChannelId] = useState<string>("");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) {
      loadCurrentUser();
      loadChannels();
    }
  }, [open, showMyChannels, showSubscriptions]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("chats")
        .select("id, name, chat_type, created_at, description")
        .eq("is_public", true)
        .eq("chat_type", "channel");

      // Filter by owner if showing "My Channels"
      if (showMyChannels) {
        const { data: myChannels } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", user.id)
          .eq("role", "owner");

        if (myChannels && myChannels.length > 0) {
          const myChannelIds = myChannels.map((cm) => cm.chat_id);
          query = query.in("id", myChannelIds);
        } else {
          setChannels([]);
          setFilteredChannels([]);
          setLoading(false);
          return;
        }
      }

      // Filter by subscriptions if showing "Subscriptions"
      if (showSubscriptions) {
        const { data: subscriptions } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", user.id)
          .neq("role", "owner");

        if (subscriptions && subscriptions.length > 0) {
          const subChannelIds = subscriptions.map((cm) => cm.chat_id);
          query = query.in("id", subChannelIds);
        } else {
          setChannels([]);
          setFilteredChannels([]);
          setLoading(false);
          return;
        }
      }

      const { data: channelsData, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Get member counts and user role for each channel
      const channelsWithCounts = await Promise.all(
        (channelsData || []).map(async (channel) => {
          const { count } = await supabase
            .from("chat_members")
            .select("*", { count: "exact", head: true })
            .eq("chat_id", channel.id);

          const { data: userMember } = await supabase
            .from("chat_members")
            .select("role")
            .eq("chat_id", channel.id)
            .eq("user_id", user.id)
            .maybeSingle();

          return {
            ...channel,
            member_count: count || 0,
            user_role: userMember?.role,
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
      loadChannels(); // Reload to update UI
      onChannelJoin(channelId);
    } catch (error) {
      console.error("Error joining channel:", error);
      toast.error("Ошибка при присоединении к каналу");
    }
  };

  const handleLeaveChannel = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", channelId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Вы отписались от канала");
      loadChannels();
      if (selectedChannelId === channelId) {
        setSelectedChannelId(null);
      }
    } catch (error) {
      console.error("Error leaving channel:", error);
      toast.error("Ошибка при отписке от канала");
    }
  };

  const handleChannelClick = (channelId: string) => {
    setSelectedChannelId(channelId);
  };

  const handleOpenSettings = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsChannelId(channelId);
    setIsChannelSettingsOpen(true);
  };

  const handleOpenAdminSettings = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsChannelId(channelId);
    setIsAdminSettingsOpen(true);
  };

  const handleFilterChange = (filter: "all" | "my" | "subscriptions") => {
    setShowMyChannels(filter === "my");
    setShowSubscriptions(filter === "subscriptions");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-full max-h-[90vh] p-0 sm:p-6">
          {isMobile && selectedChannelId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedChannelId(null)}
              className="absolute top-2 left-2 z-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          )}
          <DialogHeader className="px-4 sm:px-0">
            <DialogTitle className="flex items-center justify-between gap-2 flex-wrap pr-8">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5" />
                Каналы
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  value={showMyChannels ? "my" : showSubscriptions ? "subscriptions" : "all"}
                  onChange={(e) => handleFilterChange(e.target.value as "all" | "my" | "subscriptions")}
                >
                  <option value="all">Все каналы</option>
                  <option value="subscriptions">Подписки</option>
                  <option value="my">Мои каналы</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => setIsCreateChannelOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-4 sm:px-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск каналов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4 h-[600px]`}>
            <ScrollArea className={`h-full ${!isMobile && 'border-r pr-4'} ${isMobile && selectedChannelId ? 'hidden' : 'block'}`}>
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
                      onClick={() => handleChannelClick(channel.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedChannelId === channel.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
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
                        <div className="flex flex-col gap-1">
                          {channel.user_role === "owner" ? (
                            <>
                              <Badge variant="default" className="gap-1">
                                <Crown className="w-3 h-3" />
                                Владелец
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleOpenSettings(channel.id, e)}
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleOpenAdminSettings(channel.id, e)}
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                            </>
                           ) : channel.user_role === "admin" ? (
                            <>
                              <Badge variant="secondary" className="gap-1">
                                <Users className="w-3 h-3" />
                                Администратор
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleLeaveChannel(channel.id, e)}
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </>
                          ) : channel.user_role ? (
                            <div className="flex flex-col gap-1">
                              <Badge variant="secondary">Подписан</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleLeaveChannel(channel.id, e)}
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinChannel(channel.id);
                              }}
                            >
                              Подписаться
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className={`h-full ${isMobile && !selectedChannelId ? 'hidden' : 'block'}`}>
              {selectedChannelId ? (
                <ChatWindow
                  key={selectedChannelId}
                  chatId={selectedChannelId}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Выберите канал для просмотра
                </div>
              )}
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateChannelDialog
        open={isCreateChannelOpen}
        onOpenChange={setIsCreateChannelOpen}
        onChannelCreated={(chatId) => {
          loadChannels();
          setSelectedChannelId(chatId);
        }}
      />

      {settingsChannelId && (
        <>
          <ChannelSettings
            open={isChannelSettingsOpen}
            onOpenChange={setIsChannelSettingsOpen}
            chatId={settingsChannelId}
          />
          <ChannelAdminSettings
            open={isAdminSettingsOpen}
            onOpenChange={setIsAdminSettingsOpen}
            chatId={settingsChannelId}
          />
        </>
      )}
    </>
  );
};

export default PublicChannelsList;
