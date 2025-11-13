import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CallHistoryEntry {
  caller_id: string;
  receiver_id: string;
  call_type: "video" | "audio" | "group-video" | "group-audio";
  status: "completed" | "missed" | "declined" | "no-answer";
  started_at: string;
  duration?: number;
  chat_id?: string;
}

export const useCallHistory = (currentUserId: string) => {
  const [missedCallsCount, setMissedCallsCount] = useState(0);

  useEffect(() => {
    loadMissedCallsCount();

    const channel = supabase
      .channel("call-history-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_history",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          loadMissedCallsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const loadMissedCallsCount = async () => {
    try {
      const { count, error } = await supabase
        .from("call_history")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", currentUserId)
        .in("status", ["missed", "no-answer"])
        .gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      setMissedCallsCount(count || 0);
    } catch (error) {
      console.error("Error loading missed calls count:", error);
    }
  };

  const recordCall = async (entry: CallHistoryEntry) => {
    try {
      const { error } = await supabase.from("call_history").insert({
        caller_id: entry.caller_id,
        receiver_id: entry.receiver_id,
        call_type: entry.call_type,
        status: entry.status,
        started_at: entry.started_at,
        duration: entry.duration || 0,
        chat_id: entry.chat_id,
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error recording call:", error);
    }
  };

  const updateCallStatus = async (
    callerId: string,
    receiverId: string,
    startedAt: string,
    status: "completed" | "missed" | "declined" | "no-answer",
    duration?: number
  ) => {
    try {
      const { error } = await supabase
        .from("call_history")
        .update({
          status,
          duration: duration || 0,
          ended_at: new Date().toISOString(),
        })
        .eq("caller_id", callerId)
        .eq("receiver_id", receiverId)
        .eq("started_at", startedAt);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating call status:", error);
    }
  };

  return {
    missedCallsCount,
    recordCall,
    updateCallStatus,
  };
};
