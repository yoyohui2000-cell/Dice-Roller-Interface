import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import { registerRoom, unregisterRoom, broadcastToSessionExcept } from "./ws-broadcaster";

export function createSessionBroadcaster(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/session" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      ws.close(1008, "Missing sessionId");
      return;
    }

    registerRoom(sessionId, ws);

    ws.on("message", (raw) => {
      broadcastToSessionExcept(sessionId, raw.toString(), ws);
    });

    ws.on("close", () => {
      unregisterRoom(sessionId, ws);
    });
  });

  return wss;
}
