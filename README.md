# ClaimsCopilot

> An AI-assisted workspace for auto-insurance claim adjusters — vision-based damage estimates, fraud signals, and a senior-approval workflow, all behind a single screen.

> **Demo project.** Mock data only — no real policyholder information. Provided as-is for evaluation and learning.

## What it does

- **Triage queue** — claims sorted by AI triage score, with status filters and a "sent back" badge for rejected claims.
- **Photos-first claim workspace** — structured FNOL, policy snapshot, documents, and audit timeline on one page.
- **One-call AI analysis** — a single multimodal call returns damage severity, line-item repair estimate, fraud signals, and a 0–100 triage score. Every field has a confidence chip and is editable in place.
- **Senior approval loop** — adjuster submits, senior reviews the same evidence, and approves or rejects with a structured form. Rejections persist as a banner and auto-clear on resubmit.
- **Reject & notify policyholder** — pre-filled denial email drafted from the AI's findings, fully editable before send.
- **Role switcher** — adjuster vs. senior approver with different capabilities.

## Stack

| Layer | Tech |
|---|---|
| Build | Vite + TypeScript |
| UI | React 19 + Tailwind CSS v4 |
| Components | shadcn/ui (Radix) |
| Routing | React Router |
| AI | OpenRouter (Gemini 2.5 Flash · Claude Sonnet 4.5 · GPT-4o) via OpenAI SDK |

## Quick start

```bash
git clone https://github.com/rashedThneibat/Insurance_Demo.git
cd Insurance_Demo
npm install
cp .env.local.example .env.local
# edit .env.local and set OPENROUTER_API_KEY=sk-or-v1-...
npm run dev
```

Then open <http://localhost:5173>. Get a key at <https://openrouter.ai/keys>.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with the OpenRouter proxy middleware |
| `npm run build` | Type-check + production bundle |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint over `src/` |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter key (starts with `sk-or-v1-`). Server-side only — never exposed to the browser. |

## Architecture

The browser talks to a same-origin `/api/chat/completions` endpoint. In dev that's a Vite middleware; in production it's a Vercel Edge function. Both attach the OpenRouter key server-side and enforce a model whitelist, body-size cap, and (in production) a per-IP rate limit. The browser bundle contains zero secrets.

## Deploy

Pre-configured for Vercel:

1. Import the repo at <https://vercel.com/new>. Vite is auto-detected via `vercel.json`.
2. Under **Project Settings → Environment Variables**, add `OPENROUTER_API_KEY` for Production and Preview.
3. Deploy. Subsequent pushes to `main` auto-deploy.

> Tip: cap the OpenRouter key with a low monthly limit on the OpenRouter dashboard as a safety net.

## Notes

- State lives in React Context and is reset on refresh — designed so demos replay cleanly from the seeded mocks.
- AI responses stream via SSE through the proxy.
- One of the seeded claims (a Subaru policy with Honda photos) is intentionally inconsistent so the fraud panel and pre-filled denial email have something to flag.

## License

[MIT](./LICENSE)
