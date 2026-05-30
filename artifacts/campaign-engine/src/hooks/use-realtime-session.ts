import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeEvent =
  | { type: "player_action"; playerId: number; characterName: string; action: string; rollInfo?: string }
  | { type: "gm_chunk"; chunk: string }
  | { type: "gm_done" }
  | { type: "world_state_update" }
  | { type: "dice_roll"; playerId: number; characterName: string; diceType: string; result: number; purpose: string }
  | { type: "player_joined"; characterName: string; race: string; class: string }
  | { type: "player_hp_update"; playerId: number; characterName: string; hp: number; maxHp: number };

interface UseRealtimeSessionOptions {
  sessionId: number;
  onEvent: (event: RealtimeEvent) => void;
}

export function useRealtimeSession({ sessionId, onEvent }: UseRealtimeSessionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`session:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "game_event" }, ({ payload }) => {
        onEventRef.current(payload as RealtimeEvent);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  const broadcast = useCallback((event: RealtimeEvent) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "game_event",
      payload: event,
    });
  }, []);

  return { broadcast };
}
