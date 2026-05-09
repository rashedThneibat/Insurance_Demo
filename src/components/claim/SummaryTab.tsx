import {
  AlertTriangle,
  Car,
  CheckCircle2,
  FileText,
  MapPin,
  Shield,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  claimTypeColor,
  claimTypeLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import type { Claim } from "@/lib/types";
import { useClaims } from "@/lib/claimsStore";
import { useRole, roleDisplayName } from "@/lib/roleStore";
import { toast } from "sonner";
import { AIAssessmentCard } from "./AIAssessmentCard";
import { FraudAnalysisCard } from "./FraudAnalysisCard";

const RISK_FLAG_LABELS: Record<string, string> = {
  late_reporting: "Late reporting (> 72 hours)",
  amount_outlier: "Amount exceeds type average by 2σ",
  prior_claims: "Prior claims on this policy within 12 months",
  inconsistent_statement: "Claimant statement inconsistent with evidence",
  missing_documents: "Required supporting documents not yet submitted",
};

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  collision: "Collision",
  hit_and_run: "Hit & Run",
  vandalism: "Vandalism",
  theft: "Theft",
  weather: "Weather / Natural",
  fire: "Fire",
  other: "Other",
};

function humanRiskFlag(flag: string): string {
  return RISK_FLAG_LABELS[flag] ?? flag.replace(/_/g, " ");
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="size-3.5" />
      Yes
    </span>
  ) : (
    <span className="text-slate-400 dark:text-slate-500">No</span>
  );
}

export function SummaryTab({ claim }: { claim: Claim }) {
  const isReimbursement = claim.type === "reimbursement";
  const { updateClaim, addTimelineEvent } = useClaims();
  const [role] = useRole();
  const canEdit = role === "adjuster" && claim.status !== "closed";

  function handleAdjust(newAmount: number | null) {
    const before = claim.adjusterAdjustedAmount;
    if (newAmount === null) {
      updateClaim(claim.id, {
        adjusterAdjustedAmount: undefined,
        adjusterAdjustmentNote: undefined,
        adjusterAdjustedAt: undefined,
      });
      addTimelineEvent(claim.id, {
        id: `${claim.id}-adj-${Date.now()}`,
        at: new Date().toISOString(),
        actor: roleDisplayName("adjuster"),
        kind: "status_change",
        summary: `Adjuster cleared settlement override. Reverted to AI midpoint.`,
      });
      toast.success("Reverted to AI midpoint");
      return;
    }
    updateClaim(claim.id, {
      adjusterAdjustedAmount: newAmount,
      adjusterAdjustedAt: new Date().toISOString(),
    });
    addTimelineEvent(claim.id, {
      id: `${claim.id}-adj-${Date.now()}`,
      at: new Date().toISOString(),
      actor: roleDisplayName("adjuster"),
      kind: "status_change",
      summary:
        before === undefined
          ? `Adjuster set settlement amount to ${newAmount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.`
          : `Adjuster updated settlement from ${before.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} to ${newAmount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.`,
    });
    toast.success("Settlement amount updated");
  }

  return (
    <div className="space-y-4">
      {/* AI insights — surfaced at top when present */}
      {claim.aiAssessment && (
        <AIAssessmentCard
          assessment={claim.aiAssessment}
          claimedAmount={claim.requestedAmount ?? claim.amountClaimed}
          claimedLabel={claim.requestedAmount !== undefined ? "Requested" : "Reserve"}
          policyVehicle={claim.vehicle}
          adjustedAmount={claim.adjusterAdjustedAmount}
          onAdjust={canEdit ? handleAdjust : undefined}
        />
      )}
      {claim.aiFraudAnalysis && <FraudAnalysisCard analysis={claim.aiFraudAnalysis} />}

      {!claim.aiAssessment && !claim.aiFraudAnalysis && (
        <div className="rounded-lg border border-dashed border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/30 px-4 py-3 flex items-start gap-3">
          <Sparkles className="size-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              No AI analysis yet.
            </p>
            <p>
              Run <strong>Estimate Damage Cost</strong> and <strong>Run Fraud Analysis</strong>{" "}
              from the AI Copilot panel on the right to add a structured assessment to this claim.
              AI outputs are saved to the claim and visible to the senior approver.
            </p>
          </div>
        </div>
      )}

      {/* Claim Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Claim Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <FactRow label="Claimant" value={claim.claimantName} />
            <FactRow
              label="Policy Number"
              value={<span className="font-mono">{claim.policyNumber}</span>}
            />
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
            <FactRow label="Reported At" value={formatDateTime(claim.reportedAt)} />
            <FactRow label="Assigned To" value={claim.assignedTo} />

            {/* Amounts — semantics depend on type */}
            {isReimbursement && claim.requestedAmount !== undefined && (
              <FactRow
                label="Requested by Claimant"
                value={
                  <span className="text-violet-700 dark:text-violet-300 text-base">
                    {formatCurrency(claim.requestedAmount)}
                  </span>
                }
              />
            )}
            <FactRow
              label={isReimbursement ? "Officer Reserve" : "Reserve / Assessed Value"}
              value={
                claim.amountClaimed > 0 ? (
                  <span className="text-slate-900 dark:text-slate-100 text-base">
                    {formatCurrency(claim.amountClaimed)}
                  </span>
                ) : (
                  <span className="text-slate-400 italic text-xs">
                    Not yet set — run AI estimate
                  </span>
                )
              }
            />

            <FactRow
              label="Triage Score"
              value={
                claim.triageComputed ? (
                  <span
                    title="0-100 composite priority score combining severity, claimed amount, reporting delay, and prior claims."
                    className={
                      claim.triageScore >= 80
                        ? "text-red-600"
                        : claim.triageScore >= 60
                        ? "text-orange-600"
                        : "text-slate-800 dark:text-slate-200"
                    }
                  >
                    {claim.triageScore} / 100
                  </span>
                ) : (
                  <span
                    title="Triage score is computed by the AI from photos, severity, and claim metadata. Run AI Analysis to populate."
                    className="text-slate-400 italic text-xs"
                  >
                    N/A — run AI to compute
                  </span>
                )
              }
            />
          </dl>
        </CardContent>
      </Card>

      {/* Insured Vehicle (from policy) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Car className="size-4 text-slate-400" />
            Insured Vehicle
            <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wide ml-1">
              from policy
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-4 gap-x-4 gap-y-3">
            <FactRow label="Year" value={claim.vehicle.year} />
            <FactRow label="Make" value={claim.vehicle.make} />
            <FactRow label="Model" value={claim.vehicle.model} />
            <FactRow label="Color" value={claim.vehicle.color} />
            {claim.vehicle.bodyStyle && (
              <FactRow label="Body Style" value={claim.vehicle.bodyStyle} />
            )}
            {claim.vehicle.vin && (
              <div className="col-span-3 flex flex-col gap-0.5">
                <dt className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
                  VIN
                </dt>
                <dd className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  {claim.vehicle.vin}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Incident Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <MapPin className="size-4 text-slate-400" />
            Incident Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <FactRow
              label="Incident Type"
              value={INCIDENT_TYPE_LABEL[claim.incident.incidentType] ?? claim.incident.incidentType}
            />
            <FactRow label="Time of Day" value={claim.incident.timeOfDay ?? "—"} />
            <div className="col-span-2">
              <FactRow label="Location" value={claim.incident.location} />
            </div>
            <div className="col-span-2">
              <FactRow label="Affected Area" value={claim.incident.affectedArea} />
            </div>
            <FactRow
              label="Police Report"
              value={<YesNo value={claim.incident.policeReportFiled} />}
            />
            <FactRow
              label="Other Parties"
              value={<YesNo value={claim.incident.otherPartiesInvolved} />}
            />
          </dl>
          <div>
            <dt className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide mb-1">
              Narrative
            </dt>
            <dd className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {claim.incident.narrative}
            </dd>
          </div>
        </CardContent>
      </Card>

      {/* Adjuster Notes */}
      {claim.description && claim.description !== claim.incident.narrative && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <FileText className="size-4 text-slate-400" />
              Adjuster Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {claim.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Risk Flags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Shield className="size-4 text-slate-400" />
            Rule-based Risk Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          {claim.riskFlags.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="text-sm font-medium">
                No rule-based risk flags detected.
              </span>
            </div>
          ) : (
            <ul className="space-y-2">
              {claim.riskFlags.map((flag) => (
                <li key={flag} className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                    {humanRiskFlag(flag)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
