import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClaims } from "@/lib/claimsStore";
import type { Claim } from "@/lib/types";

interface Props {
  claim: Claim;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Derive a plausible dummy policyholder email from the claimant name. */
function dummyEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${slug || "policyholder"}@example.com`;
}

interface DraftSource {
  label: string;
  reasonLine: string;
  details: string[];
  missingDocs: string[];
  /** Where the draft came from — used to suppress the "no reason on file" warning. */
  origin: "senior_rejection" | "ai_analysis" | "generic";
}

/** Build the strongest available denial reason. Prefer an explicit senior rejection;
 *  otherwise synthesize one from AI fraud + assessment outputs. */
function deriveReason(claim: Claim): DraftSource {
  // 1. Explicit senior rejection wins.
  if (claim.rejectionInfo) {
    const r = claim.rejectionInfo;
    return {
      label: r.reasonLabel,
      reasonLine: `After a careful review of the photos and information you submitted, we are unable to proceed with your claim at this time. Reason: ${r.reasonLabel}.`,
      details: r.notes ? [r.notes] : [],
      missingDocs: r.missingDocs ?? [],
      origin: "senior_rejection",
    };
  }

  // 2. Synthesize from AI analysis, in order of severity.
  const ai = claim.aiAssessment;
  const fraud = claim.aiFraudAnalysis;
  const details: string[] = [];
  const missing: string[] = [];
  let label: string | null = null;

  // 2a. Vehicle mismatch (highest-severity fraud signal)
  const vehicleMismatch = fraud?.flags.find((f) => f.category === "vehicle_mismatch");
  if (vehicleMismatch && ai?.detectedVehicle) {
    label = "Vehicle mismatch with policy on file";
    const policyV = `${claim.vehicle.year} ${claim.vehicle.make} ${claim.vehicle.model}`;
    const detectedV = `${ai.detectedVehicle.year ?? ""} ${ai.detectedVehicle.make ?? ""} ${ai.detectedVehicle.model ?? ""}`.trim();
    details.push(
      `The vehicle in the submitted photos appears to be a ${detectedV}, but the policy on file (${claim.policyNumber}) covers a ${policyV}. We are unable to process damage to a vehicle that is not listed on the policy.`
    );
    missing.push(`Photos of the insured ${policyV} clearly showing the reported damage`);
    missing.push("Vehicle Identification Number (VIN) visible on the windshield or door jamb");
  }

  // 2b. Other critical fraud flags (photo inconsistency, history, etc.)
  if (!label && fraud) {
    const critical = fraud.flags.find((f) => f.severity === "critical");
    const warn = fraud.flags.find((f) => f.severity === "warning");
    const top = critical || warn;
    if (top) {
      const map: Partial<Record<typeof top.category, string>> = {
        photo_inconsistency: "Photo inconsistencies detected",
        documentation: "Documentation could not be verified",
        history: "Prior claim history conflict",
        timing: "Reporting timing concerns",
        amount: "Amount inconsistencies detected",
        other: "Risk indicators detected",
      };
      label = map[top.category] ?? "Risk indicators detected";
      details.push(top.description);
    }
  }

  // 2c. Damage severity / consistency mismatch (e.g. claimed $20k for minor scratches)
  if (!label && ai && !ai.consistent) {
    label = "Damage estimate inconsistent with claim";
    details.push(
      `Our review estimates the repair cost at $${ai.estimatedTotalLow.toLocaleString()}–$${ai.estimatedTotalHigh.toLocaleString()} (${ai.severity.replace("_", " ")} damage). ${ai.comparisonNotes || "This differs materially from the amount claimed."}`
    );
  }

  // 2d. Large variance from claimed amount
  if (!label && ai && Math.abs(ai.variancePct) >= 25) {
    label = "Significant variance between claimed and estimated repair cost";
    const dir = ai.variancePct > 0 ? "exceeds" : "is below";
    details.push(
      `The amount claimed ${dir} our independent damage estimate of $${ai.estimatedTotalLow.toLocaleString()}–$${ai.estimatedTotalHigh.toLocaleString()} by approximately ${Math.abs(Math.round(ai.variancePct))}%. We require additional supporting documentation before proceeding.`
    );
    missing.push("Itemized cost breakdown supporting the claimed amount");
    missing.push("Original receipts or invoices for any claimed expenses");
  }

  // 2e. Low AI confidence — typically unclear/insufficient photos
  if (!label && ai && ai.confidence === "low") {
    label = "Submitted photos are insufficient to assess the damage";
    details.push(
      ai.confidenceReasoning ||
        "The photos provided do not clearly show the extent of the reported damage. We need additional images before we can complete our assessment."
    );
    missing.push("Clear, well-lit photos of each damaged area, taken from multiple angles");
    missing.push("At least one wide-angle photo showing the full vehicle");
    missing.push("A close-up of any structural or mechanical damage");
  }

  // 2f. AI explicitly recommends SIU referral / requesting docs
  if (!label && ai?.recommendedAction === "siu_referral") {
    label = "Claim flagged for further investigation";
    details.push(
      ai.recommendationReasoning || "Our review identified indicators that require additional verification before we can proceed."
    );
  }
  if (!label && ai?.recommendedAction === "request_docs") {
    label = "Additional documentation required";
    details.push(ai.recommendationReasoning || "Additional supporting documentation is required to complete our review.");
  }

  if (label) {
    return {
      label,
      reasonLine: `After a careful review of the photos and information you submitted, we are unable to proceed with your claim at this time. Reason: ${label}.`,
      details,
      missingDocs: missing,
      origin: "ai_analysis",
    };
  }

  // 3. No signal anywhere — generic.
  return {
    label: "",
    reasonLine: `After a careful review of the photos and information you submitted, we are unable to proceed with your claim at this time.`,
    details: [],
    missingDocs: [],
    origin: "generic",
  };
}

function buildDraft(claim: Claim): { subject: string; body: string; origin: DraftSource["origin"] } {
  const greeting = claim.claimantName.split(/\s+/)[0] || "there";
  const src = deriveReason(claim);

  const subject = src.label
    ? `Update on your claim ${claim.id} — ${src.label}`
    : `Update on your claim ${claim.id}`;

  const detailsPara = src.details.length
    ? `\n\n${src.details.join("\n\n")}`
    : "";

  const missingPara = src.missingDocs.length
    ? `\n\nTo have your claim reconsidered, please provide the following:\n${src.missingDocs
        .map((m) => `  • ${m}`)
        .join("\n")}`
    : "";

  const body = `Dear ${greeting},

Thank you for reporting your claim and for your patience while we reviewed it.

${src.reasonLine}${detailsPara}${missingPara}

If you have additional documentation or believe this decision should be reconsidered, you may reply to this email or contact us at 1-800-555-0142 within 30 days. Please reference claim number ${claim.id} in any correspondence.

We appreciate your understanding.

Sincerely,
Jordan Okafor
Claims Adjuster
ClaimsCopilot Insurance`;

  return { subject, body, origin: src.origin };
}

export function PolicyholderEmailDialog({ claim, open, onOpenChange }: Props) {
  const { updateClaim, addTimelineEvent } = useClaims();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  const initial = useMemo(() => buildDraft(claim), [claim]);
  const to = useMemo(() => dummyEmail(claim.claimantName), [claim.claimantName]);

  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const origin = initial.origin;

  function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required.");
      return;
    }
    setSending(true);
    // Simulate send
    setTimeout(() => {
      updateClaim(claim.id, {
        status: "closed",
        rejectionInfo: undefined,
      });
      addTimelineEvent(claim.id, {
        id: `${claim.id}-deny${Date.now()}`,
        at: new Date().toISOString(),
        actor: "Jordan Okafor",
        kind: "contact",
        summary: `Claim denied. Notification email sent to policyholder (${to}). Subject: "${subject}"`,
      });
      setSending(false);
      onOpenChange(false);
      toast.success(`Email sent to ${to}. Claim closed as denied.`);
      navigate("/");
    }, 600);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-red-600" />
            Reject claim & notify policyholder
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sending this email will close <span className="font-mono">{claim.id}</span> as denied.
            The draft below is pre-filled from the rejection reason on file — edit anything before
            sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ph-to" className="text-xs">To</Label>
            <Input
              id="ph-to"
              value={to}
              readOnly
              className="text-sm font-mono bg-slate-50 dark:bg-slate-900"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph-subject" className="text-xs">Subject</Label>
            <Input
              id="ph-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph-body" className="text-xs">Message</Label>
            <Textarea
              id="ph-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="text-sm font-mono leading-relaxed"
            />
          </div>
          {origin === "generic" && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2.5 py-1.5">
              No rejection reason or AI findings on file — the draft uses a generic denial template.
              Please edit before sending.
            </p>
          )}
          {origin === "ai_analysis" && (
            <p className="text-[11px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded px-2.5 py-1.5">
              Draft pre-filled from the AI analysis findings on this claim. Review and edit any
              wording before sending.
            </p>
          )}
          {origin === "senior_rejection" && (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5">
              Draft pre-filled from the senior adjuster's rejection reason. Review and edit any
              wording before sending.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending}
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {sending ? "Sending…" : "Send & close claim"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
