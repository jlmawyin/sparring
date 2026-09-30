# Sparring

Sparring helps sales and support teams rehearse difficult customer conversations by voice. A simulated customer raises objections; the application scores each finalized trainee turn, checks exact quotes, and computes a transparent, weighted rubric. The trainee ends with focused coaching and can practice again.

Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon). Try the [public demo](https://sparring.visitaremota.com/). The public frontend and voice API are live on Contabo. A recorded human practice on September 30 completed several conversational turns and showed **75/100 with 100% rubric coverage**. After earlier continuity failures, the customer prompt was simplified and a client retry that caused duplicate speech was removed. This recording demonstrates one completed session, not a guarantee for every call. Automated tests use a mocked AssemblyAI provider and are separate from the [recorded evidence](docs/VIDEO-CHECK.md).

## What is implemented

- Three fictional scenarios: late delivery, price comparison, and cancellation after an apparent duplicate charge.
- Browser microphone, PCM audio, WebSocket interaction with AssemblyAI's Voice Agent API, and user interruption handling.
- Deterministic local scoring after each finalized user turn (default), with optional AssemblyAI LLM Gateway forced function calling for entitled accounts. Voice Agent `score_rubric` and `log_objection` calls are also accepted; the server validates exact quotations and computes score math.
- A local Node adapter for development and a separate Node production adapter that serves `dist/` plus `/api` from one origin. Production voice minutes are reserved in a durable file ledger with a process-shared lock.

The system does not store audio. It stores the current transcript and evaluation in memory for the life of a session. The score is formative feedback: local rules can miss a good response phrased differently, and neither mode can certify performance or authenticate a browser-supplied transcript.

## Run locally

Use Node.js 24 and npm:

```powershell
npm ci
Copy-Item .env.example .env  # only if .env does not already exist
```

Put your own `ASSEMBLYAI_API_KEY` in the local `.env` and set `SPARRING_VOICE_ENABLED=true`. Never place the key in a `VITE_` variable or commit `.env`. Then:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173/`, choose a scenario, consent to voice processing, and grant microphone access. The local API binds only to `127.0.0.1:8787`; its in-memory daily quota is for development, not public deployment.

## Build, tests, and hosting

```powershell
npm run validate:spec
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit and browser tests use a mock provider. The production server bundle is `server-dist/production.mjs`; `app.js` is the cPanel-compatible startup file. [Production packaging and required hosting variables](server/README.md) explain the private quota path and server-side API key. The public FTP upload script deploys only the static `dist/` contents; it does not deploy the Node API.

## Specification and limitations

The [SDD](docs/SDD.md), [test plan](docs/TEST-PLAN.md), [scenario and rubric contracts](spec/), and [submission materials](submission-assets/) are in this repository. Human voice testing, hosting verification, and the final hackathon submission are tracked in [the current handoff](docs/HANDOFF.md). The project uses synthetic customer data and makes no real customer commitments.

Original project code is [MIT licensed](LICENSE).
