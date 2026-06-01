import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type TurnState = { who: string; dice: string | null; purpose: string | null };

export type CombatEntry = {
  name: string;
  initiative: number;
  hp: number | null;
  maxHp: number | null;
  isEnemy: boolean;
  status: string | null;
};

export type CombatState = { round: number; order: CombatEntry[] } | null;

export type RealtimeEvent =
  | { type: "player_action"; playerId: number; characterName: string; action: string; rollInfo?: string }
  | { type: "gm_chunk"; chunk: string }
  | { type: "gm_done"; turnState?: TurnState; combatState?: CombatState; playerUpdates?: unknown[]; gmPlayerChanges?: unknown[] }
  | { type: "turn_change"; who: string; dice: string | null; purpose: string | null }
  | { type: "world_state_update" }
  | { type: "combat_update"; combatState: CombatState }
  | { type: "dice_roll"; playerId: number; characterName: string; diceType: string; result: number; purpose: string }
  | { type: "player_joined"; characterName: string; race: string; class: string }
  | { type: "player_hp_update"; playerId: number; characterName: string; hp: number; maxHp: number };

interface UseRealtimeSessionOptions {
  sessionId: number;
  onEvent: (event: RealtimeEvent) => void;
  onStatusChange?: (connected: boolean) => void;
  debug?: boolean;
}

export function useRealtimeSession({
  sessionId,
  onEvent,
  onStatusChange,
  debug = true,
}: UseRealtimeSessionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);

  onEventRef.current = onEvent;
  onStatusChangeRef.current = onStatusChange;

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) console.log(`[realtime:${sessionId}]`, ...args);
    },
    [debug, sessionId],
  );

  useEffect(() => {
    if (!sessionId) return;

    log("mount -> creating channel");

    const channel = supabase.channel(`session:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "game_event" }, ({ payload }) => {
      log("broadcast received", payload);
      onEventRef.current(payload as RealtimeEvent);
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "narrative_history",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        log("postgres INSERT narrative_history", payload);
        onEventRef.current({ type: "world_state_update" });
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        log("postgres players change", payload);

        if (payload.eventType === "INSERT") {
          const p = payload.new as { character_name: string; race: string; class: string };
          onEventRef.current({
            type: "player_joined",
            characterName: p.character_name,
            race: p.race,
            class: p.class,
          });
        } else if (payload.eventType === "UPDATE") {
          const p = payload.new as { id: number; character_name: string; hp: number; max_hp: number };
          onEventRef.current({
            type: "player_hp_update",
            playerId: p.id,
            characterName: p.character_name,
            hp: p.hp,
            maxHp: p.max_hp,
          });
        }
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "campaign_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        log("postgres campaign_sessions UPDATE", payload);

        const updated = payload.new as {
          world_state?: string;
          combat_state?: CombatState;
          phase?: string;
        };

        if (updated.combat_state !== undefined) {
          onEventRef.current({
            type: "combat_update",
            combatState: updated.combat_state ?? null,
          });
        }

        if (updated.world_state !== undefined) {
          onEventRef.current({ type: "world_state_update" });
        }
      },
    );

    channel.subscribe((status, err) => {
      log("subscribe status", status, err ?? null);
      onStatusChangeRef.current?.(status === "SUBSCRIBED");

      if (status === "SUBSCRIBED") {
        log("channel subscribed OK");
      } else if (status === "CHANNEL_ERROR") {
        log("channel error");
      } else if (status === "TIMED_OUT") {
        log("channel timed out");
      } else if (status === "CLOSED") {
        log("channel closed");
      }
    });

    channelRef.current = channel;

    return () => {
      log("cleanup -> remove channel");
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, log]);

  const broadcast = useCallback(
    (event: RealtimeEvent) => {
      const channel = channelRef.current;
      if (!channel) {
        log("broadcast skipped: no channel", event);
        return;
      }

      log("broadcast send", event);
      channel.send({
        type: "broadcast",
        event: "game_event",
        payload: event,
      });
    },
    [log],
  );

  return { broadcast };
}
