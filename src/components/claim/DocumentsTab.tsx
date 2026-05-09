import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileImage,
  FileText,
  FileCheck,
  File,
  Upload,
  Eye,
  Download,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useClaims } from "@/lib/claimsStore";
import { relativeTime } from "@/lib/format";
import type { Claim, ClaimDocument } from "@/lib/types";

type DocType = ClaimDocument["type"];

const DOC_TYPE_LABELS: Record<DocType, string> = {
  police_report: "Police Report",
  photo: "Photo",
  estimate: "Estimate",
  correspondence: "Correspondence",
  other: "Other",
};

function DocIcon({ type }: { type: DocType }) {
  const cls = "size-4 shrink-0";
  switch (type) {
    case "photo":
      return <FileImage className={`${cls} text-blue-500`} />;
    case "police_report":
      return <FileCheck className={`${cls} text-red-500`} />;
    case "estimate":
      return <FileText className={`${cls} text-orange-500`} />;
    case "correspondence":
      return <FileText className={`${cls} text-purple-500`} />;
    default:
      return <File className={`${cls} text-slate-400`} />;
  }
}

function formatSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

// ── Image lightbox ────────────────────────────────────────────────────────────
function ImageLightbox({
  doc,
  onClose,
}: {
  doc: ClaimDocument;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{doc.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {DOC_TYPE_LABELS[doc.type]} · {formatSize(doc.sizeKb)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {doc.url && (
              <a
                href={doc.url}
                download={doc.name}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
              >
                <Download className="size-3.5" />
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        {/* Image */}
        <div className="flex items-center justify-center bg-black max-h-[75vh]">
          <img
            src={doc.url}
            alt={doc.name}
            className="max-w-full max-h-[75vh] object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsTab({ claim }: { claim: Claim }) {
  const { addDocument, addTimelineEvent } = useClaims();
  const [lightboxDoc, setLightboxDoc] = useState<ClaimDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleView(doc: ClaimDocument) {
    if (doc.url && doc.type === "photo") {
      setLightboxDoc(doc);
    } else {
      toast.info("Demo: document viewer not implemented for this file type");
    }
  }

  function handleDownload(doc: ClaimDocument) {
    if (doc.url) {
      const a = document.createElement("a");
      a.href = doc.url;
      a.download = doc.name;
      a.click();
      toast.success(`Downloading ${doc.name}`);
    } else {
      toast.info("Demo: no file attached");
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const now = new Date().toISOString();

    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const doc: ClaimDocument = {
        id: `${claim.id}-up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: "photo",
        uploadedAt: now,
        sizeKb: Math.round(file.size / 1024),
        url,
      };
      addDocument(claim.id, doc);
    });

    addTimelineEvent(claim.id, {
      id: `${claim.id}-tup-${Date.now()}`,
      at: now,
      actor: "Jordan Okafor",
      kind: "document_added",
      summary: `Uploaded ${files.length} damage photo${files.length > 1 ? "s" : ""} (${files.map((f) => f.name).join(", ")}).`,
    });

    toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded — run "Estimate Damage" in the AI Copilot to analyze.`);
    e.target.value = "";
  }

  // Group photo docs that have a url for the photo strip
  const photoStrip = claim.documents.filter(
    (d) => d.type === "photo" && d.url
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {claim.documents.length} document{claim.documents.length !== 1 ? "s" : ""} attached
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Upload Photos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Photo strip */}
      {photoStrip.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Photos ({photoStrip.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photoStrip.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setLightboxDoc(doc)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={doc.url}
                  alt={doc.name}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="size-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {claim.documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            {/* Thumbnail or icon */}
            {doc.type === "photo" && doc.url ? (
              <button
                onClick={() => setLightboxDoc(doc)}
                className="w-9 h-9 rounded overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 focus:outline-none"
              >
                <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="w-9 h-9 flex items-center justify-center">
                <DocIcon type={doc.type} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{doc.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {DOC_TYPE_LABELS[doc.type]} · {formatSize(doc.sizeKb)} · uploaded{" "}
                {relativeTime(doc.uploadedAt)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-slate-500 dark:text-slate-400 gap-1"
                onClick={() => handleView(doc)}
              >
                <Eye className="size-3.5" />
                View
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-slate-500 dark:text-slate-400 gap-1"
                onClick={() => handleDownload(doc)}
              >
                <Download className="size-3.5" />
                Download
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxDoc && (
        <ImageLightbox doc={lightboxDoc} onClose={() => setLightboxDoc(null)} />
      )}
    </div>
  );
}
