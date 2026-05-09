import { AlertOctagon, AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AIFraudAnalysis, FraudFlagSeverity } from "@/lib/types";

const RISK_PILL: Record<AIFraudAnalysis["riskLevel"], string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  high: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  critical: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

const FLAG_ICON: Record<FraudFlagSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
};

const FLAG_COLOR: Record<FraudFlagSeverity, string> = {
  info: "text-slate-500",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

/**
 * Compact AI fraud analysis card. Risk pill + 1-line summary + collapsed flag list.
 */
export function FraudAnalysisCard({ analysis }: { analysis: AIFraudAnalysis }) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              AI fraud check
            </span>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RISK_PILL[analysis.riskLevel]}`}>
            {analysis.riskLevel} · {analysis.fraudScore}/100
          </span>
        </div>

        <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
          {analysis.summary}
        </p>

        {analysis.flags.length > 0 ? (
          <ul className="space-y-1">
            {analysis.flags.slice(0, 2).map((f, i) => {
              const Icon = FLAG_ICON[f.severity];
              return (
                <li key={i} className="flex items-start gap-1.5 text-[11px]">
                  <Icon className={`size-3 shrink-0 mt-0.5 ${FLAG_COLOR[f.severity]}`} />
                  <span className="text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">{f.title}.</span>{" "}
                    <span className="text-slate-500 dark:text-slate-400">{f.description}</span>
                  </span>
                </li>
              );
            })}
            {analysis.flags.length > 2 && (
              <li className="text-[10px] text-slate-400 dark:text-slate-500 pl-4">
                +{analysis.flags.length - 2} additional indicator{analysis.flags.length - 2 > 1 ? "s" : ""} suppressed for brevity.
              </li>
            )}
          </ul>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3" />
            <span>No fraud indicators detected.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
