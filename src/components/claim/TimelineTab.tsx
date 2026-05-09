import { useState } from "react";
import {
  FileText,
  GitCommitVertical,
  Phone,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { Claim, TimelineEvent } from "@/lib/types";

type EventKind = TimelineEvent["kind"];

/** Kinds that count as "critical" milestones — always shown */
const CRITICAL_KINDS: EventKind[] = ["status_change", "ai_suggestion"];

const KIND_CONFIG: Record<
  EventKind,
  { icon: React.ReactNode; dot: string; label: string }
> = {
  note: {
    icon: <FileText className="size-3.5" />,
    dot: "bg-slate-400",
    label: "Note",
  },
  status_change: {
    icon: <ArrowRightLeft className="size-3.5" />,
    dot: "bg-purple-500",
    label: "Status Change",
  },
  document_added: {
    icon: <GitCommitVertical className="size-3.5" />,
    dot: "bg-blue-500",
    label: "Document Added",
  },
  contact: {
    icon: <Phone className="size-3.5" />,
    dot: "bg-green-500",
    label: "Contact",
  },
  ai_suggestion: {
    icon: <Sparkles className="size-3.5" />,
    dot: "bg-amber-400",
    label: "AI Suggestion",
  },
};

function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const config = KIND_CONFIG[event.kind];
  const isAI = event.kind === "ai_suggestion";

  return (
    <div className="flex gap-3">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <div
          className={`size-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
            isAI
              ? "bg-amber-50 border border-amber-200 text-amber-600"
              : "bg-white border border-slate-200 text-slate-500"
          }`}
        >
          {config.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-100 my-1" />}
      </div>

      {/* Content */}
      <div className={`pb-5 flex-1 min-w-0 ${isLast ? "" : ""}`}>
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <span
            className={`text-xs font-semibold uppercase tracking-wide ${
              isAI ? "text-amber-600" : "text-slate-500"
            }`}
          >
            {config.label}
          </span>
          <span className="text-xs text-slate-400">
            {formatDateTime(event.at)}
          </span>
          <span className="text-xs text-slate-300">
            ({relativeTime(event.at)})
          </span>
        </div>
        <p
          className={`text-sm leading-relaxed ${
            isAI
              ? "text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2"
              : "text-slate-700"
          }`}
        >
          {isAI && (
            <Sparkles className="size-3.5 inline mr-1.5 text-amber-500 -mt-0.5" />
          )}
          {event.summary}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          by <span className="font-medium text-slate-500">{event.actor}</span>
        </p>
      </div>
    </div>
  );
}

export function TimelineTab({ claim }: { claim: Claim }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...claim.timeline].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
  const filtered = showAll ? sorted : sorted.filter((e) => CRITICAL_KINDS.includes(e.kind));
  const hiddenCount = sorted.length - filtered.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {filtered.length} {showAll ? "event" : "milestone"}
          {filtered.length !== 1 ? "s" : ""} · newest first
          {!showAll && hiddenCount > 0 && (
            <span className="text-slate-400">
              {" · "}
              {hiddenCount} routine event{hiddenCount === 1 ? "" : "s"} hidden
            </span>
          )}
        </p>
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-500 dark:text-slate-400"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show milestones only" : "Show full activity"}
          </Button>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No milestones yet.</p>
      ) : (
        <div>
          {filtered.map((event, i) => (
            <TimelineItem key={event.id} event={event} isLast={i === filtered.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
