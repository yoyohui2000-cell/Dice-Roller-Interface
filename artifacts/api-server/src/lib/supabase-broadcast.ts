import { broadcastToSession } from "./ws-broadcaster";

export function broadcastGameEvent(
  sessionId: number,
  event: Record<string, unknown>,
): void {
  broadcastToSession(String(sessionId), JSON.stringify(event));
}
