import { logger } from "./logger";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function broadcastGameEvent(
  sessionId: number,
  event: Record<string, unknown>,
): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) {
    logger.warn("Missing Supabase env");
    return;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
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
      },
    );

    if (!response.ok) {
      const text = await response.text();

      logger.error(
        {
          status: response.status,
          text,
        },
        "Supabase broadcast failed",
      );
    } else {
      logger.info(
        { sessionId, type: event.type },
        "Broadcast sent",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Supabase broadcast exception");
  }
}
