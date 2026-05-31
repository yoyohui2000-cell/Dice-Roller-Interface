import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type PresenceUser = {
  characterName: string;
  playerId: number;
  onlineAt: number;
};

interface UsePresenceOptions {
  sessionId: number;
  characterName: string | undefined;
  playerId: number | undefined;
}

export function usePresence({ sessionId, characterName, playerId }: UsePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`presence:${sessionId}`, {
      config: { presence: { key: playerId !== undefined ? String(playerId) : "observer" } },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState<PresenceUser>();
      const seen = new Set<number>();
      const users: PresenceUser[] = [];
      for (const presences of Object.values(state)) {
        for (const p of presences as PresenceUser[]) {
          if (typeof p.playerId === "number" && !seen.has(p.playerId)) {
            seen.add(p.playerId);
            users.push(p);
          }
        }
      }
      setOnlineUsers(users.sort((a, b) => a.onlineAt - b.onlineAt));
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && characterName && playerId !== undefined) {
          await channel.track({ characterName, playerId, onlineAt: Date.now() });
        }
      });

    return () => {
      void channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, characterName, playerId]);

  return { onlineUsers };
}
