# AI Campaign Engine — Multiplayer D&D AI GM

A multiplayer web-based D&D 5e tabletop RPG platform powered by an AI Game Master (Gemini). Players can create campaign sessions, build characters, roll dice, and receive real-time narrative responses from the AI GM.

## Run & Operate

- **Frontend**: `PORT=23792 BASE_PATH=/ pnpm --filter @workspace/campaign-engine run dev` (port 23792)
- **API Server**: `cd artifacts/api-server && node ./build.mjs && PORT=8080 node --enable-source-maps ./dist/index.mjs` (port 8080)
- `pnpm --filter @workspace/db run push` — push DB schema changes to Supabase (dev only)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DATABASE_URL` (Supabase PostgreSQL connection string), `GEMINI_API_KEY`

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui + Framer Motion + wouter
- API: Express 5 (ESM bundle via esbuild)
- DB: **Supabase** (PostgreSQL) + Drizzle ORM (`node-postgres`)
- AI: Google Gemini 2.5 Flash (streaming SSE)
- Validation: Zod, drizzle-zod, Orval (OpenAPI codegen)

## Where things live

- `artifacts/campaign-engine/src/pages/hub.tsx` — session lobby (list/create campaigns)
- `artifacts/campaign-engine/src/pages/session.tsx` — live game session UI
- `artifacts/api-server/src/routes/campaign/index.ts` — all campaign API routes
- `artifacts/api-server/src/lib/gm-prompt.ts` — AI GM system prompt + chat history builder
- `lib/db/src/schema/campaign.ts` — DB schema (sessions, players, dice_rolls, narrative_history)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)

## Architecture

```
Frontend (React/Vite :23792)
        ↓
API Server (Express :8080)
        ↓
AI GM Engine (Gemini 2.5 Flash — streaming SSE)
        ↓
Supabase PostgreSQL (long-term memory: sessions, players, narrative history)
```

## Architecture decisions

- Gemini responses stream via SSE (`text/event-stream`) so the GM narration appears word-by-word
- The API server is built with esbuild into a single ESM bundle; must be run from `artifacts/api-server/` directory (not via `pnpm --filter`) due to module resolution
- Supabase is connected via the standard PostgreSQL connection string — no Supabase SDK needed, Drizzle + `pg` handles it
- Narrative history is persisted per-session in `narrative_history` table so the GM always has context across reconnects
- `worldState` in `campaign_sessions` is the authoritative world description the GM uses for context

## User preferences

- Database: Supabase (PostgreSQL via connection string + Drizzle ORM)
- AI: Google Gemini 2.5 Flash

## Gotchas

- The API server build MUST be run from within `artifacts/api-server/` (e.g. `cd artifacts/api-server && node ./build.mjs`) — running it via `pnpm --filter` from the workspace root causes esbuild ESM resolution to fail
- The Vite frontend requires both `PORT` and `BASE_PATH` env vars at startup
