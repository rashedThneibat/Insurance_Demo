import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileQuestion, HelpCircle, Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClaims } from "@/lib/claimsStore";
import { useRole } from "@/lib/roleStore";
import { ClaimHeader } from "@/components/claim/ClaimHeader";
import { SummaryTab } from "@/components/claim/SummaryTab";
import { DocumentsTab } from "@/components/claim/DocumentsTab";
import { TimelineTab } from "@/components/claim/TimelineTab";
import { NotesTab } from "@/components/claim/NotesTab";
import { AICopilotPanel, type AICopilotPanelHandle } from "@/components/claim/AICopilotPanel";
import { ApprovalPackageView } from "@/components/claim/ApprovalPackageView";
import { RejectionBanner } from "@/components/claim/RejectionBanner";

const TAB_ORDER = ["summary", "timeline", "notes"] as const;
type TabValue = (typeof TAB_ORDER)[number];

// ── Keyboard shortcuts help dialog ──────────────────────────────────────────
function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? "⌘" : "Ctrl";
  const shortcuts = [
    { keys: `${mod} + 1`, desc: "Switch to Summary tab" },
    { keys: `${mod} + 2`, desc: "Switch to Timeline tab" },
    { keys: `${mod} + 3`, desc: "Switch to Notes tab" },
    { keys: `${mod} + K`, desc: "Focus AI Q&A input" },
    { keys: "?", desc: "Open this shortcuts reference" },
  ];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="size-4 text-slate-500" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-300">{s.desc}</span>
              <kbd className="shrink-0 font-mono text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded px-2 py-0.5">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="w-full mt-1" onClick={onClose}>
          <X className="size-3.5 mr-1.5" />
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function ClaimWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { getClaimById } = useClaims();
  const [role] = useRole();
  const claim = id ? getClaimById(id) : undefined;
  const [activeTab, setActiveTab] = useState<TabValue>("summary");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const copilotRef = useRef<AICopilotPanelHandle>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      // Don't hijack when typing in inputs/textareas
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "?") {
        setShortcutsOpen(true);
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        if (["1", "2", "3"].includes(e.key)) {
          e.preventDefault();
          setActiveTab(TAB_ORDER[Number(e.key) - 1]);
          return;
        }
        if (e.key === "k") {
          e.preventDefault();
          copilotRef.current?.activateQA();
          return;
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!claim) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4 text-slate-400 dark:text-slate-500">
        <FileQuestion className="size-14 stroke-1" />
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-slate-700 dark:text-slate-300">Claim not found</h1>
          <p className="text-sm">
            The claim ID <span className="font-mono font-semibold">{id ?? "unknown"}</span> does not
            match any record.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/">← Back to Queue</Link>
        </Button>
      </div>
    );
  }

  // Senior approver path — read-only consolidated approval package
  if (role === "senior_approver" && claim.status === "awaiting_info") {
    return (
      <>
        <ApprovalPackageView claim={claim} />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </>
    );
  }

  return (
    <div className="pb-12">
      <ClaimHeader claim={claim} />

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left: tabs */}
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="mb-4">
              <TabsTrigger value="summary">
                Overview
                <span className="ml-1.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5 font-semibold">
                  {claim.documents.length} docs
                </span>
              </TabsTrigger>
              <TabsTrigger value="timeline">
                Timeline
                <span className="ml-1.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5 font-semibold">
                  {claim.timeline.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="animate-in fade-in duration-150">
              {claim.rejectionInfo && (
                <div className="mb-4">
                  <RejectionBanner info={claim.rejectionInfo} />
                </div>
              )}
              <DocumentsTab claim={claim} />
              <div className="mt-4">
                <SummaryTab claim={claim} />
              </div>
            </TabsContent>
            <TabsContent value="timeline" className="animate-in fade-in duration-150">
              <TimelineTab claim={claim} />
            </TabsContent>
            <TabsContent value="notes" className="animate-in fade-in duration-150">
              <NotesTab />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: AI sidebar — wider for richer cost/cards */}
        <div className="w-[340px] shrink-0 sticky top-20">
          <AICopilotPanel ref={copilotRef} claim={claim} />
        </div>
      </div>

      {/* Shortcuts help dialog */}
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Floating "?" button */}
      <button
        onClick={() => setShortcutsOpen(true)}
        aria-label="Keyboard shortcuts"
        className="fixed bottom-5 right-5 z-40 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HelpCircle className="size-4.5" />
      </button>
    </div>
  );
}


