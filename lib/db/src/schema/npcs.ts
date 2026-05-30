import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignSessions } from "./campaign";

export const npcs = pgTable("npcs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => campaignSessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location").notNull().default("未知"),
  attitude: text("attitude").notNull().default("中立"),
  secrets: text("secrets").notNull().default(""),
  goals: text("goals").notNull().default(""),
  notes: text("notes").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("npcs_session_name_idx").on(t.sessionId, t.name),
]);

export const insertNpcSchema = createInsertSchema(npcs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNpc = z.infer<typeof insertNpcSchema>;
export type Npc = typeof npcs.$inferSelect;
