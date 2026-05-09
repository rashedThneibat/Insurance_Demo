import { useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AVAILABLE_MODELS,
  DEFAULT_VISION_MODEL,
  DEFAULT_TEXT_MODEL,
  getVisionModel,
  getTextModel,
  setVisionModel,
  setTextModel,
  modelInfo,
} from "@/lib/ai";

function formatPrice(perMillion: number): string {
  return `$${perMillion.toFixed(2)}`;
}

export default function SettingsPage() {
  const [visionModel, setVisionState] = useState(() => getVisionModel());
  const [textModel, setTextState] = useState(() => getTextModel());

  function handleVisionChange(value: string) {
    setVisionState(value);
    setVisionModel(value);
    const label = AVAILABLE_MODELS.find((m) => m.value === value)?.label ?? value;
    toast.success(`Vision model: ${label}`);
  }

  function handleTextChange(value: string) {
    setTextState(value);
    setTextModel(value);
    const label = AVAILABLE_MODELS.find((m) => m.value === value)?.label ?? value;
    toast.success(`Text model: ${label}`);
  }

  const visionInfo = modelInfo(visionModel);
  const textInfo = modelInfo(textModel);

  // Vision-capable subset for the vision selector
  const visionModels = AVAILABLE_MODELS.filter((m) => m.supportsVision);

  return (
    <div className="py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure AI features for ClaimsCopilot.
        </p>
      </div>

      {/* API Key card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">OpenRouter Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-3 py-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="text-sm font-medium">
              Routed through secure server proxy
            </span>
          </div>

          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>
              AI calls are forwarded through{" "}
              <code className="bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5 text-xs font-mono">
                /api/chat/completions
              </code>
              . The OpenRouter API key lives only in server-side environment
              variables and is never exposed to the browser bundle.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The proxy enforces a model whitelist, an 8&nbsp;MB body cap, and
              per-IP rate limiting. If a call fails, an error toast will surface
              the reason.
            </p>
          </div>

          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Manage your OpenRouter keys
            <ExternalLink className="size-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* Model selection card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Model Selection</CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pick separate models for vision (damage photos) and text (fraud analysis, summaries).
            Selection is saved to <code className="font-mono">localStorage</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vision model */}
          <div className="space-y-2">
            <Label htmlFor="vision-model" className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Camera className="size-4 text-blue-600 dark:text-blue-400" />
              Vision Model
              <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-normal ml-1">
                damage photos
              </span>
            </Label>
            <Select value={visionModel} onValueChange={handleVisionChange}>
              <SelectTrigger id="vision-model" className="w-full md:w-96">
                <SelectValue placeholder="Select vision model" />
              </SelectTrigger>
              <SelectContent>
                {visionModels.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-[11px] text-slate-400">{m.value}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {visionInfo && (
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pl-1">
                <p>{visionInfo.blurb}</p>
                <p className="font-mono text-[11px] text-slate-400">
                  in {formatPrice(visionInfo.inputPer1M)} · out{" "}
                  {formatPrice(visionInfo.outputPer1M)} per 1M tokens
                </p>
              </div>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 pl-1">
              Default: <code className="font-mono">{DEFAULT_VISION_MODEL}</code>
            </p>
          </div>

          {/* Text model */}
          <div className="space-y-2">
            <Label htmlFor="text-model" className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="size-4 text-purple-600 dark:text-purple-400" />
              Text Model
              <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-normal ml-1">
                fraud · summaries · Q&amp;A
              </span>
            </Label>
            <Select value={textModel} onValueChange={handleTextChange}>
              <SelectTrigger id="text-model" className="w-full md:w-96">
                <SelectValue placeholder="Select text model" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-[11px] text-slate-400">{m.value}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {textInfo && (
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pl-1">
                <p>{textInfo.blurb}</p>
                <p className="font-mono text-[11px] text-slate-400">
                  in {formatPrice(textInfo.inputPer1M)} · out{" "}
                  {formatPrice(textInfo.outputPer1M)} per 1M tokens
                </p>
              </div>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 pl-1">
              Default: <code className="font-mono">{DEFAULT_TEXT_MODEL}</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
