const rooms = new Map<string, Set<import("ws").WebSocket>>();

export function registerRoom(sessionId: string, ws: import("ws").WebSocket): void {
  if (!rooms.has(sessionId)) rooms.set(sessionId, new Set());
  rooms.get(sessionId)!.add(ws);
}

export function unregisterRoom(sessionId: string, ws: import("ws").WebSocket): void {
  rooms.get(sessionId)?.delete(ws);
  if (rooms.get(sessionId)?.size === 0) rooms.delete(sessionId);
}

export function broadcastToSession(sessionId: string, message: string): void {
  const peers = rooms.get(sessionId);
  if (!peers) return;
  for (const peer of peers) {
    if ((peer as import("ws").WebSocket).readyState === 1) {
      peer.send(message);
    }
  }
}

export function broadcastToSessionExcept(sessionId: string, message: string, exclude: import("ws").WebSocket): void {
  const peers = rooms.get(sessionId);
  if (!peers) return;
  for (const peer of peers) {
    if (peer !== exclude && (peer as import("ws").WebSocket).readyState === 1) {
      peer.send(message);
    }
  }
}
