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
}

export function useRealtimeSession({ sessionId, onEvent, onStatusChange }: UseRealtimeSessionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);
  onEventRef.current = onEvent;
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`session:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    // Broadcast: real-time game events (GM chunks, dice rolls, player actions, etc.)
    channel.on("broadcast", { event: "game_event" }, ({ payload }) => {
      onEventRef.current(payload as RealtimeEvent);
    });

    // Postgres Changes: narrative_history — new GM/player messages saved to DB
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "narrative_history",
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        onEventRef.current({ type: "world_state_update" });
      },
    );

    // Postgres Changes: players — HP updates, new players joining
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const p = payload.new as {
            character_name: string;
            race: string;
            class: string;
          };
          onEventRef.current({
            type: "player_joined",
            characterName: p.character_name,
            race: p.race,
            class: p.class,
          });
        } else if (payload.eventType === "UPDATE") {
          const p = payload.new as {
            id: number;
            character_name: string;
            hp: number;
            max_hp: number;
          };
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

    // Postgres Changes: campaign_sessions — world state and combat state updates
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "campaign_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
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

    channel.subscribe((status) => {
      onStatusChangeRef.current?.(status === "SUBSCRIBED");
    });
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
