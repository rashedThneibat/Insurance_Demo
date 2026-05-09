// Vercel Edge Function — secure proxy to OpenRouter.
// The OpenRouter API key never leaves the server. The browser hits this
// endpoint with the same OpenAI-compatible payload it would send to OpenRouter
// directly, and we forward it after validation.
//
// Abuse protections:
//   - POST only
//   - Body size cap (8 MB — accommodates a few base64 photos)
//   - Model whitelist (must match the catalog in src/lib/ai.ts)
//   - In-memory per-IP rate limit (best-effort across cold starts)
//   - Stripped client headers; we set Authorization ourselves

export const config = { runtime: "edge" };

const ALLOWED_MODELS = new Set<string>([
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4",
  "openai/gpt-4o",
]);

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB
const RATE_LIMIT_PER_MIN = 20;

// Per-cold-start rate limit. Not perfect across regions, but a useful
// guardrail for a public demo. For production we'd swap this for KV/Redis.
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT_PER_MIN;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed");
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError(500, "Server misconfigured: OPENROUTER_API_KEY not set.");
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return jsonError(429, "Rate limit exceeded. Try again in a minute.");
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large.");
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!payload || typeof payload !== "object") {
    return jsonError(400, "Body must be a JSON object.");
  }
  const body = payload as Record<string, unknown>;

  if (typeof body.model !== "string" || !ALLOWED_MODELS.has(body.model)) {
    return jsonError(400, "Model not permitted on this proxy.");
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, "messages[] is required.");
  }

  // Forward to OpenRouter with our key. Stream the response back transparently.
  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/rashedThneibat/Insurance_Demo",
      "X-Title": "ClaimsCopilot",
    },
    body: JSON.stringify(body),
  });

  // Pass through status + body. For SSE streams, content-type is text/event-stream.
  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("cache-control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
