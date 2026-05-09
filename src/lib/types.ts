export type ClaimStatus = "open" | "in_review" | "awaiting_info" | "closed";
/** Resolution route the claim is being processed under. */
export type ClaimType = "total_loss" | "repair" | "reimbursement";
export type Priority = "low" | "medium" | "high" | "critical";
export type Role = "adjuster" | "senior_approver";

export type IncidentType =
  | "collision"
  | "hit_and_run"
  | "vandalism"
  | "theft"
  | "weather"
  | "fire"
  | "other";

export interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  color: string;
  vin?: string;
  bodyStyle?: string;
}

export interface IncidentDetails {
  incidentType: IncidentType;
  /** Free-text location of the incident, e.g. "I-280 northbound, mile marker 24" */
  location: string;
  /** Affected area on the vehicle, e.g. "front bumper + driver-side door" */
  affectedArea: string;
  /** Time of day if known, e.g. "around 7:30 PM" */
  timeOfDay?: string;
  policeReportFiled: boolean;
  otherPartiesInvolved: boolean;
  /** Free-text narrative — what actually happened */
  narrative: string;
}

export type DamageSeverity = "minor" | "moderate" | "severe" | "total_loss";
export type AIConfidence = "low" | "medium" | "high";
export type RecommendedAction =
  | "approve"
  | "request_docs"
  | "independent_appraisal"
  | "siu_referral";

export interface AIAssessmentLineItem {
  component: string;
  damage: string;
  repairAction: "repair" | "replace" | "refinish";
}

export interface AIAssessmentPart {
  name: string;
  oem: string; // OEM part number or "TBD"
  quantity: number;
  unitCost: number;
  total: number;
}

export interface AIAssessment {
  /** Vehicle as detected from the photos (may differ from policy vehicle) */
  detectedVehicle?: VehicleInfo;
  severity: DamageSeverity;
  affectedComponents: AIAssessmentLineItem[];
  partsList: AIAssessmentPart[];
  laborHours: number;
  laborRate: number;
  laborTotal: number;
  partsTotal: number;
  paintRefinish: number;
  estimatedTotalLow: number;
  estimatedTotalHigh: number;
  /** Where the AI sourced its parts/labor pricing — e.g. "MOTOR Parts Database 2026, Q1 collision rates" */
  pricingSource: string;
  confidence: AIConfidence;
  confidenceReasoning: string;
  variancePct: number; // (claimed - estimated mid) / estimated mid * 100
  consistent: boolean;
  comparisonNotes: string;
  recommendedAction: RecommendedAction;
  recommendationReasoning: string;
  /** AI-computed triage priority 0-100 (severity + reporting delay + amount + risk flags). */
  triageScore: number;
  generatedAt: string;
  model: string;
  photosAnalyzed: number;
  tokensUsed?: number;
}

export type FraudFlagCategory =
  | "timing"
  | "amount"
  | "documentation"
  | "photo_inconsistency"
  | "vehicle_mismatch"
  | "history"
  | "other";

export type FraudFlagSeverity = "info" | "warning" | "critical";

export interface FraudFlag {
  category: FraudFlagCategory;
  severity: FraudFlagSeverity;
  title: string;
  description: string;
}

export interface AIFraudAnalysis {
  fraudScore: number; // 0-100
  riskLevel: "low" | "medium" | "high" | "critical";
  flags: FraudFlag[];
  recommendedAction: "proceed" | "request_clarification" | "siu_referral";
  summary: string;
  generatedAt: string;
  model: string;
  photosAnalyzed: number;
  tokensUsed?: number;
}

export interface Claim {
  id: string;
  policyNumber: string;
  claimantName: string;
  /** Resolution route — total_loss, repair, or reimbursement (the latter is the only one with claimant-requested $) */
  type: ClaimType;
  status: ClaimStatus;
  priority: Priority;
  dateOfLoss: string;
  reportedAt: string;
  /** Officer-set assessed value / reserve. Updated as adjuster + AI work the claim. */
  amountClaimed: number;
  /** Only set on reimbursement claims — the amount the claimant has formally requested. */
  requestedAmount?: number;
  /** Vehicle as recorded on the underlying policy. Used to validate against AI photo detection. */
  vehicle: VehicleInfo;
  /** Structured intake details so prompts and UI don't have to parse free-text */
  incident: IncidentDetails;
  description: string;
  triageScore: number;
  /** True when triage score has been computed (by AI or rules); false until first AI run. */
  triageComputed?: boolean;
  riskFlags: string[];
  assignedTo: string;
  documents: ClaimDocument[];
  timeline: TimelineEvent[];
  aiAssessment?: AIAssessment;
  aiFraudAnalysis?: AIFraudAnalysis;
  /** Adjuster's manual override of the AI-suggested estimate. When set, this value
   *  drives reserve exposure, the approval package, and the variance bar. */
  adjusterAdjustedAmount?: number;
  /** Optional rationale for the override; surfaced in the timeline when set. */
  adjusterAdjustmentNote?: string;
  /** ISO timestamp of the most recent override. */
  adjusterAdjustedAt?: string;
  /** Set when a senior approver rejects the claim and sends it back. Cleared on resubmit. */
  rejectionInfo?: RejectionInfo;
}

export interface RejectionInfo {
  reason: string;
  reasonLabel: string;
  missingDocs: string[];
  suggestedReserve?: number;
  notes?: string;
  rejectedBy: string;
  rejectedAt: string;
}

export interface ClaimDocument {
  id: string;
  name: string;
  type: "police_report" | "photo" | "estimate" | "correspondence" | "other";
  uploadedAt: string;
  sizeKb: number;
  /** Path (relative to /public) or absolute URL to display/download the file */
  url?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  actor: string;
  kind: "note" | "status_change" | "document_added" | "contact" | "ai_suggestion";
  summary: string;
}
