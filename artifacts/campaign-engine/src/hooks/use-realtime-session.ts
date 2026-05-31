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
  | { type: "gm_done"; turnState?: TurnState; combatState?: CombatState }
  | { type: "turn_change"; who: string; dice: string | null; purpose: string | null }
  | { type: "world_state_update" }
  | { type: "combat_update"; combatState: CombatState }
  | { type: "dice_roll"; playerId: number; characterName: string; diceType: string; result: number; purpose: string }
  | { type: "player_joined"; characterName: string; race: string; class: string }
  | { type: "player_hp_update"; playerId: number; characterName: string; hp: number; maxHp: number };

interface UseRealtimeSessionOptions {
  sessionId: number;
  onEvent: (event: RealtimeEvent) => void;
}

function getWsUrl(sessionId: number): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return `${proto}//${host}:8080/ws/session?sessionId=${sessionId}`;
}

export function useRealtimeSession({ sessionId, onEvent }: UseRealtimeSessionOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!sessionId) return;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(getWsUrl(sessionId));
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data) as RealtimeEvent;
          onEventRef.current(event);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
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
