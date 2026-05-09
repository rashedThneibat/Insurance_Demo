import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock,
  Loader2,
  Mail,
  SendHorizonal,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClaims } from "@/lib/claimsStore";
import { useRole } from "@/lib/roleStore";
import { statusLabel } from "@/lib/format";
import type { Claim, ClaimStatus, Priority } from "@/lib/types";
import { PolicyholderEmailDialog } from "./PolicyholderEmailDialog";

function StatusBadge({ status }: { status: ClaimStatus }) {
  const styles: Record<ClaimStatus, string> = {
    open: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    in_review: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900",
    awaiting_info: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    closed: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900",
    low: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[priority]}`}>
      {priority}
    </span>
  );
}

const WORKFLOW_STAGES: { key: ClaimStatus; label: string }[] = [
  { key: "open", label: "Filed" },
  { key: "in_review", label: "Adjuster Review" },
  { key: "awaiting_info", label: "Senior Approval" },
  { key: "closed", label: "Closed" },
];

function WorkflowProgress({ status }: { status: ClaimStatus }) {
  const currentIdx = WORKFLOW_STAGES.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center">
      {WORKFLOW_STAGES.map((stage, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                  isDone
                    ? "bg-emerald-500 border-emerald-500"
                    : isCurrent
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="size-3 text-white" />
                ) : isCurrent ? (
                  <CircleDot className="size-3 text-white" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isDone
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isCurrent
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {idx < WORKFLOW_STAGES.length - 1 && (
              <div className={`h-px w-6 mx-1.5 ${idx < currentIdx ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

type WorkflowAction = "begin_review" | "submit_approval" | "approve_close" | "reopen";

interface ActionCfg {
  label: string;
  icon: React.ReactNode;
  action: WorkflowAction;
  confirmTitle: string;
  confirmDesc: string;
  className: string;
}

export function ClaimHeader({ claim }: { claim: Claim }) {
  const { updateClaim, addTimelineEvent } = useClaims();
  const [role] = useRole();
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  function doTransition(newStatus: ClaimStatus, summary: string, msg: string) {
    setTransitioning(true);
    // Resubmitting for senior approval clears any prior rejection notice.
    const patch: Partial<Claim> =
      newStatus === "awaiting_info"
        ? { status: newStatus, rejectionInfo: undefined }
        : { status: newStatus };
    updateClaim(claim.id, patch);
    addTimelineEvent(claim.id, {
      id: `${claim.id}-t${Date.now()}`,
      at: new Date().toISOString(),
      actor: "Jordan Okafor",
      kind: "status_change",
      summary,
    });
    setTransitioning(false);
    setPendingAction(null);
    toast.success(msg);
  }

  function handleConfirm() {
    switch (pendingAction) {
      case "begin_review":
        doTransition("in_review", "Adjuster review started by Jordan Okafor.", "Claim moved to In Review.");
        break;
      case "submit_approval":
        doTransition(
          "awaiting_info",
          "Submitted to Senior Adjuster for approval. AI damage estimate and risk analysis included in package.",
          "Submitted for Senior Adjuster approval."
        );
        break;
      case "approve_close":
        doTransition("closed", "Senior adjuster approval granted. Claim authorized and closed.", "Claim approved and closed.");
        break;
      case "reopen":
        doTransition("open", "Claim re-opened by Jordan Okafor for further review.", "Claim re-opened.");
        break;
    }
  }

  const actionCfg: Record<ClaimStatus, ActionCfg> = {
    open: {
      label: "Begin Adjuster Review",
      icon: <ClipboardCheck className="size-3.5" />,
      action: "begin_review",
      confirmTitle: "Begin Adjuster Review",
      confirmDesc: `Mark ${claim.id} as In Review and move it to your active adjuster queue?`,
      className: "bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900",
    },
    in_review: {
      label: "Submit for Senior Approval",
      icon: <SendHorizonal className="size-3.5" />,
      action: "submit_approval",
      confirmTitle: "Submit for Senior Adjuster Approval",
      confirmDesc: `This will submit ${claim.id} to the Senior Claims Adjuster for final review and authorization. Ensure the AI damage estimate and risk analysis are complete before proceeding.`,
      className: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    awaiting_info: {
      label: "Approve & Close Claim",
      icon: <UserCheck className="size-3.5" />,
      action: "approve_close",
      confirmTitle: "Approve and Close Claim",
      confirmDesc: `Grant senior authorization and close ${claim.id}. This authorizes the repair or settlement and marks the claim as complete.`,
      className: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    closed: {
      label: "Re-open Claim",
      icon: <Clock className="size-3.5" />,
      action: "reopen",
      confirmTitle: "Re-open Claim",
      confirmDesc: `Re-open ${claim.id} for further adjuster review?`,
      className: "",
    },
  };

  const cfg = actionCfg[claim.status];

  // Only the Senior Approver can approve & close a claim that is awaiting approval.
  // For an adjuster on a pending-approval claim, the workflow action is hidden — they
  // see only the "Pending Senior Review" status pill.
  const hideAction = claim.status === "awaiting_info" && role !== "senior_approver";

  return (
    <>
      <div className="pt-6 pb-4 space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500">
          <Link to="/" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <ArrowLeft className="size-3.5" />
            Queue
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-slate-600 dark:text-slate-300 font-medium font-mono">{claim.id}</span>
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 hidden sm:flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Claims Adjuster · Jordan Okafor
          </span>
        </nav>

        {/* Title + actions row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {claim.id}
            </h1>
            <div className="flex items-center gap-2">
              <StatusBadge status={claim.status} />
              <PriorityBadge priority={claim.priority} />
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-sm hidden sm:block">—</span>
            <span className="text-slate-600 dark:text-slate-300 text-sm font-medium hidden sm:block">
              {claim.claimantName}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {claim.status === "awaiting_info" && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-3 py-1 text-xs text-amber-700 dark:text-amber-300 font-medium">
                <Clock className="size-3" />
                Pending Senior Review
              </div>
            )}
            {claim.status === "closed" && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                <XCircle className="size-3" />
                Claim Closed
              </div>
            )}
            <Button
              size="sm"
              variant={claim.status === "closed" ? "outline" : "default"}
              className={`text-xs gap-1.5 ${cfg.className} ${hideAction ? "hidden" : ""}`}
              disabled={transitioning}
              onClick={() => setPendingAction(cfg.action)}
            >
              {transitioning ? <Loader2 className="size-3.5 animate-spin" /> : cfg.icon}
              {cfg.label}
            </Button>
            {claim.status === "in_review" && role !== "senior_approver" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                disabled={transitioning}
                onClick={() => setEmailOpen(true)}
              >
                <Mail className="size-3.5" />
                Reject & Notify Policyholder
              </Button>
            )}
          </div>
        </div>

        {/* Workflow progress bar */}
        <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 inline-flex">
          <WorkflowProgress status={claim.status} />
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={!!pendingAction} onOpenChange={(v) => !v && setPendingAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              {pendingAction && actionCfg[claim.status].icon}
              {pendingAction ? actionCfg[claim.status].confirmTitle : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {pendingAction ? actionCfg[claim.status].confirmDesc : ""}
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={transitioning}>
              {transitioning ? <Loader2 className="size-3.5 animate-spin" /> : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PolicyholderEmailDialog claim={claim} open={emailOpen} onOpenChange={setEmailOpen} />
    </>
  );
}
