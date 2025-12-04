import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useMissedCallsCount = (currentUserId: string | null) => {
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);

  const loadMissedCalls = useCallback(async () => {
    if (!currentUserId) return;

    // Get last viewed timestamp from localStorage
    const storedLastViewed = localStorage.getItem(`missedCallsViewed_${currentUserId}`);
    setLastViewedAt(storedLastViewed);

    // Query missed calls after last viewed time
    let query = supabase
      .from("call_history")
      .select("id")
      .eq("receiver_id", currentUserId)
      .in("status", ["missed", "no-answer", "declined"]);

    if (storedLastViewed) {
      query = query.gt("created_at", storedLastViewed);
    }

    const { data, error } = await query;

    if (!error && data) {
      setMissedCallsCount(data.length);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadMissedCalls();

    if (!currentUserId) return;

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`missed-calls-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_history",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const status = payload.new.status;
          if (["missed", "no-answer", "declined"].includes(status)) {
            setMissedCallsCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadMissedCalls]);

  const resetMissedCallsCount = useCallback(() => {
    if (!currentUserId) return;
    
    const now = new Date().toISOString();
    localStorage.setItem(`missedCallsViewed_${currentUserId}`, now);
    setLastViewedAt(now);
    setMissedCallsCount(0);
  }, [currentUserId]);

  return { missedCallsCount, resetMissedCallsCount };
};
