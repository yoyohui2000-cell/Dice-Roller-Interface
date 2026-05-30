import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversations } from "./conversations";

export const campaignSessions = pgTable("campaign_sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  worldState: text("world_state").notNull().default("exploration"),
  phase: text("phase").notNull().default("exploration"),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => campaignSessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  characterName: text("character_name").notNull(),
  race: text("race").notNull(),
  class: text("class").notNull(),
  background: text("background").notNull(),
  hp: integer("hp").notNull().default(20),
  maxHp: integer("max_hp").notNull().default(20),
  ac: integer("ac").notNull().default(10),
  level: integer("level").notNull().default(1),
  stats: text("stats").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const diceRolls = pgTable("dice_rolls", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => campaignSessions.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  diceType: text("dice_type").notNull(),
  result: integer("result").notNull(),
  purpose: text("purpose").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const narrativeHistory = pgTable("narrative_history", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => campaignSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  playerId: integer("player_id").references(() => players.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCampaignSessionSchema = createInsertSchema(campaignSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaignSession = z.infer<typeof insertCampaignSessionSchema>;
export type CampaignSession = typeof campaignSessions.$inferSelect;

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

export const insertDiceRollSchema = createInsertSchema(diceRolls).omit({ id: true, createdAt: true });
export type InsertDiceRoll = z.infer<typeof insertDiceRollSchema>;
export type DiceRoll = typeof diceRolls.$inferSelect;

export const insertNarrativeHistorySchema = createInsertSchema(narrativeHistory).omit({ id: true, createdAt: true });
export type InsertNarrativeHistory = z.infer<typeof insertNarrativeHistorySchema>;
export type NarrativeHistory = typeof narrativeHistory.$inferSelect;
