import { XCircle, FileWarning, Banknote, MessageSquareWarning } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { RejectionInfo } from "@/lib/types";

export function RejectionBanner({ info }: { info: RejectionInfo }) {
  return (
    <div className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-red-100 dark:bg-red-900/60 p-2 shrink-0">
          <XCircle className="size-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-red-800 dark:text-red-200">
              Sent back by senior approver
            </h3>
            <span className="text-[11px] text-red-600 dark:text-red-400">
              {formatDateTime(info.rejectedAt)} · {info.rejectedBy}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-red-900 dark:text-red-100">
            {info.reasonLabel}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-12">
        {info.missingDocs.length > 0 && (
          <div className="rounded-md bg-white/60 dark:bg-slate-900/40 border border-red-200 dark:border-red-900 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">
              <FileWarning className="size-3" />
              Missing documents
            </div>
            <ul className="text-xs text-slate-700 dark:text-slate-200 space-y-0.5">
              {info.missingDocs.map((d) => (
                <li key={d}>• {d}</li>
              ))}
            </ul>
          </div>
        )}
        {info.suggestedReserve !== undefined && (
          <div className="rounded-md bg-white/60 dark:bg-slate-900/40 border border-red-200 dark:border-red-900 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">
              <Banknote className="size-3" />
              Suggested reserve
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {formatCurrency(info.suggestedReserve)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Applied as adjuster override
            </p>
          </div>
        )}
        {info.notes && (
          <div className="rounded-md bg-white/60 dark:bg-slate-900/40 border border-red-200 dark:border-red-900 p-2.5 sm:col-span-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">
              <MessageSquareWarning className="size-3" />
              Reviewer notes
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {info.notes}
            </p>
          </div>
        )}
      </div>

      <p className="pl-12 text-[11px] text-red-700 dark:text-red-300 italic">
        Address the items above, then resubmit for senior approval. Submitting again will clear this notice.
      </p>
    </div>
  );
}
