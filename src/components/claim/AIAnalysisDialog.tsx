import { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { AIAssessment, AIFraudAnalysis, Claim, FraudFlagSeverity } from "@/lib/types";

const RISK_PILL: Record<AIFraudAnalysis["riskLevel"], string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  high: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  critical: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

const FLAG_SEV: Record<FraudFlagSeverity, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300", Icon: Info },
  warning: { cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200", Icon: AlertTriangle },
  critical: { cls: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200", Icon: AlertOctagon },
};

const ACTION_LABEL: Record<string, string> = {
  approve: "Approve as filed",
  request_docs: "Request additional docs",
  independent_appraisal: "Independent appraisal",
  siu_referral: "Refer to SIU",
  proceed: "Proceed",
  request_clarification: "Request clarification",
};

export function AIAnalysisDialog({
  open,
  onClose,
  claim,
  assessmentOverride,
  fraudOverride,
  readOnlyBanner,
}: {
  open: boolean;
  onClose: () => void;
  claim: Claim;
  assessmentOverride?: AIAssessment | null;
  fraudOverride?: AIFraudAnalysis | null;
  readOnlyBanner?: string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const a = assessmentOverride ?? claim.aiAssessment;
  const f = fraudOverride ?? claim.aiFraudAnalysis;

  if (!a && !f) return null;

  const detected = a?.detectedVehicle;
  const policy = claim.vehicle;
  const vehicleMismatch = !!(detected && policy && (
    (detected.make && detected.make.toLowerCase() !== policy.make.toLowerCase()) ||
    (detected.model && detected.model.toLowerCase() !== policy.model.toLowerCase())
  ));

  const claimedAmount = claim.requestedAmount ?? claim.amountClaimed;
  const mid = a ? (a.estimatedTotalLow + a.estimatedTotalHigh) / 2 : 0;
  const overstated = a ? a.variancePct > 0 : false;
  const absPct = a ? Math.abs(a.variancePct) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            AI analysis · {claim.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {readOnlyBanner && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-3 py-2 flex items-start gap-2">
              <Info className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{readOnlyBanner}</p>
            </div>
          )}
          {/* Vehicle detection */}
          {detected && (
            <Section
              tone={vehicleMismatch ? "warn" : "neutral"}
              title="Vehicle detected from photos"
              right={vehicleMismatch ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-3" /> Does not match policy
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3" /> Matches policy
                </span>
              )}
            >
              <p className="text-xs text-slate-700 dark:text-slate-200">
                {[detected.year, detected.color, detected.make, detected.model].filter(Boolean).join(" ")}
                {detected.bodyStyle ? ` · ${detected.bodyStyle}` : ""}
              </p>
              {policy && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Policy: {[policy.year, policy.color, policy.make, policy.model].filter(Boolean).join(" ")}
                </p>
              )}
            </Section>
          )}

          {/* Damage estimate */}
          {a && (
            <Section title="Damage estimate" right={
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {a.confidence} confidence
              </span>
            }>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <Metric label="Severity" value={<span className="capitalize">{a.severity.replace(/_/g, " ")}</span>} />
                <Metric label="Triage" value={
                  <span className={
                    a.triageScore >= 80
                      ? "text-red-600 dark:text-red-400"
                      : a.triageScore >= 60
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-slate-700 dark:text-slate-200"
                  }>{a.triageScore}/100</span>
                } />
                <Metric label="AI estimate" value={
                  <span className="text-blue-700 dark:text-blue-300">
                    {formatCurrency(a.estimatedTotalLow)}–{formatCurrency(a.estimatedTotalHigh)}
                  </span>
                } />
                <Metric label={claim.requestedAmount !== undefined ? "Requested" : "Reserve"}
                  value={<span>{formatCurrency(claimedAmount)}</span>} />
              </div>

              {claimedAmount > 0 && (
                <div className={`mt-2 rounded-lg border px-2.5 py-1.5 flex items-center gap-2 text-xs ${
                  a.consistent
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                    : overstated
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  {a.consistent ? <CheckCircle2 className="size-3.5" /> : overstated ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  <span className="font-semibold">
                    {a.consistent
                      ? `Within ${absPct.toFixed(0)}% of AI estimate`
                      : overstated
                      ? `${claim.requestedAmount !== undefined ? "Claimant" : "Reserve"} overstated by ${absPct.toFixed(0)}%`
                      : `${claim.requestedAmount !== undefined ? "Claimant" : "Reserve"} understated by ${absPct.toFixed(0)}%`}
                  </span>
                  <span className="text-[10px] opacity-70 ml-auto tabular-nums">
                    mid {formatCurrency(mid)}
                  </span>
                </div>
              )}

              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                {a.recommendationReasoning}
              </p>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>Source: {a.pricingSource}</span>
                <span>Recommended: <span className="font-semibold">{ACTION_LABEL[a.recommendedAction] ?? a.recommendedAction}</span></span>
              </div>

              {/* Collapsible breakdown */}
              <button
                onClick={() => setShowBreakdown((v) => !v)}
                className="mt-2 w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <span>Parts &amp; labor breakdown</span>
                {showBreakdown ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
              {showBreakdown && (
                <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                      <tr>
                        <th className="text-left px-2 py-1 font-medium">Component</th>
                        <th className="text-right px-2 py-1 font-medium">Action</th>
                        <th className="text-right px-2 py-1 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {a.affectedComponents.map((c, i) => (
                        <tr key={i} className="text-slate-700 dark:text-slate-300">
                          <td className="px-2 py-1">{c.component}</td>
                          <td className="px-2 py-1 text-right capitalize text-slate-500">{c.repairAction}</td>
                          <td className="px-2 py-1 text-right text-slate-400 text-[10px]">{c.damage}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-[11px]">
                        <td className="px-2 py-1">Parts</td>
                        <td className="px-2 py-1 text-right text-slate-500">{a.partsList.length} item{a.partsList.length === 1 ? "" : "s"}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(a.partsTotal)}</td>
                      </tr>
                      <tr className="text-slate-700 dark:text-slate-300 text-[11px]">
                        <td className="px-2 py-1">Labor</td>
                        <td className="px-2 py-1 text-right text-slate-500">{a.laborHours} hrs × {formatCurrency(a.laborRate)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(a.laborTotal)}</td>
                      </tr>
                      {a.paintRefinish > 0 && (
                        <tr className="text-slate-700 dark:text-slate-300 text-[11px]">
                          <td className="px-2 py-1">Paint &amp; refinish</td>
                          <td></td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(a.paintRefinish)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {/* Fraud */}
          {f && (
            <Section title="Fraud check" right={
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RISK_PILL[f.riskLevel]}`}>
                {f.riskLevel} · {f.fraudScore}/100
              </span>
            }>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{f.summary}</p>
              {f.flags.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {f.flags.slice(0, 2).map((fl, i) => {
                    const sev = FLAG_SEV[fl.severity];
                    return (
                      <li key={i} className={`rounded-lg border px-2.5 py-1.5 ${sev.cls}`}>
                        <div className="flex items-start gap-2">
                          <sev.Icon className="size-3.5 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-semibold">{fl.title}</span>
                              <span className="text-[9px] font-mono uppercase opacity-60">
                                {fl.category.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-[10px] mt-0.5 leading-relaxed opacity-90">{fl.description}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {f.flags.length > 2 && (
                    <li className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">
                      +{f.flags.length - 2} additional indicator{f.flags.length - 2 > 1 ? "s" : ""} suppressed for brevity.
                    </li>
                  )}
                </ul>
              ) : (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 px-2.5 py-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-[11px] font-medium">No fraud indicators detected.</span>
                </div>
              )}
            </Section>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  right,
  tone = "neutral",
  children,
}: {
  title: string;
  right?: React.ReactNode;
  tone?: "neutral" | "warn";
  children: React.ReactNode;
}) {
  const cls = tone === "warn"
    ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50";
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${cls}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {right}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-xs font-bold mt-0.5">{value}</p>
    </div>
  );
}
