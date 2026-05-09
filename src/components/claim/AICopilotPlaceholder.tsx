import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AICopilotPlaceholder() {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Sparkles className="size-4 text-amber-500" />
          AI Copilot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500 leading-relaxed">
          Phase 4 will add: summarization, draft correspondence, risk analysis, and Q&amp;A about
          this claim.
        </p>
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Coming soon</p>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li className="flex items-start gap-1.5">
              <Sparkles className="size-3 shrink-0 mt-0.5 text-amber-400" />
              One-click claim summary
            </li>
            <li className="flex items-start gap-1.5">
              <Sparkles className="size-3 shrink-0 mt-0.5 text-amber-400" />
              Draft claimant correspondence
            </li>
            <li className="flex items-start gap-1.5">
              <Sparkles className="size-3 shrink-0 mt-0.5 text-amber-400" />
              Risk &amp; fraud signal analysis
            </li>
            <li className="flex items-start gap-1.5">
              <Sparkles className="size-3 shrink-0 mt-0.5 text-amber-400" />
              Ask questions about this claim
            </li>
          </ul>
        </div>
        <Button disabled size="sm" className="w-full text-xs">
          Coming soon
        </Button>
      </CardContent>
    </Card>
  );
}
