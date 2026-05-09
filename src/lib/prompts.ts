import type { Claim } from "./types";

const SYSTEM = `You are an AI assistant for insurance claim adjusters. Be concise, professional, and factual. Only use information provided in the claim data and attached photos. Do not speculate beyond what is given.`;

function leanClaim(claim: Claim) {
  const referenceAmount = claim.requestedAmount ?? claim.amountClaimed;
  return {
    id: claim.id,
    type: claim.type,
    status: claim.status,
    priority: claim.priority,
    claimantName: claim.claimantName,
    policyNumber: claim.policyNumber,
    dateOfLoss: claim.dateOfLoss,
    reportedAt: claim.reportedAt,
    requestedAmount: claim.requestedAmount,
    reserveAmount: claim.amountClaimed,
    referenceAmount,
    policyVehicle: claim.vehicle,
    incident: claim.incident,
    description: claim.description,
    triageScore: claim.triageScore,
    riskFlags: claim.riskFlags,
    documentCount: claim.documents.length,
    photoCount: claim.documents.filter((d) => d.type === "photo").length,
  };
}

function claimContext(claim: Claim): string {
  return `\n\nCLAIM DATA (JSON):\n${JSON.stringify(leanClaim(claim), null, 2)}`;
}

function imageNote(imageCount: number): string {
  if (imageCount === 0) return "";
  return `\n\nIMAGE ANALYSIS: ${imageCount} vehicle damage photo${imageCount > 1 ? "s are" : " is"} attached. Examine ${imageCount > 1 ? "them" : "it"} carefully.`;
}

// ─── Q&A (free-text chat) ──────────────────────────────────────────────────

export function buildQAPrompt(claim: Claim, question: string, imageCount = 0): string {
  return (
    SYSTEM +
    claimContext(claim) +
    imageNote(imageCount) +
    `\n\nTask: Answer the following adjuster question about this claim. Use the claim data${imageCount > 0 ? " and the attached damage photos" : ""}. If the answer is not in the record, say "I don't have that information in the claim record." Keep it concise (3 sentences max).\n\nQuestion: ${question}`
  );
}

// ─── Combined damage + fraud analysis (single call) ────────────────────────

const COMBINED_SCHEMA = `{
  "assessment": {
    "detectedVehicle": { "year": number, "make": string, "model": string, "color": string, "bodyStyle": string },
    "severity": "minor" | "moderate" | "severe" | "total_loss",
    "affectedComponents": [
      { "component": string, "damage": string, "repairAction": "repair" | "replace" | "refinish" }
    ],
    "partsList": [
      { "name": string, "oem": string, "quantity": number, "unitCost": number, "total": number }
    ],
    "laborHours": number,
    "laborRate": number,
    "laborTotal": number,
    "partsTotal": number,
    "paintRefinish": number,
    "estimatedTotalLow": number,
    "estimatedTotalHigh": number,
    "pricingSource": string,
    "confidence": "low" | "medium" | "high",
    "confidenceReasoning": string,
    "variancePct": number,
    "consistent": boolean,
    "comparisonNotes": string,
    "recommendedAction": "approve" | "request_docs" | "independent_appraisal" | "siu_referral",
    "recommendationReasoning": string,
    "triageScore": number
  },
  "fraud": {
    "fraudScore": number,
    "riskLevel": "low" | "medium" | "high" | "critical",
    "flags": [
      {
        "category": "timing" | "amount" | "documentation" | "photo_inconsistency" | "vehicle_mismatch" | "history" | "other",
        "severity": "info" | "warning" | "critical",
        "title": string,
        "description": string
      }
    ],
    "recommendedAction": "proceed" | "request_clarification" | "siu_referral",
    "summary": string
  }
}`;

export function buildCombinedAnalysisPrompt(claim: Claim, imageCount = 0): string {
  const reference = claim.requestedAmount ?? claim.amountClaimed;
  const hasReference = reference > 0;
  return (
    SYSTEM +
    claimContext(claim) +
    imageNote(imageCount) +
    `

Task: You are BOTH a certified collision damage assessor AND a fraud investigator. In a single pass produce:
  (a) a structured damage assessment, and
  (b) a fraud analysis.

═══ DAMAGE ASSESSMENT ═══

STEP 1 — Detect the vehicle in the photo${imageCount > 1 ? "s" : ""}: identify year (best guess), make, model, color, and body style. Populate "assessment.detectedVehicle".

STEP 2 — Identify damage. List affected components and required repair action.

STEP 3 — Build a realistic line-item estimate using current US 2026 collision shop rates. Use real OEM part numbers when you can confidently identify the vehicle, otherwise "TBD-{component-slug}". Each part's "total" must equal quantity * unitCost. Labor rate $85-$140/hour (San Francisco bay area unless otherwise indicated).

STEP 4 — Cite your pricing source in "assessment.pricingSource" — e.g. "MOTOR Parts Database 2026 Q1, CCC ONE labor benchmarks".

${hasReference
  ? `STEP 5 — Reference amount is $${reference.toLocaleString()}. Compute "variancePct" as (referenceAmount - estimateMid) / estimateMid * 100 where estimateMid = average of low and high. Set "consistent" = (|variancePct| <= 20).`
  : `STEP 5 — No reference amount yet. Set "variancePct" to 0, "consistent" to true.`}

STEP 6 — Compute "triageScore" 0-100 (integer). Higher = more urgent. Combine: severity (minor=15, moderate=35, severe=60, total_loss=80), reporting delay (>14d adds 10), claimed amount over $20k adds 10, any fraud-relevant red flags add 10. Cap at 100.

═══ FRAUD ANALYSIS ═══

Evaluate end-to-end, but be **conservative** — only flag concrete contradictions, not minor procedural gaps. A missing police report alone, or a 10-day reporting delay alone, is NOT sufficient evidence of fraud.

Evaluation areas (use to think, not to enumerate every gap):
- TIMING — significant unexplained delay (>30 days) combined with other red flags
- AMOUNT — claimed amount materially inconsistent with visible damage (>50% over)
- DOCUMENTATION — material contradictions between docs and narrative
- PHOTO INCONSISTENCY — damage pattern inconsistent with reported cause${imageCount > 0 ? "" : " (skip — no photos)"}
- VEHICLE MISMATCH — ${imageCount > 0 ? "compare detected vehicle against policy vehicle (year/make/model/color/body style). Clear mismatch = critical flag." : "skip — no photos"}
- HISTORY — confirmed prior fraud, not just prior claims

Hard limits on output:
- Return AT MOST 2 flags. Pick the strongest two; ignore weaker concerns.
- Each flag "description" ≤ 25 words.
- "summary" ≤ 1 sentence (≤ 30 words).
- If everything checks out: empty flags, fraudScore ≤ 15, riskLevel "low", summary "No fraud indicators detected."

Score: 0-25 low (proceed) · 26-50 medium (request_clarification only if a flag is raised) · 51-75 high · 76-100 critical (SIU).

═══ OUTPUT ═══

Return ONLY one JSON object (no prose, no markdown fences) matching exactly:

${COMBINED_SCHEMA}`
  );
}

// ─── JSON parsing helper ───────────────────────────────────────────────────

export function parseJsonResponse<T>(raw: string): T {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(s) as T;
}
