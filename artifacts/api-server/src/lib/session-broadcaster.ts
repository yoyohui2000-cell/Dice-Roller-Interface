import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";

const rooms = new Map<string, Set<WebSocket>>();

export function createSessionBroadcaster(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/session" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      ws.close(1008, "Missing sessionId");
      return;
    }

    if (!rooms.has(sessionId)) rooms.set(sessionId, new Set());
    rooms.get(sessionId)!.add(ws);

    ws.on("message", (raw) => {
      const peers = rooms.get(sessionId);
      if (!peers) return;
      for (const peer of peers) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(raw.toString());
        }
      }
    });

    ws.on("close", () => {
      rooms.get(sessionId)?.delete(ws);
      if (rooms.get(sessionId)?.size === 0) rooms.delete(sessionId);
    });
  });

  return wss;
}
