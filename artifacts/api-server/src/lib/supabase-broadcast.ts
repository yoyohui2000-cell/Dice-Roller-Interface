import { logger } from "./logger";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export async function broadcastGameEvent(
  sessionId: number,
  event: Record<string, unknown>,
): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) return;

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `realtime:session:${sessionId}`,
            event: "game_event",
            payload: event,
            private: false,
          },
        ],
      }),
    });
  } catch (err) {
    logger.warn({ err }, "Supabase broadcast failed (non-blocking)");
  }
}
