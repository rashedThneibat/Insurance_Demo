import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PriorNote {
  id: string;
  author: string;
  date: string;
  content: string;
}

const PRIOR_NOTES: PriorNote[] = [
  {
    id: "note-1",
    author: "Jordan Okafor",
    date: "May 5, 2026 · 3:22 PM",
    content:
      "Spoke with claimant again. Story remains consistent. Suggested we expedite the estimate review to avoid missing the 30-day threshold.",
  },
  {
    id: "note-2",
    author: "Priya Nair",
    date: "May 3, 2026 · 10:45 AM",
    content:
      "Reviewed comparable claims from Q1 2026. Amount is within 1.5 standard deviations of the mean for this claim type and region. Flagging resolved pending supervisor sign-off.",
  },
  {
    id: "note-3",
    author: "System",
    date: "Apr 30, 2026 · 9:00 AM",
    content:
      "Automated SLA check: claim has been in 'Open' status for 7 days. Standard target is 10 days. No action required at this time.",
  },
];

export function NotesTab() {
  const [draft, setDraft] = useState("");

  function handleSave() {
    if (!draft.trim()) return;
    toast.success("Note saved (demo)");
    setDraft("");
  }

  return (
    <div className="space-y-6">
      {/* New note input */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Add a note</p>
        <Textarea
          placeholder="Type your adjuster note here…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="text-sm resize-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!draft.trim()}
            className="text-xs"
          >
            Save note
          </Button>
        </div>
      </div>

      {/* Prior notes */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Prior notes
        </p>
        {PRIOR_NOTES.map((note) => (
          <div
            key={note.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">{note.author}</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">{note.date}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
