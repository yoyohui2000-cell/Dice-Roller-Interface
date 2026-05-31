import { useEffect, useRef, useCallback } from "react";

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

function getWsUrl(sessionId: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/ws/session?sessionId=${sessionId}`;
}

export function useRealtimeSession({ sessionId, onEvent, onStatusChange }: UseRealtimeSessionOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);
  onEventRef.current = onEvent;
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!sessionId) return;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let stopped = false;

    const connect = () => {
      ws = new WebSocket(getWsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        onStatusChangeRef.current?.(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as RealtimeEvent;
          onEventRef.current(data);
        } catch {
        }
      };

      ws.onclose = () => {
        onStatusChangeRef.current?.(false);
        if (!stopped) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimeout);
      ws?.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  const broadcast = useCallback((event: RealtimeEvent) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }, []);

  return { broadcast };
}
