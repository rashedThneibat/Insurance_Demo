import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImageOff,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ai,
  getModelForTask,
  getTextModel,
  getVisionModel,
  hasApiKey,
  modelSupportsVision,
} from "@/lib/ai";
import { useClaims } from "@/lib/claimsStore";
import { fetchImageAsBase64 } from "@/lib/imageUtils";
import {
  buildCombinedAnalysisPrompt,
  buildQAPrompt,
  parseJsonResponse,
} from "@/lib/prompts";
import type { AIAssessment, AIFraudAnalysis, Claim } from "@/lib/types";
import { AIAnalysisDialog } from "./AIAnalysisDialog";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AICopilotPanelHandle {
  activateQA: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CombinedRaw {
  assessment: Omit<AIAssessment, "generatedAt" | "model" | "photosAnalyzed" | "tokensUsed">;
  fraud: Omit<AIFraudAnalysis, "generatedAt" | "model" | "photosAnalyzed" | "tokensUsed">;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function buildVisionMessages(
  prompt: string,
  photoUrls: string[],
  model: string
): Promise<{ messages: ContentPart[] | string; imagesUsed: number }> {
  if (!modelSupportsVision(model) || photoUrls.length === 0) {
    return { messages: prompt, imagesUsed: 0 };
  }
  const base64 = (await Promise.all(photoUrls.map(fetchImageAsBase64))).filter(Boolean) as string[];
  return {
    messages: [
      { type: "text", text: prompt },
      ...base64.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ],
    imagesUsed: base64.length,
  };
}

function NoKeyWarning() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-1">
          <p className="font-semibold">AI is not reachable</p>
          <p>
            The server proxy could not authenticate with OpenRouter. Contact
            the administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

function ThinkingSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <Loader2 className="size-3.5 animate-spin" />
        <span>{label}</span>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
    </div>
  );
}

// ─── QA Chat (inline, simple) ──────────────────────────────────────────────

function QAPanel({
  claim,
  photoUrls,
  onError,
  inputRef,
}: {
  claim: Claim;
  photoUrls: string[];
  onError: (e: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;
      const trimmed = question.trim();
      setInput("");
      const userMsg: Message = { role: "user", content: trimmed };
      const history = [...messages, userMsg].slice(-10);
      setMessages(history);
      setIsLoading(true);
      setStreamText("");

      const wantVision = photoUrls.length > 0;
      const model = wantVision ? getVisionModel() : getTextModel();

      try {
        let apiMessages: { role: "user" | "assistant"; content: string | ContentPart[] }[];
        if (history.length === 1) {
          const built = await buildVisionMessages(
            buildQAPrompt(claim, trimmed, wantVision ? photoUrls.length : 0),
            wantVision ? photoUrls : [],
            model
          );
          apiMessages = [{ role: "user", content: built.messages }];
        } else {
          apiMessages = [
            { role: "user", content: buildQAPrompt(claim, history[0].content) },
            ...history.slice(1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          ];
        }

        let accumulated = "";
        const stream = await ai.chat.completions.create({
          model,
          messages: apiMessages as Parameters<typeof ai.chat.completions.create>[0]["messages"],
          stream: true,
        });
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            accumulated += delta;
            setStreamText(accumulated);
          }
        }
        setMessages((prev) => [...prev, { role: "assistant", content: accumulated }]);
        setStreamText("");
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    },
    [claim, messages, isLoading, onError, photoUrls]
  );

  return (
    <div className="space-y-3">
      {(messages.length > 0 || isLoading) && (
        <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 max-h-64 overflow-y-auto space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block text-xs leading-relaxed whitespace-pre-wrap rounded-lg px-2.5 py-1.5 max-w-[90%] text-left ${
                  m.role === "user"
                    ? "bg-slate-700 dark:bg-slate-600 text-white"
                    : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                }`}
              >
                {m.content}
              </span>
            </div>
          ))}
          {isLoading && streamText && (
            <div className="text-left">
              <span className="inline-block text-xs leading-relaxed whitespace-pre-wrap rounded-lg px-2.5 py-1.5 max-w-[90%] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                {streamText}
                <span className="inline-block w-1.5 h-3 bg-slate-400 ml-0.5 animate-pulse rounded-sm align-middle" />
              </span>
            </div>
          )}
          {isLoading && !streamText && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          data-qa-input
          placeholder="Ask about this claim…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(input)}
          className="text-xs h-8"
          disabled={isLoading}
        />
        <Button
          size="sm"
          className="h-8 px-3 text-xs shrink-0"
          disabled={!input.trim() || isLoading}
          onClick={() => handleSend(input)}
        >
          {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Send"}
        </Button>
      </div>
      {messages.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-slate-400 px-0"
          onClick={() => { setMessages([]); setStreamText(""); }}
        >
          Clear conversation
        </Button>
      )}
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────

export const AICopilotPanel = forwardRef<AICopilotPanelHandle, { claim: Claim; readOnly?: boolean }>(
function AICopilotPanel({ claim, readOnly = false }, ref) {
  const { saveAIAssessment, saveFraudAnalysis } = useClaims();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);

  const keyOk = hasApiKey();
  const visionModel = getVisionModel();
  const qaInputRef = useRef<HTMLInputElement | null>(null);
  const photoUrls = claim.documents.filter((d) => d.type === "photo" && d.url).map((d) => d.url!);
  const photoCount = photoUrls.length;

  useImperativeHandle(ref, () => ({
    activateQA: () => {
      setAskOpen(true);
      setTimeout(() => qaInputRef.current?.focus(), 60);
    },
  }));

  async function runAnalysis() {
    if (photoCount === 0) {
      setError("Upload at least one damage photo first — the AI needs photos to assess damage and verify the vehicle.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    const model = getModelForTask("vision");

    try {
      let messageContent: string | ContentPart[];
      let imagesUsed = 0;
      const prompt = buildCombinedAnalysisPrompt(claim, photoCount);

      if (modelSupportsVision(model)) {
        setImagesLoading(true);
        const built = await buildVisionMessages(prompt, photoUrls, model);
        setImagesLoading(false);
        messageContent = built.messages;
        imagesUsed = built.imagesUsed;
        if (imagesUsed === 0) {
          throw new Error(
            `Could not load any of the ${photoCount} attached photo${photoCount > 1 ? "s" : ""}. The image URLs may have expired — re-upload the photos and try again.`
          );
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
      const assessment: AIAssessment = {
        ...parsed.assessment,
        generatedAt: now,
        model,
        photosAnalyzed: imagesUsed,
        tokensUsed: totalTokens,
      };
      const fraud: AIFraudAnalysis = {
        ...parsed.fraud,
        generatedAt: now,
        model,
        photosAnalyzed: imagesUsed,
        tokensUsed: totalTokens,
      };
      saveAIAssessment(claim.id, assessment);
      saveFraudAnalysis(claim.id, fraud);
      setAnalysisDialogOpen(true);
      toast.success("AI analysis complete", {
        description: `Estimate $${assessment.estimatedTotalLow.toLocaleString()}–$${assessment.estimatedTotalHigh.toLocaleString()} · ${fraud.riskLevel} fraud risk`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error("AI analysis failed", { description: msg });
    } finally {
      setIsAnalyzing(false);
      setImagesLoading(false);
    }
  }

  function handleViewAnalysis() {
    setAnalysisDialogOpen(true);
  }

  if (readOnly) return null;

  const hasAnalysis = !!claim.aiAssessment;
  const visionOk = modelSupportsVision(visionModel);

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Sparkles className="size-4 text-amber-500" />
            AI Copilot
            {photoCount > 0 && (
              <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                visionOk ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" : "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                <Camera className="size-2.5" />
                {photoCount}
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {!keyOk && <NoKeyWarning />}

          {keyOk && photoCount > 0 && !visionOk && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 flex items-start gap-2">
              <ImageOff className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Photos won&apos;t be analyzed.</span>{" "}
                Switch your vision model in Settings.
              </p>
            </div>
          )}

          {/* Primary action: combined damage + fraud */}
          <Button
            variant="default"
            size="sm"
            className="w-full text-xs gap-1.5 justify-center bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!keyOk || isAnalyzing}
            onClick={runAnalysis}
          >
            {isAnalyzing ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            {hasAnalysis ? "Re-run AI Analysis" : "Run AI Analysis"}
            {photoCount > 0 && visionOk && (
              <span className="ml-1 bg-blue-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {photoCount} photo{photoCount > 1 ? "s" : ""}
              </span>
            )}
          </Button>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center -mt-1">
            Detects vehicle, estimates repair cost, and flags fraud signals
          </p>

          {hasAnalysis && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5 justify-center"
              onClick={handleViewAnalysis}
            >
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              View AI analysis
            </Button>
          )}

          {/* Secondary action: Ask */}
          <Button
            variant="outline"
            size="sm"
            className={`w-full text-xs gap-1.5 justify-center ${askOpen ? "border-slate-400 bg-slate-50 dark:bg-slate-800" : ""}`}
            disabled={!keyOk || isAnalyzing}
            onClick={() => setAskOpen((v) => !v)}
          >
            <MessageSquare className="size-3.5 text-green-600" />
            {askOpen ? "Hide Q&A" : "Ask a Question"}
          </Button>

          {isAnalyzing && (
            <ThinkingSkeleton
              label={imagesLoading ? `Preparing ${photoCount} photo${photoCount > 1 ? "s" : ""}…` : "Analyzing damage and fraud signals…"}
            />
          )}

          {askOpen && !isAnalyzing && (
            <QAPanel
              claim={claim}
              photoUrls={photoUrls}
              onError={(e) => setError(e)}
              inputRef={qaInputRef}
            />
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed break-all">{error}</p>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-100" onClick={() => setError(null)}>
                <RefreshCw className="size-3" />
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AIAnalysisDialog
        open={analysisDialogOpen}
        onClose={() => setAnalysisDialogOpen(false)}
        claim={claim}
      />
    </>
  );
});
