import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  CreateGeminiConversationBody,
  GetGeminiConversationParams,
  DeleteGeminiConversationParams,
  ListGeminiMessagesParams,
  SendGeminiMessageParams,
  SendGeminiMessageBody,
} from "@workspace/api-zod";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/gemini/conversations", async (_req, res): Promise<void> => {
  const convs = await db.select().from(conversations).orderBy(conversations.createdAt);
  res.json(convs.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/gemini/conversations", async (req, res): Promise<void> => {
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conv] = await db.insert(conversations).values({ title: parsed.data.title }).returning();
  res.status(201).json({ ...conv, createdAt: conv.createdAt.toISOString() });
});

router.get("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = GetGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id));
  res.json({
    ...conv,
    createdAt: conv.createdAt.toISOString(),
    messages: msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});

router.delete("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db.delete(conversations).where(eq(conversations.id, params.data.id)).returning();
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListGeminiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, params.data.id));
  res.json(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

const flush = (res: any) => {
  if (typeof res.flush === "function") res.flush();
};

router.post("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendGeminiMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendGeminiMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({ conversationId: params.data.id, role: "user", content: body.data.content });

  const allMessages = await db.select().from(messages).where(eq(messages.conversationId, params.data.id));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
    flush(res);
  }, 5000);

  let fullResponse = "";
  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: allMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(` ${JSON.stringify({ content: text })}\n\n`);
        flush(res);
      }
    }

    await db.insert(messages).values({ conversationId: params.data.id, role: "assistant", content: fullResponse });
    res.write(` ${JSON.stringify({ done: true })}\n\n`);
    flush(res);
  } catch (err) {
    logger.error({ err }, "Gemini stream error");
    res.write(` ${JSON.stringify({ error: "AI error" })}\n\n`);
    flush(res);
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

export default router;
