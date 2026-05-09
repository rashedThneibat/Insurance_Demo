import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, FileText, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClaims } from "@/lib/claimsStore";
import type {
  Claim,
  ClaimDocument,
  ClaimType,
  IncidentDetails,
  IncidentType,
  VehicleInfo,
} from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTriageScore(
  narrative: string,
  incidentType: IncidentType,
  type: ClaimType,
  amount: number
): number {
  let score = 30;
  const d = narrative.toLowerCase();
  if (type === "total_loss") score += 25;
  if (incidentType === "collision" || incidentType === "hit_and_run") score += 8;
  if (incidentType === "fire" || incidentType === "weather") score += 12;
  if (d.includes("structural") || d.includes("rollover")) score += 15;
  if (amount > 50_000) score += 20;
  else if (amount > 20_000) score += 10;
  else if (amount > 8_000) score += 5;
  return Math.min(score, 98);
}

function computePriority(score: number): Claim["priority"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewClaimModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { addClaim } = useClaims();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Claimant + policy
  const [claimantName, setClaimantName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");

  // Vehicle (from policy)
  const [vehYear, setVehYear] = useState("");
  const [vehMake, setVehMake] = useState("");
  const [vehModel, setVehModel] = useState("");
  const [vehColor, setVehColor] = useState("");

  // Claim
  const [claimType, setClaimType] = useState<ClaimType>("repair");
  const [dateOfLoss, setDateOfLoss] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");

  // Structured incident
  const [incidentType, setIncidentType] = useState<IncidentType>("collision");
  const [location, setLocation] = useState("");
  const [affectedArea, setAffectedArea] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [policeReportFiled, setPoliceReportFiled] = useState(false);
  const [otherPartiesInvolved, setOtherPartiesInvolved] = useState(false);
  const [narrative, setNarrative] = useState("");

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isReimbursement = claimType === "reimbursement";

  // ── Photo handlers ──────────────────────────────────────────────────────────

  function handleFiles(files: File[]) {
    const combined = [...photos, ...files].slice(0, 6);
    const newUrls = combined.map((f, i) =>
      i < photos.length ? photoUrls[i] : URL.createObjectURL(f)
    );
    photoUrls.slice(combined.length).forEach((u) => URL.revokeObjectURL(u));
    setPhotos(combined);
    setPhotoUrls(newUrls);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoUrls[index]);
    setPhotos((p) => p.filter((_, i) => i !== index));
    setPhotoUrls((u) => u.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) handleFiles(files);
  }

  function resetForm() {
    photoUrls.forEach((u) => URL.revokeObjectURL(u));
    setClaimantName("");
    setPolicyNumber("");
    setVehYear("");
    setVehMake("");
    setVehModel("");
    setVehColor("");
    setClaimType("repair");
    setDateOfLoss("");
    setRequestedAmount("");
    setIncidentType("collision");
    setLocation("");
    setAffectedArea("");
    setTimeOfDay("");
    setPoliceReportFiled(false);
    setOtherPartiesInvolved(false);
    setNarrative("");
    setPhotos([]);
    setPhotoUrls([]);
    setErrors({});
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!claimantName.trim()) errs.claimantName = "Required";
    if (!dateOfLoss) errs.dateOfLoss = "Required";
    if (!narrative.trim()) errs.narrative = "Required";
    if (!location.trim()) errs.location = "Required";
    if (!affectedArea.trim()) errs.affectedArea = "Required";
    if (!vehYear || isNaN(parseInt(vehYear))) errs.vehYear = "Required";
    if (!vehMake.trim()) errs.vehMake = "Required";
    if (!vehModel.trim()) errs.vehModel = "Required";
    if (!vehColor.trim()) errs.vehColor = "Required";

    if (isReimbursement) {
      const amt = parseFloat(requestedAmount.replace(/,/g, ""));
      if (!requestedAmount || isNaN(amt) || amt <= 0)
        errs.requestedAmount = "Required for reimbursement claims";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 90000) + 10000);
    const id = `CLM-${year}-${seq}`;
    const polNum =
      policyNumber.trim() ||
      `POL-AUTO-${String(Math.floor(Math.random() * 90000) + 10000)}`;

    const reqAmt = isReimbursement
      ? parseFloat(requestedAmount.replace(/,/g, ""))
      : undefined;
    // Officer's working assessment starts at 0 for repair / total_loss until AI runs;
    // for reimbursement we mirror the requested amount as the initial reserve.
    const assessedAmount = reqAmt ?? 0;

    const score = computeTriageScore(
      narrative,
      incidentType,
      claimType,
      reqAmt ?? 0
    );

    // Convert each uploaded photo to a base64 data URL so it survives independently
    // of the modal's blob-URL lifecycle (resetForm() revokes the blob URLs below).
    // Vision models receive these data URLs directly via the image_url content part.
    const photoDataUrls = await Promise.all(
      photos.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    );

    const photoDocs: ClaimDocument[] = photoDataUrls.map((dataUrl, i) => ({
      id: `${id}-photo-${i}`,
      name: photos[i].name,
      type: "photo" as const,
      uploadedAt: now,
      sizeKb: Math.round(photos[i].size / 1024),
      url: dataUrl,
    }));

    const vehicle: VehicleInfo = {
      year: parseInt(vehYear),
      make: vehMake.trim(),
      model: vehModel.trim(),
      color: vehColor.trim(),
    };

    const incident: IncidentDetails = {
      incidentType,
      location: location.trim(),
      affectedArea: affectedArea.trim(),
      timeOfDay: timeOfDay.trim() || undefined,
      policeReportFiled,
      otherPartiesInvolved,
      narrative: narrative.trim(),
    };

    const claim: Claim = {
      id,
      policyNumber: polNum,
      claimantName: claimantName.trim(),
      type: claimType,
      status: "open",
      priority: computePriority(score),
      dateOfLoss,
      reportedAt: now,
      amountClaimed: assessedAmount,
      requestedAmount: reqAmt,
      vehicle,
      incident,
      description: narrative.trim(),
      triageScore: score,
      riskFlags: [],
      assignedTo: "Jordan Okafor",
      documents: photoDocs,
      timeline: [
        {
          id: `${id}-t0`,
          at: now,
          actor: "Jordan Okafor",
          kind: "status_change",
          summary: `Claim filed at intake.${
            photoDocs.length > 0
              ? ` ${photoDocs.length} damage photo${photoDocs.length > 1 ? "s" : ""} uploaded.`
              : ""
          }`,
        },
      ],
    };

    addClaim(claim);
    setSubmitting(false);
    resetForm();
    onClose();

    toast.success(
      photoDocs.length > 0
        ? `${id} created — run "Estimate Damage" in the AI Copilot to analyze the photos.`
        : `${id} created successfully.`,
      { duration: 6000 }
    );

    navigate(`/claim/${id}`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="size-4 text-slate-500" />
            New Claim — Adjuster Intake
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Claims Adjuster: Jordan Okafor ·{" "}
            {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* ── Claimant Information ─────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Claimant Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Claimant Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Full legal name"
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  className={errors.claimantName ? "border-red-300" : ""}
                />
                {errors.claimantName && (
                  <p className="text-xs text-red-500">{errors.claimantName}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Policy Number
                </label>
                <Input
                  placeholder="Auto-generated if blank"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Insured Vehicle ──────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Insured Vehicle (from policy)
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Year <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="2022"
                  value={vehYear}
                  onChange={(e) => setVehYear(e.target.value)}
                  className={errors.vehYear ? "border-red-300" : ""}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Make <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Honda"
                  value={vehMake}
                  onChange={(e) => setVehMake(e.target.value)}
                  className={errors.vehMake ? "border-red-300" : ""}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Model <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Accord"
                  value={vehModel}
                  onChange={(e) => setVehModel(e.target.value)}
                  className={errors.vehModel ? "border-red-300" : ""}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Color <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Silver"
                  value={vehColor}
                  onChange={(e) => setVehColor(e.target.value)}
                  className={errors.vehColor ? "border-red-300" : ""}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              The AI fraud check compares this vehicle against what it sees in the photos.
            </p>
          </section>

          {/* ── Claim Details ────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Claim Details
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Resolution Type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={claimType}
                  onValueChange={(v) => setClaimType(v as ClaimType)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="total_loss">Total Loss</SelectItem>
                    <SelectItem value="reimbursement">Reimbursement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Date of Loss <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={dateOfLoss}
                  onChange={(e) => setDateOfLoss(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className={errors.dateOfLoss ? "border-red-300" : ""}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Time of Day
                </label>
                <Input
                  placeholder="e.g. around 6:15 PM"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                />
              </div>
            </div>

            {/* Requested amount — only for reimbursement */}
            {isReimbursement && (
              <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Requested Amount (USD) <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. 8500"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  className={errors.requestedAmount ? "border-red-300" : ""}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Customer-requested figure for reimbursement. The officer's reserve will be set
                  during review.
                </p>
                {errors.requestedAmount && (
                  <p className="text-xs text-red-500">{errors.requestedAmount}</p>
                )}
              </div>
            )}
          </section>

          {/* ── Incident Details ─────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Incident Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Incident Type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={incidentType}
                  onValueChange={(v) => setIncidentType(v as IncidentType)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collision">Collision</SelectItem>
                    <SelectItem value="hit_and_run">Hit & Run</SelectItem>
                    <SelectItem value="vandalism">Vandalism</SelectItem>
                    <SelectItem value="theft">Theft</SelectItem>
                    <SelectItem value="weather">Weather / Natural</SelectItem>
                    <SelectItem value="fire">Fire</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Affected Area on Vehicle <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. front bumper, driver-side doors"
                  value={affectedArea}
                  onChange={(e) => setAffectedArea(e.target.value)}
                  className={errors.affectedArea ? "border-red-300" : ""}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Place of Damage / Incident Location <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Whole Foods parking lot, 2200 Market St"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={errors.location ? "border-red-300" : ""}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policeReportFiled}
                  onChange={(e) => setPoliceReportFiled(e.target.checked)}
                  className="accent-blue-600"
                />
                Police report filed
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={otherPartiesInvolved}
                  onChange={(e) => setOtherPartiesInvolved(e.target.checked)}
                  className="accent-blue-600"
                />
                Other parties involved
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Narrative — what happened <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Describe the incident in the claimant's words…"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={3}
                className={`text-sm resize-none ${errors.narrative ? "border-red-300" : ""}`}
              />
              {errors.narrative && (
                <p className="text-xs text-red-500">{errors.narrative}</p>
              )}
            </div>
          </section>

          {/* ── Damage Photos ────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Damage Photos
              </h3>
              <span className="text-[11px] text-slate-400">
                Optional · up to 6 · unlocks AI damage estimation
              </span>
            </div>

            {photoUrls.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {photoUrls.map((url, i) => (
                    <div
                      key={i}
                      className="relative group aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                    >
                      <img src={url} alt={photos[i]?.name ?? `photo-${i}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {photoUrls.length < 6 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/30 transition-colors flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500"
                    >
                      <ImagePlus className="size-5" />
                      <span className="text-[11px]">Add more</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Camera className="size-3.5" />
                  {photoUrls.length} photo{photoUrls.length > 1 ? "s" : ""} ready — keep them of the same vehicle.
                </p>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors p-8 flex flex-col items-center gap-2.5 text-slate-400 hover:text-blue-500"
              >
                <Upload className="size-8 stroke-1.5" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Upload damage photos
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click or drag-and-drop · JPG, PNG, HEIC
                  </p>
                </div>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </section>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
          <p className="text-xs text-slate-400">
            Assigned to{" "}
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Jordan Okafor
            </span>{" "}
            · Claims Adjuster
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Creating…
                </>
              ) : (
                <>
                  <FileText className="size-3.5 mr-1.5" />
                  Create Claim
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
