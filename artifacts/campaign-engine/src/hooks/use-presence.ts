import { useState } from "react";

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

export function usePresence(_options: UsePresenceOptions) {
  const [onlineUsers] = useState<PresenceUser[]>([]);
  return { onlineUsers };
}
