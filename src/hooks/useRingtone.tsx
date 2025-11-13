import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedFileUrl, extractFilePathFromUrl } from "@/utils/fileStorage";

export const useRingtone = (currentUserId: string, contactId?: string) => {
  const [ringtoneUrl, setRingtoneUrl] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadRingtone();
  }, [currentUserId, contactId]);

  const loadRingtone = async () => {
    try {
      let query = supabase
        .from("user_ringtones")
        .select("ringtone_url")
        .eq("user_id", currentUserId);

      if (contactId) {
        query = query.eq("contact_id", contactId);
      } else {
        query = query.is("contact_id", null).eq("is_default", true);
      }

      const { data, error } = await query.single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data?.ringtone_url) {
        // Generate signed URL for private ringtones bucket
        const filePath = extractFilePathFromUrl(data.ringtone_url);
        if (filePath) {
          const signedUrl = await getSignedFileUrl('ringtones', filePath, 3600);
          setRingtoneUrl(signedUrl);
        } else {
          setRingtoneUrl(null);
        }
      } else {
        setRingtoneUrl(null);
      }
    } catch (error) {
      console.error("Error loading ringtone:", error);
      setRingtoneUrl(null);
    }
  };

  const playRingtone = () => {
    try {
      if (ringtoneUrl) {
        audioElementRef.current = new Audio(ringtoneUrl);
        audioElementRef.current.loop = true;
        audioElementRef.current.volume = 0.5;
        audioElementRef.current.play().catch((error) => {
          console.error("Error playing custom ringtone:", error);
          playDefaultRingtone();
        });
      } else {
        playDefaultRingtone();
      }
    } catch (error) {
      console.error("Error in playRingtone:", error);
      playDefaultRingtone();
    }
  };

  const playDefaultRingtone = () => {
    try {
      audioContextRef.current = new AudioContext();
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, audioContextRef.current.currentTime);

      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);

      const now = audioContextRef.current.currentTime;
      let time = now;

      for (let i = 0; i < 10; i++) {
        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.setValueAtTime(0.3, time + 1);
        gainNode.gain.setValueAtTime(0, time + 1);
        gainNode.gain.setValueAtTime(0, time + 2);
        time += 2;
      }

      oscillator.start(now);
      oscillator.stop(time);

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
    } catch (error) {
      console.error("Error playing default ringtone:", error);
    }
  };

  const stopRingtone = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }

    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      oscillatorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  return {
    playRingtone,
    stopRingtone,
  };
};
