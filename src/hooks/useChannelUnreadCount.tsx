import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useChannelUnreadCount = (userId: string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const loadUnreadCount = async () => {
      try {
        // Get all channels user is subscribed to
        const { data: subscriptions } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", userId);

        if (!subscriptions || subscriptions.length === 0) {
          setUnreadCount(0);
          return;
        }

        const channelIds = subscriptions.map((s) => s.chat_id);

        // Get channels from the list
        const { data: channels } = await supabase
          .from("chats")
          .select("id")
          .in("id", channelIds)
          .eq("chat_type", "channel");

        if (!channels || channels.length === 0) {
          setUnreadCount(0);
          return;
        }

        const channelOnlyIds = channels.map((c) => c.id);

        // Get read markers for these channels
        const { data: readMarkers } = await supabase
          .from("channel_read_markers")
          .select("chat_id, last_read_at")
          .eq("user_id", userId)
          .in("chat_id", channelOnlyIds);

        const readMarkersMap = new Map(
          readMarkers?.map((rm) => [rm.chat_id, rm.last_read_at]) || []
        );

        // Count channels with new messages
        let count = 0;
        for (const channelId of channelOnlyIds) {
          const lastReadAt = readMarkersMap.get(channelId);

          const query = supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("chat_id", channelId);

          if (lastReadAt) {
            query.gt("created_at", lastReadAt);
          }

          const { count: newMessages } = await query;

          if (newMessages && newMessages > 0) {
            count++;
          }
        }

        setUnreadCount(count);
      } catch (error) {
        console.error("Error loading unread count:", error);
      }
    };

    loadUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel("channel-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const resetUnreadCount = async () => {
    if (!userId) return;

    try {
      // Get all channels user is subscribed to
      const { data: subscriptions } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", userId);

      if (!subscriptions) return;

      const channelIds = subscriptions.map((s) => s.chat_id);

      // Get channels from the list
      const { data: channels } = await supabase
        .from("chats")
        .select("id")
        .in("id", channelIds)
        .eq("chat_type", "channel");

      if (!channels) return;

      // Update read markers for all channels
      for (const channel of channels) {
        await supabase
          .from("channel_read_markers")
          .upsert(
            {
              user_id: userId,
              chat_id: channel.id,
              last_read_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,chat_id",
            }
          );
      }

      setUnreadCount(0);
    } catch (error) {
      console.error("Error resetting unread count:", error);
    }
  };

  return { unreadCount, resetUnreadCount };
};
