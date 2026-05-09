import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Save, Sparkles, TrendingDown, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { AIAssessment, AIConfidence, RecommendedAction, VehicleInfo } from "@/lib/types";

const CONFIDENCE_PILL: Record<AIConfidence, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  low: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

const ACTION_LABEL: Record<RecommendedAction, string> = {
  approve: "Approve",
  request_docs: "Request docs",
  independent_appraisal: "Independent appraisal",
  siu_referral: "Refer to SIU",
};

/**
 * Compact AI damage assessment card.
 * Shows: severity, AI estimate range, variance vs claimed, recommended action,
 * vehicle-mismatch warning. Optionally allows the adjuster to override the AI
 * estimate with their own settlement amount via `onAdjust`.
 */
export function AIAssessmentCard({
  assessment,
  claimedAmount,
  policyVehicle,
  claimedLabel = "Claimed",
  adjustedAmount,
  onAdjust,
}: {
  assessment: AIAssessment;
  claimedAmount: number;
  policyVehicle?: VehicleInfo;
  claimedLabel?: string;
  /** Adjuster-set override of the AI midpoint. Display-only when undefined. */
  adjustedAmount?: number;
  /** When provided, renders an inline edit pencil that calls back with the new value
   *  (or null to clear the override and revert to AI midpoint). */
  onAdjust?: (newAmount: number | null) => void;
}) {
  const a = assessment;
  const detected = a.detectedVehicle;
  const vehicleMismatch = !!(detected && policyVehicle && (
    (detected.make && detected.make.toLowerCase() !== policyVehicle.make.toLowerCase()) ||
    (detected.model && detected.model.toLowerCase() !== policyVehicle.model.toLowerCase())
  ));
  const overstated = a.variancePct > 0;
  const absPct = Math.abs(a.variancePct);
  const VarianceIcon = a.consistent ? CheckCircle2 : overstated ? TrendingUp : TrendingDown;
  const varianceCls = a.consistent
    ? "text-emerald-700 dark:text-emerald-300"
    : overstated
    ? "text-red-700 dark:text-red-300"
    : "text-amber-700 dark:text-amber-300";

  const aiMidpoint = Math.round((a.estimatedTotalLow + a.estimatedTotalHigh) / 2);
  const effectiveAmount = adjustedAmount ?? aiMidpoint;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(effectiveAmount));
  useEffect(() => {
    setDraft(String(effectiveAmount));
  }, [effectiveAmount]);

  function commit() {
    const n = parseFloat(draft.replace(/,/g, ""));
    if (isNaN(n) || n < 0) {
      setDraft(String(effectiveAmount));
      setEditing(false);
      return;
    }
    onAdjust?.(n);
    setEditing(false);
  }
  function clearOverride() {
    onAdjust?.(null);
    setEditing(false);
  }

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              AI damage estimate
            </span>
          </div>
          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${CONFIDENCE_PILL[a.confidence]}`}>
            {a.confidence}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">AI estimate</p>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
              {formatCurrency(a.estimatedTotalLow)}–{formatCurrency(a.estimatedTotalHigh)}
            </p>
          </div>
          <div className="text-right min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{claimedLabel}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">{formatCurrency(claimedAmount)}</p>
          </div>
        </div>

        {/* Adjuster override row — editable when onAdjust provided, read-only when adjustedAmount is set (e.g. senior approval view) */}
        {(onAdjust || adjustedAmount !== undefined) && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Adjuster settlement {adjustedAmount === undefined ? "(default = AI midpoint)" : "(override)"}
              </p>
              {editing ? (
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">$</span>
                  <Input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") { setDraft(String(effectiveAmount)); setEditing(false); }
                    }}
                    className="h-6 px-1.5 text-sm font-bold tabular-nums w-28"
                  />
                </div>
              ) : (
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {formatCurrency(effectiveAmount)}
                </p>
              )}
            </div>
            {onAdjust && (
              <div className="flex items-center gap-1 shrink-0">
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={commit} title="Save">
                      <Save className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => { setDraft(String(effectiveAmount)); setEditing(false); }} title="Cancel">
                      <X className="size-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-blue-700 dark:text-blue-300" onClick={() => setEditing(true)} title="Edit settlement amount">
                      <Pencil className="size-3" />
                    </Button>
                    {adjustedAmount !== undefined && (
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-slate-500" onClick={clearOverride} title="Reset to AI midpoint">
                        <X className="size-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {claimedAmount > 0 && (
          <div className={`flex items-center gap-1.5 text-[11px] ${varianceCls}`}>
            <VarianceIcon className="size-3" />
            <span className="font-medium">
              {a.consistent
                ? `Within ${absPct.toFixed(0)}% of AI estimate — consistent`
                : overstated
                ? `${claimedLabel} overstated by ${absPct.toFixed(0)}%`
                : `${claimedLabel} understated by ${absPct.toFixed(0)}%`}
            </span>
          </div>
        )}

        {vehicleMismatch && (
          <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200">
            <AlertTriangle className="size-3 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Vehicle mismatch:</span>{" "}
              detected {[detected?.year, detected?.make, detected?.model].filter(Boolean).join(" ")} — policy {[policyVehicle?.year, policyVehicle?.make, policyVehicle?.model].filter(Boolean).join(" ")}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5 border-t border-slate-100 dark:border-slate-800">
          <span className="capitalize">Severity: <span className="font-semibold text-slate-700 dark:text-slate-200">{a.severity.replace(/_/g, " ")}</span></span>
          <span>Recommended: <span className="font-semibold text-slate-700 dark:text-slate-200">{ACTION_LABEL[a.recommendedAction]}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
