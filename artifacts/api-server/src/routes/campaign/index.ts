import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, campaignSessions, players, diceRolls, narrativeHistory } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  CreateCampaignSessionBody,
  GetCampaignSessionParams,
  UpdateCampaignSessionParams,
  UpdateCampaignSessionBody,
  ListSessionPlayersParams,
  AddSessionPlayerParams,
  AddSessionPlayerBody,
  UpdatePlayerParams,
  UpdatePlayerBody,
  SubmitDiceRollParams,
  SubmitDiceRollBody,
  SendGmMessageParams,
  SendGmMessageBody,
  GetSessionHistoryParams,
} from "@workspace/api-zod";
import { logger } from "../../lib/logger";
import { GM_SYSTEM_PROMPT, buildChatHistory } from "../../lib/gm-prompt";

const router: IRouter = Router();

router.get("/campaign/sessions", async (_req, res): Promise<void> => {
  const sessions = await db.select().from(campaignSessions).orderBy(campaignSessions.createdAt);
  res.json(sessions.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })));
});

router.post("/campaign/sessions", async (req, res): Promise<void> => {
  const parsed = CreateCampaignSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conv] = await db.insert(conversations).values({ title: `GM: ${parsed.data.name}` }).returning();
  const [session] = await db.insert(campaignSessions).values({
    name: parsed.data.name,
    worldState: parsed.data.worldDescription ?? "一片廣闊的奇幻大陸，充滿未知的危險與機遇。",
    phase: "exploration",
    conversationId: conv.id,
  }).returning();
  res.status(201).json({
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
});

router.get("/campaign/sessions/:id", async (req, res): Promise<void> => {
  const params = GetCampaignSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db.select().from(campaignSessions).where(eq(campaignSessions.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ ...session, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString() });
});

router.patch("/campaign/sessions/:id", async (req, res): Promise<void> => {
  const params = UpdateCampaignSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateCampaignSessionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [session] = await db.update(campaignSessions)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(campaignSessions.id, params.data.id))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ ...session, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString() });
});

router.get("/campaign/sessions/:id/players", async (req, res): Promise<void> => {
  const params = ListSessionPlayersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionPlayers = await db.select().from(players).where(eq(players.sessionId, params.data.id));
  res.json(sessionPlayers.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

router.post("/campaign/sessions/:id/players", async (req, res): Promise<void> => {
  const params = AddSessionPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AddSessionPlayerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [player] = await db.insert(players).values({ ...body.data, sessionId: params.data.id }).returning();
  res.status(201).json({ ...player, createdAt: player.createdAt.toISOString() });
});

router.patch("/campaign/players/:playerId", async (req, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdatePlayerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [player] = await db.update(players)
    .set(body.data)
    .where(eq(players.id, params.data.playerId))
    .returning();
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json({ ...player, createdAt: player.createdAt.toISOString() });
});

router.post("/campaign/sessions/:id/roll", async (req, res): Promise<void> => {
  const params = SubmitDiceRollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SubmitDiceRollBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [roll] = await db.insert(diceRolls).values({
    sessionId: params.data.id,
    playerId: body.data.playerId,
    diceType: body.data.diceType,
    result: body.data.result,
    purpose: body.data.purpose,
  }).returning();
  res.json({ ...roll, createdAt: roll.createdAt.toISOString() });
});

router.post("/campaign/sessions/:id/gm-message", async (req, res): Promise<void> => {
  const params = SendGmMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendGmMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [session] = await db.select().from(campaignSessions).where(eq(campaignSessions.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const sessionPlayers = await db.select().from(players).where(eq(players.sessionId, params.data.id));
  const [currentPlayer] = sessionPlayers.filter(p => p.id === body.data.playerId);

  const history = await db.select().from(narrativeHistory)
    .where(eq(narrativeHistory.sessionId, params.data.id))
    .orderBy(narrativeHistory.createdAt);

  let diceInfo: { diceType: string; result: number; purpose: string; playerName: string } | null = null;
  if (body.data.diceRollId) {
    const [roll] = await db.select().from(diceRolls).where(eq(diceRolls.id, body.data.diceRollId));
    if (roll && currentPlayer) {
      diceInfo = {
        diceType: roll.diceType,
        result: roll.result,
        purpose: roll.purpose,
        playerName: currentPlayer.characterName,
      };
    }
  }

  const playerLabel = currentPlayer
    ? `【${currentPlayer.characterName}（${currentPlayer.name}）】`
    : "【玩家】";
  const fullAction = `${playerLabel} ${body.data.action}`;

  await db.insert(narrativeHistory).values({
    sessionId: params.data.id,
    role: "user",
    content: fullAction,
    playerId: body.data.playerId,
  });

  const chatHistory = buildChatHistory(history, sessionPlayers, diceInfo, fullAction);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: chatHistory,
      config: {
        maxOutputTokens: 8192,
        systemInstruction: GM_SYSTEM_PROMPT,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(narrativeHistory).values({
      sessionId: params.data.id,
      role: "assistant",
      content: fullResponse,
      playerId: null,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    logger.error({ err }, "GM stream error");
    res.write(`data: ${JSON.stringify({ error: "GM error" })}\n\n`);
  }
  res.end();
});

router.get("/campaign/sessions/:id/history", async (req, res): Promise<void> => {
  const params = GetSessionHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const history = await db.select().from(narrativeHistory)
    .where(eq(narrativeHistory.sessionId, params.data.id))
    .orderBy(narrativeHistory.createdAt);
  res.json(history.map(h => ({
    ...h,
    createdAt: h.createdAt.toISOString(),
  })));
});

router.get("/campaign/sessions/:id/dice-rolls", async (req, res): Promise<void> => {
  const params = GetSessionHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rolls = await db
    .select({
      id: diceRolls.id,
      playerId: diceRolls.playerId,
      characterName: players.characterName,
      diceType: diceRolls.diceType,
      result: diceRolls.result,
      purpose: diceRolls.purpose,
      createdAt: diceRolls.createdAt,
    })
    .from(diceRolls)
    .leftJoin(players, eq(diceRolls.playerId, players.id))
    .where(eq(diceRolls.sessionId, params.data.id))
    .orderBy(diceRolls.createdAt);
  res.json(rolls.map(r => ({
    ...r,
    characterName: r.characterName ?? "未知玩家",
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
