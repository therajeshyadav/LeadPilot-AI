# LEADPILOT AI

Production-oriented outbound sales voice-agent platform for an e-commerce website development agency. The system will place real provider-backed outbound calls, capture the conversation, qualify leads, schedule callbacks, and send WhatsApp follow-ups. No telephony or WhatsApp action is simulated as successful.

## Phase 5 status

The WhatsApp integration is complete:

- **Real Twilio WhatsApp Provider**: Send text and media messages via Twilio API
- **Mid-Call HOT Lead Detection**: AI automatically detects HOT leads during live calls and sends WhatsApp immediately
- **Contextual Follow-ups**: Post-call WhatsApp messages generated from actual conversation transcripts
- **Multi-Language Support**: WhatsApp messages in English, Hindi, and Telugu based on detected language
- **Idempotency Protection**: Prevents duplicate HOT lead alerts for the same conversation
- **Media Attachments**: Support for architecture images and resume documents
- **Comprehensive Testing**: 15+ tests covering HOT lead detection, duplicate prevention, and failure handling

Critical Assignment Requirement Implemented:
```
Live Vapi Call → Transcript → AI Qualification → HOT Detected → WhatsApp Sent IMMEDIATELY → Call Continues
```

## Phase 1-4 status

The monorepo foundation is complete:

- Express + TypeScript API with security middleware and comprehensive endpoints
- React/Vite/Tailwind dashboard shell
- PostgreSQL Prisma data model for leads, calls, messages, callbacks, WhatsApp, and qualification
- Vapi voice provider integration with outbound calling and webhook processing
- OpenAI integration for language detection, lead qualification, and conversation analysis
- Complete service/repository architecture with dependency injection
- All builds, typechecks, and tests passing

Provider integrations, operational dashboard, and production documentation are added in subsequent phases.

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
