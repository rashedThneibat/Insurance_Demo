import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useClaims } from "@/lib/claimsStore";
import { roleDisplayName } from "@/lib/roleStore";
import { hasApiKey } from "@/lib/ai";
import { runCombinedAnalysis } from "@/lib/runAnalysis";
import {
  claimTypeColor,
  claimTypeLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import type { AIAssessment, AIFraudAnalysis, Claim, RejectionInfo } from "@/lib/types";
import { AIAnalysisDialog } from "./AIAnalysisDialog";
import { AIAssessmentCard } from "./AIAssessmentCard";
import { FraudAnalysisCard } from "./FraudAnalysisCard";

const REJECT_REASONS = [
  { value: "insufficient_docs", label: "Insufficient documentation" },
  { value: "estimate_disputed", label: "Estimate amount disputed" },
  { value: "fraud_concerns", label: "Fraud concerns \u2014 needs SIU referral" },
  { value: "vehicle_policy_mismatch", label: "Vehicle / policy mismatch" },
  { value: "other", label: "Other" },
] as const;
type RejectReason = (typeof REJECT_REASONS)[number]["value"];

const MISSING_DOC_OPTIONS = [
  "Police report",
  "Additional damage photos",
  "Vehicle registration",
  "Recorded statement",
  "Medical records",
  "Receipts",
] as const;

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

export function ApprovalPackageView({ claim }: { claim: Claim }) {
  const { updateClaim, addTimelineEvent } = useClaims();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState<RejectReason | "">("");
  const [missingDocs, setMissingDocs] = useState<string[]>([]);
  const [adjustedReserve, setAdjustedReserve] = useState<string>("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Read-only senior AI run (does NOT save to claim)
  const [aiRunning, setAiRunning] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [readonlyAssessment, setReadonlyAssessment] = useState<AIAssessment | null>(null);
  const [readonlyFraud, setReadonlyFraud] = useState<AIFraudAnalysis | null>(null);
  const keyOk = hasApiKey();

  const photos = claim.documents.filter((d) => d.type === "photo" && d.url);

  function resetRejectForm() {
    setRejectReason("");
    setMissingDocs([]);
    setAdjustedReserve("");
    setRejectNotes("");
  }

  function handleApprove() {
    setSubmitting(true);
    updateClaim(claim.id, { status: "closed", rejectionInfo: undefined });
    addTimelineEvent(claim.id, {
      id: `${claim.id}-app-${Date.now()}`,
      at: new Date().toISOString(),
      actor: roleDisplayName("senior_approver"),
      kind: "status_change",
      summary: `Senior approval granted. Claim authorized and closed.${approveNote ? " Notes: " + approveNote : ""}`,
    });
    toast.success("Claim approved and closed.");
    setSubmitting(false);
    setDecision(null);
    setApproveNote("");
    navigate("/");
  }

  function handleReject() {
    if (!rejectReason) {
      toast.error("Select a rejection reason.");
      return;
    }
    if (rejectReason === "other" && !rejectNotes.trim()) {
      toast.error("Add notes explaining the 'Other' reason.");
      return;
    }
    if (rejectReason === "insufficient_docs" && missingDocs.length === 0) {
      toast.error("Select at least one missing document.");
      return;
    }
    const reserveNum = adjustedReserve.trim() ? Number(adjustedReserve.replace(/[,$\s]/g, "")) : null;
    if (adjustedReserve.trim() && (!Number.isFinite(reserveNum) || (reserveNum as number) <= 0)) {
      toast.error("Adjusted reserve must be a positive number.");
      return;
    }

    setSubmitting(true);
    const reasonLabel = REJECT_REASONS.find((r) => r.value === rejectReason)?.label ?? rejectReason;
    const parts: string[] = [`Reason: ${reasonLabel}`];
    if (missingDocs.length > 0) parts.push(`Missing: ${missingDocs.join(", ")}`);
    if (reserveNum !== null) parts.push(`Suggested reserve: ${formatCurrency(reserveNum)}`);
    if (rejectNotes.trim()) parts.push(`Notes: ${rejectNotes.trim()}`);
    const summary = `Senior approval REJECTED — sent back to adjuster. ${parts.join(" · ")}`;

    const nowIso = new Date().toISOString();
    const rejectionInfo: RejectionInfo = {
      reason: rejectReason,
      reasonLabel,
      missingDocs,
      suggestedReserve: reserveNum ?? undefined,
      notes: rejectNotes.trim() || undefined,
      rejectedBy: roleDisplayName("senior_approver"),
      rejectedAt: nowIso,
    };

    const patch: Partial<Claim> = { status: "in_review", rejectionInfo };
    if (reserveNum !== null) {
      patch.adjusterAdjustedAmount = reserveNum;
      patch.adjusterAdjustedAt = nowIso;
      patch.adjusterAdjustmentNote = `Senior-suggested reserve from rejection (${reasonLabel})`;
    }
    updateClaim(claim.id, patch);
    addTimelineEvent(claim.id, {
      id: `${claim.id}-rej-${Date.now()}`,
      at: nowIso,
      actor: roleDisplayName("senior_approver"),
      kind: "status_change",
      summary,
    });
    if (reserveNum !== null) {
      addTimelineEvent(claim.id, {
        id: `${claim.id}-rej-amt-${Date.now()}`,
        at: nowIso,
        actor: roleDisplayName("senior_approver"),
        kind: "note",
        summary: `Suggested reserve adjustment: ${formatCurrency(claim.amountClaimed)} → ${formatCurrency(reserveNum)}`,
      });
    }
    toast.warning("Sent back to adjuster.");
    setSubmitting(false);
    setDecision(null);
    resetRejectForm();
    navigate("/");
  }

  async function handleRunReadOnlyAI() {
    if (!keyOk) {
      toast.error("AI is not configured on the server.");
      return;
    }
    setAiRunning(true);
    try {
      const result = await runCombinedAnalysis(claim);
      setReadonlyAssessment(result.assessment);
      setReadonlyFraud(result.fraud);
      setAiOpen(true);
      toast.success("AI analysis complete (read-only — not saved).");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("AI analysis failed", { description: msg });
    } finally {
      setAiRunning(false);
    }
  }

  function toggleMissingDoc(doc: string) {
    setMissingDocs((prev) => (prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]));
  }

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="pt-6 pb-4 space-y-3">
        <nav className="flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500">
          <Link to="/" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
            <ArrowLeft className="size-3.5" />
            Approval Queue
          </Link>
        </nav>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {claim.id}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300 font-medium mr-2">
                <ClipboardList className="size-3" />
                Pending Senior Approval
              </span>
              {claim.claimantName} ·{" "}
              {claim.requestedAmount !== undefined
                ? `${formatCurrency(claim.requestedAmount)} requested`
                : claim.amountClaimed > 0
                ? `${formatCurrency(claim.amountClaimed)} reserve`
                : "reserve pending"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950"
              disabled={!keyOk || aiRunning || photos.length === 0}
              onClick={handleRunReadOnlyAI}
              title={photos.length === 0 ? "No damage photos attached" : "Re-run AI analysis without saving"}
            >
              {aiRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              {aiRunning ? "Analyzing…" : "Run AI (read-only)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              onClick={() => setDecision("reject")}
            >
              <XCircle className="size-3.5" />
              Reject &amp; Send Back
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setDecision("approve")}
            >
              <CheckCircle2 className="size-3.5" />
              Approve &amp; Close
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-3 py-2 flex items-start gap-2">
          <Sparkles className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
            <span className="font-semibold">Read-only approval package.</span>{" "}
            This view consolidates everything the adjuster prepared: claim facts, AI damage estimate,
            fraud analysis, and supporting photos. Approve to close the claim, or reject with a reason
            to return it to the adjuster.
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left col — claim facts + AI */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Claim Facts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <FactRow label="Claimant" value={claim.claimantName} />
                <FactRow label="Policy" value={<span className="font-mono">{claim.policyNumber}</span>} />
                <FactRow
                  label="Resolution Type"
                  value={
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${claimTypeColor(claim.type)}`}
                    >
                      {claimTypeLabel(claim.type)}
                    </span>
                  }
                />
                <FactRow label="Date of Loss" value={formatDate(claim.dateOfLoss)} />
                <FactRow label="Reported" value={formatDateTime(claim.reportedAt)} />
                <FactRow
                  label="Vehicle"
                  value={`${claim.vehicle.year} ${claim.vehicle.make} ${claim.vehicle.model} · ${claim.vehicle.color}`}
                />
                {claim.requestedAmount !== undefined && (
                  <FactRow
                    label="Requested by Claimant"
                    value={
                      <span className="text-base text-violet-700 dark:text-violet-300">
                        {formatCurrency(claim.requestedAmount)}
                      </span>
                    }
                  />
                )}
                <FactRow
                  label={claim.type === "reimbursement" ? "Officer Reserve" : "Reserve / Assessed"}
                  value={
                    claim.amountClaimed > 0 ? (
                      <span className="text-base">{formatCurrency(claim.amountClaimed)}</span>
                    ) : (
                      <span className="text-xs italic text-slate-400">Not yet set</span>
                    )
                  }
                />
                <FactRow label="Adjuster" value={claim.assignedTo} />
                <FactRow label="Triage" value={`${claim.triageScore} / 100`} />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                  Adjuster narrative
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{claim.description}</p>
              </div>
              {claim.riskFlags.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                    Rule-based risk flags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {claim.riskFlags.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                        <AlertTriangle className="size-3" />
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {claim.aiAssessment ? (
            <AIAssessmentCard
              assessment={claim.aiAssessment}
              claimedAmount={claim.requestedAmount ?? claim.amountClaimed}
              claimedLabel={claim.requestedAmount !== undefined ? "Requested" : "Reserve"}
              policyVehicle={claim.vehicle}
              adjustedAmount={claim.adjusterAdjustedAmount}
            />
          ) : (
            <MissingAIBanner kind="estimate" />
          )}

          {claim.aiFraudAnalysis ? (
            <FraudAnalysisCard analysis={claim.aiFraudAnalysis} />
          ) : (
            <MissingAIBanner kind="fraud" />
          )}
        </div>

        {/* Right col — photos + recent timeline */}
        <div className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="size-4 text-slate-400" />
                Damage Photos ({photos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <p className="text-xs text-slate-400">No photos attached.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-blue-400 transition-all"
                    >
                      <img src={p.url} alt={p.name} className="w-full h-24 object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {claim.timeline
                  .slice(-5)
                  .reverse()
                  .map((e) => (
                    <li key={e.id} className="text-xs leading-relaxed">
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px]">
                        <span>{formatDateTime(e.at)}</span>
                        <span>·</span>
                        <span className="font-medium">{e.actor}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{e.summary}</p>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Decision dialog */}
      <Dialog
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) {
            setDecision(null);
            resetRejectForm();
            setApproveNote("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {decision === "approve" ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Approve and close {claim.id}
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-red-600" />
                  Reject and send back to adjuster
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {decision === "approve" ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                This authorizes the claim payout for{" "}
                {formatCurrency(
                  claim.adjusterAdjustedAmount ?? claim.requestedAmount ?? claim.amountClaimed
                )}{" "}
                and marks the claim as closed.
              </p>
              <Textarea
                placeholder="Optional approval note…"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Reason */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5 block">
                  Rejection reason <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {REJECT_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                        rejectReason === r.value
                          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reject-reason"
                        value={r.value}
                        checked={rejectReason === r.value}
                        onChange={() => setRejectReason(r.value)}
                        className="accent-red-600"
                      />
                      <span className="text-slate-700 dark:text-slate-200">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Missing docs (chips) */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5 block">
                  Missing documents{" "}
                  {rejectReason === "insufficient_docs" && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MISSING_DOC_OPTIONS.map((doc) => {
                    const active = missingDocs.includes(doc);
                    return (
                      <button
                        type="button"
                        key={doc}
                        onClick={() => toggleMissingDoc(doc)}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                          active
                            ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        {doc}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Adjusted reserve */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5 block">
                  Suggested reserve adjustment (optional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">$</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={`Current: ${formatCurrency(claim.amountClaimed).replace("$", "")}`}
                    value={adjustedReserve}
                    onChange={(e) => setAdjustedReserve(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  If set, will be attached to the claim as an adjuster-suggested reserve.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5 block">
                  Notes{" "}
                  {rejectReason === "other" && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  placeholder="Additional context for the adjuster…"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDecision(null);
                resetRejectForm();
                setApproveNote("");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={decision === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              variant={decision === "reject" ? "destructive" : "default"}
              onClick={decision === "approve" ? handleApprove : handleReject}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : decision === "approve" ? (
                "Confirm approval"
              ) : (
                "Send back to adjuster"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Read-only AI analysis dialog */}
      <AIAnalysisDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        claim={claim}
        assessmentOverride={readonlyAssessment}
        fraudOverride={readonlyFraud}
        readOnlyBanner="Read-only senior review — this AI run is not saved to the claim record."
      />
    </div>
  );
}

function MissingAIBanner({ kind }: { kind: "estimate" | "fraud" }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-2">
      <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
        <span className="font-semibold">
          AI {kind === "estimate" ? "damage estimate" : "fraud analysis"} not yet attached.
        </span>{" "}
        The adjuster submitted this for approval without running the {kind === "estimate" ? "damage estimate" : "fraud analysis"}.
        Consider rejecting and sending back to request it before approval.
      </p>
    </div>
  );
}
