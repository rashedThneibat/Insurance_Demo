import { defineConfig, loadEnv, type Plugin, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4",
  "openai/gpt-4o",
]);
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function send(res: import("http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function openrouterDevProxy(env: Record<string, string>): Plugin {
  return {
    name: "openrouter-dev-proxy",
    configureServer(server) {
      const handler: Connect.NextHandleFunction = async (req, res, next) => {
        if (!req.url?.startsWith("/api/chat/completions")) return next();
        if (req.method !== "POST") return send(res, 405, { error: { message: "Method not allowed" } });

        const apiKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
        if (!apiKey) return send(res, 500, { error: { message: "OPENROUTER_API_KEY missing in .env.local (no VITE_ prefix)." } });

        const lenHeader = Number(req.headers["content-length"] || 0);
        if (lenHeader && lenHeader > MAX_BODY_BYTES) return send(res, 413, { error: { message: "Request body too large." } });

        try {
          const chunks: Buffer[] = [];
          let total = 0;
          for await (const c of req) {
            const buf = c as Buffer;
            total += buf.length;
            if (total > MAX_BODY_BYTES) return send(res, 413, { error: { message: "Request body too large." } });
            chunks.push(buf);
          }
          const bodyText = Buffer.concat(chunks).toString("utf8");
          let parsed: { model?: unknown; messages?: unknown };
          try { parsed = JSON.parse(bodyText); } catch { return send(res, 400, { error: { message: "Invalid JSON body." } }); }
          if (typeof parsed.model !== "string" || !ALLOWED_MODELS.has(parsed.model)) {
            return send(res, 400, { error: { message: "Model not permitted on this proxy." } });
          }
          if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) {
            return send(res, 400, { error: { message: "messages[] is required." } });
          }

          const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "http://localhost:5173",
              "X-Title": "ClaimsCopilot (dev)",
            },
            body: bodyText,
          });
          res.statusCode = upstream.status;
          const ct = upstream.headers.get("content-type");
          if (ct) res.setHeader("content-type", ct);
          res.setHeader("cache-control", "no-store");
          if (!upstream.body) { res.end(); return; }
          const reader = upstream.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } catch (e) {
          send(res, 502, { error: { message: `Upstream error: ${(e as Error).message}` } });
        }
      };
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), openrouterDevProxy(env)],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
