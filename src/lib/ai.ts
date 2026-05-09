import OpenAI from "openai";

// The OpenRouter key is NEVER shipped to the browser. Requests go through
// our serverless proxy at `/api/chat/completions`, which injects the key
// from a server-side env var (OPENROUTER_API_KEY).
const PROXY_BASE_URL =
  typeof window !== "undefined" ? `${window.location.origin}/api` : "/api";

// ─── Model catalog ──────────────────────────────────────────────────────────
// Costs are USD per 1M tokens. Approximate OpenRouter list prices (Q1 2026).
// Used only for an in-app cost estimate display.
export interface ModelInfo {
  value: string;
  label: string;
  supportsVision: boolean;
  inputPer1M: number;
  outputPer1M: number;
  blurb: string;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    value: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    supportsVision: true,
    inputPer1M: 0.3,
    outputPer1M: 2.5,
    blurb: "Cheap, fast vision. Best for high-volume image analysis.",
  },
  {
    value: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    supportsVision: true,
    inputPer1M: 3,
    outputPer1M: 15,
    blurb: "Premium reasoning + vision. Best balance for adjuster work.",
  },
  {
    value: "anthropic/claude-opus-4",
    label: "Claude Opus 4",
    supportsVision: true,
    inputPer1M: 15,
    outputPer1M: 75,
    blurb: "Top-tier reasoning. Use for high-value or contested claims.",
  },
  {
    value: "openai/gpt-4o",
    label: "GPT-4o",
    supportsVision: true,
    inputPer1M: 2.5,
    outputPer1M: 10,
    blurb: "Balanced general-purpose vision model.",
  },
];

export const DEFAULT_VISION_MODEL = "anthropic/claude-sonnet-4-5";
export const DEFAULT_TEXT_MODEL = "anthropic/claude-sonnet-4-5";

const VISION_KEY = "claimscopilot_model_vision";
const TEXT_KEY = "claimscopilot_model_text";
// Legacy single-model key (Phase 0–7) — migrated transparently
const LEGACY_KEY = "claimscopilot_model";

function readModel(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key);
    if (v && AVAILABLE_MODELS.some((m) => m.value === v)) return v;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && AVAILABLE_MODELS.some((m) => m.value === legacy)) return legacy;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function getVisionModel(): string {
  return readModel(VISION_KEY, DEFAULT_VISION_MODEL);
}

export function setVisionModel(model: string): void {
  try {
    localStorage.setItem(VISION_KEY, model);
  } catch {
    /* ignore */
  }
}

export function getTextModel(): string {
  return readModel(TEXT_KEY, DEFAULT_TEXT_MODEL);
}

export function setTextModel(model: string): void {
  try {
    localStorage.setItem(TEXT_KEY, model);
  } catch {
    /* ignore */
  }
}

/**
 * Pick the right model for a task.
 * - "vision" tasks: damage estimate, fraud, photo Q&A
 * - "text" tasks: emails, plain summaries / Q&A without photos
 */
export type TaskKind = "vision" | "text";

export function getModelForTask(task: TaskKind): string {
  return task === "vision" ? getVisionModel() : getTextModel();
}

export function modelInfo(value: string): ModelInfo | undefined {
  return AVAILABLE_MODELS.find((m) => m.value === value);
}

export function modelSupportsVision(value: string): boolean {
  return modelInfo(value)?.supportsVision ?? false;
}

export function estimateCostUsd(
  modelValue: string,
  inputTokens: number,
  outputTokens: number
): number {
  const m = modelInfo(modelValue);
  if (!m) return 0;
  return (
    (inputTokens / 1_000_000) * m.inputPer1M +
    (outputTokens / 1_000_000) * m.outputPer1M
  );
}

export function formatCostUsd(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

// ─── OpenRouter client (via secure proxy) ───────────────────────────────────

export const ai = new OpenAI({
  // The proxy injects the real key. This placeholder is never used.
  apiKey: "proxied",
  baseURL: PROXY_BASE_URL,
  dangerouslyAllowBrowser: true,
});

/** In the proxied architecture the browser cannot know whether the server
 *  has a key configured until it tries a call. We optimistically return true
 *  so the UI is enabled; surface real errors via toast on first call. */
export function hasApiKey(): boolean {
  return true;
}

// ─── Backwards-compat shims (used by older callers in the codebase) ─────────
// Treat the legacy single-model selection as the vision model.
export const DEFAULT_MODEL = DEFAULT_VISION_MODEL;
export function getCurrentModel(): string {
  return getVisionModel();
}
export function setCurrentModel(model: string): void {
  setVisionModel(model);
}
export function currentModelSupportsVision(): boolean {
  return modelSupportsVision(getVisionModel());
}
