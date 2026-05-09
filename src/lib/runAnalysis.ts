import {
  ai,
  getModelForTask,
  getVisionModel,
  modelSupportsVision,
} from "./ai";
import { fetchImageAsBase64 } from "./imageUtils";
import { buildCombinedAnalysisPrompt, parseJsonResponse } from "./prompts";
import type { AIAssessment, AIFraudAnalysis, Claim } from "./types";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface CombinedRaw {
  assessment: Omit<AIAssessment, "generatedAt" | "model" | "photosAnalyzed" | "tokensUsed">;
  fraud: Omit<AIFraudAnalysis, "generatedAt" | "model" | "photosAnalyzed" | "tokensUsed">;
}

export interface CombinedAnalysisResult {
  assessment: AIAssessment;
  fraud: AIFraudAnalysis;
}

/**
 * Runs the combined damage + fraud analysis. Pure — does NOT save to the
 * claims store. Caller decides whether to persist.
 */
export async function runCombinedAnalysis(
  claim: Claim,
  opts?: { onPhotosLoading?: (loading: boolean) => void }
): Promise<CombinedAnalysisResult> {
  const photoUrls = claim.documents
    .filter((d) => d.type === "photo" && d.url)
    .map((d) => d.url!);
  const photoCount = photoUrls.length;

  if (photoCount === 0) {
    throw new Error(
      "Upload at least one damage photo first — the AI needs photos to assess damage and verify the vehicle."
    );
  }

  const model = getModelForTask("vision") || getVisionModel();
  const prompt = buildCombinedAnalysisPrompt(claim, photoCount);

  let messageContent: string | ContentPart[];
  let imagesUsed = 0;

  if (modelSupportsVision(model)) {
    opts?.onPhotosLoading?.(true);
    try {
      const base64 = (await Promise.all(photoUrls.map(fetchImageAsBase64))).filter(
        Boolean
      ) as string[];
      imagesUsed = base64.length;
      if (imagesUsed === 0) {
        throw new Error(
          `Could not load any of the ${photoCount} attached photo${photoCount > 1 ? "s" : ""}. The image URLs may have expired — re-upload the photos and try again.`
        );
      }
      messageContent = [
        { type: "text", text: prompt },
        ...base64.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ];
    } finally {
      opts?.onPhotosLoading?.(false);
    }
  } else {
    messageContent = prompt;
  }

  const stream = await ai.chat.completions.create({
    model,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user" as const, content: messageContent as any }],
    stream: true,
    stream_options: { include_usage: true },
  });

  let accumulated = "";
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) accumulated += delta;
    const usage = (chunk as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
    if (usage) {
      inputTokens = usage.prompt_tokens ?? inputTokens;
      outputTokens = usage.completion_tokens ?? outputTokens;
    }
  }
  if (inputTokens === 0) inputTokens = Math.ceil((prompt.length + imagesUsed * 1500) / 4);
  if (outputTokens === 0) outputTokens = Math.ceil(accumulated.length / 4);
  const totalTokens = inputTokens + outputTokens;

  const parsed = parseJsonResponse<CombinedRaw>(accumulated);
  const now = new Date().toISOString();
  return {
    assessment: {
      ...parsed.assessment,
      generatedAt: now,
      model,
      photosAnalyzed: imagesUsed,
      tokensUsed: totalTokens,
    },
    fraud: {
      ...parsed.fraud,
      generatedAt: now,
      model,
      photosAnalyzed: imagesUsed,
      tokensUsed: totalTokens,
    },
  };
}
