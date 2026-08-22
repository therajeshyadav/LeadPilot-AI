# LEADPILOT AI

Production-oriented outbound sales voice-agent platform for an e-commerce website development agency. The system will place real provider-backed outbound calls, capture the conversation, qualify leads, schedule callbacks, and send WhatsApp follow-ups. No telephony or WhatsApp action is simulated as successful.

## Phase 1 status

The monorepo foundation is complete:

- Express + TypeScript API with `GET /api/health`
- React/Vite/Tailwind dashboard shell
- PostgreSQL Prisma data model for leads, calls, messages, callbacks, WhatsApp, and qualification
- Zod runtime validation, Helmet, CORS, request limits, rate limiting, and structured request logging
- pnpm workspaces and test/typecheck/build scripts

Provider integrations, the operational dashboard, and production documentation are added in subsequent phases.

## Local setup

1. Copy `.env.example` to `.env` and fill in values appropriate to the features you enable.
2. Start PostgreSQL and set `DATABASE_URL`.
3. Install dependencies: `pnpm install`.
4. Generate the Prisma client: `pnpm prisma:generate`.
5. Validate the schema: `pnpm prisma:validate`.
6. Start API and frontend: `pnpm dev`.

The API health check is available at `http://localhost:4000/api/health` and the frontend runs at `http://localhost:5173`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | Check all workspace TypeScript projects |
| `pnpm build` | Build all workspace packages/apps |
| `pnpm test` | Run unit and API tests |
| `pnpm prisma:generate` | Generate Prisma Client |
| `pnpm prisma:validate` | Validate the Prisma schema |
| `pnpm prisma:migrate -- --name init` | Create/apply the initial PostgreSQL migration |

## Credential safety

Copy `.env.example`; never commit `.env`. This project deliberately ships without provider credentials, phone numbers, or claims of delivered calls/messages. A real outbound call requires correctly configured Vapi, Twilio, OpenAI, PostgreSQL, public webhooks, and all associated credentials.
