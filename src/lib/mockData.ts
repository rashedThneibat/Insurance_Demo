import type { Claim } from "./types";

/**
 * Demo dataset.
 *
 * Design rules:
 *  - One representative damage photo per claim, matching the policy vehicle.
 *    CLM-00199 is intentionally fraudulent (Subaru policy / Honda photo) so that
 *    when an adjuster runs AI analysis live, the vehicle-mismatch flag fires.
 *  - Most open claims are seeded WITHOUT AI assessments and without a reserve
 *    (`amountClaimed: 0`, `triageComputed: false`). The expected adjuster journey
 *    is: open the claim → review photos → run AI → AI populates reserve and
 *    triage → adjuster optionally overrides → submit for approval.
 *  - Only CLM-00188 (already submitted for senior approval) and CLM-00091
 *    (already closed) carry pre-set reserves; the senior can run a read-only AI
 *    pass on CLM-00188 to confirm.
 */

export const mockClaims: Claim[] = [
  // ── 1. Reimbursement — vehicle-only, claimant repair estimate inflated ──
  {
    id: "CLM-2026-00142",
    policyNumber: "POL-AUTO-88321",
    claimantName: "Marcus Delgado",
    type: "reimbursement",
    status: "open",
    priority: "high",
    dateOfLoss: "2026-04-18",
    reportedAt: "2026-04-30T09:14:00Z",
    amountClaimed: 0,
    requestedAmount: 5800,
    vehicle: {
      year: 2019,
      make: "Honda",
      model: "Civic",
      color: "Silver",
      bodyStyle: "Sedan",
      vin: "2HGFC2F69KH123456",
    },
    incident: {
      incidentType: "collision",
      location: "Whole Foods parking lot, 2200 Market St, San Francisco",
      affectedArea: "Rear bumper",
      timeOfDay: "Around 2:30 PM",
      policeReportFiled: false,
      otherPartiesInvolved: true,
      narrative:
        "Insured rear-ended at low speed in a parking lot. Minor scuffing and a crack on the rear bumper cover. Claimant submitted a $5,800 repair estimate from a non-network body shop and is seeking reimbursement.",
    },
    description:
      "Insured rear-ended at low speed in parking lot. Minor rear bumper damage. Claimant requesting $5,800 reimbursement. Second auto claim this policy year. No police report filed at scene. 12-day reporting delay.",
    triageScore: 0,
    triageComputed: false,
    riskFlags: ["late_reporting", "prior_claims"],
    assignedTo: "Jordan Okafor",
    documents: [
      { id: "d001", name: "rear_bumper_damage.jpg", type: "photo", uploadedAt: "2026-04-30T09:20:00Z", sizeKb: 2340, url: "/images/minor2.JPEG" },
    ],
    timeline: [
      { id: "t001", at: "2026-04-30T09:14:00Z", actor: "system", kind: "status_change", summary: "Claim opened. Reimbursement request from claimant for $5,800." },
    ],
    aiAssessment: undefined,
    aiFraudAnalysis: undefined,
  },

  // ── 2. Total loss collision — clean ─────────────────────────────────────
  {
    id: "CLM-2026-00171",
    policyNumber: "POL-AUTO-71540",
    claimantName: "Keisha Monroe",
    type: "total_loss",
    status: "open",
    priority: "high",
    dateOfLoss: "2026-05-01",
    reportedAt: "2026-05-01T22:45:00Z",
    amountClaimed: 0,
    vehicle: {
      year: 2022,
      make: "Honda",
      model: "Accord",
      color: "Modern Steel Metallic",
      bodyStyle: "Sedan",
      vin: "1HGCV1F30NA200001",
    },
    incident: {
      incidentType: "collision",
      location: "US-101 northbound near Candlestick Point exit",
      affectedArea: "Front-end and driver-side structural damage",
      timeOfDay: "Around 10:20 PM",
      policeReportFiled: true,
      otherPartiesInvolved: true,
      narrative:
        "Three-vehicle collision on Highway 101. Insured's vehicle struck from behind, then pushed into the center divider. Likely total loss per scene assessment.",
    },
    description:
      "Three-vehicle collision on Highway 101. Insured's 2022 Honda Accord likely totaled per initial assessment. At-fault determination contested — other driver disputes account. Rental reimbursement active. Police report on file.",
    triageScore: 0,
    triageComputed: false,
    riskFlags: [],
    assignedTo: "Jordan Okafor",
    documents: [
      { id: "d030", name: "police_report_CLM171.pdf", type: "police_report", uploadedAt: "2026-05-02T08:00:00Z", sizeKb: 310 },
      { id: "d031", name: "scene_photo_total_loss.jpg", type: "photo", uploadedAt: "2026-05-01T23:10:00Z", sizeKb: 4800, url: "/images/severe2.JPEG" },
      { id: "d032", name: "tow_receipt.pdf", type: "other", uploadedAt: "2026-05-02T10:30:00Z", sizeKb: 55 },
      { id: "d033", name: "rental_agreement.pdf", type: "correspondence", uploadedAt: "2026-05-03T08:00:00Z", sizeKb: 120 },
      { id: "d034", name: "total_loss_valuation.pdf", type: "estimate", uploadedAt: "2026-05-04T13:00:00Z", sizeKb: 290 },
    ],
    timeline: [
      { id: "t030", at: "2026-05-01T22:45:00Z", actor: "system", kind: "status_change", summary: "Claim opened. Police report and scene photo attached." },
    ],
    aiAssessment: undefined,
    aiFraudAnalysis: undefined,
  },

  // ── 3. Repair — pending senior approval. NOT YET AI-analyzed (demo target) ─
  {
    id: "CLM-2026-00188",
    policyNumber: "POL-AUTO-44219",
    claimantName: "Ramona Tate",
    type: "repair",
    status: "awaiting_info",
    priority: "medium",
    dateOfLoss: "2026-04-22",
    reportedAt: "2026-04-22T18:30:00Z",
    amountClaimed: 8400,
    vehicle: {
      year: 2021,
      make: "Toyota",
      model: "RAV4",
      color: "Magnetic Gray Metallic",
      bodyStyle: "SUV",
      vin: "2T3F1RFV8MW100001",
    },
    incident: {
      incidentType: "collision",
      location: "I-280 northbound, on-ramp at Highway 92",
      affectedArea: "Driver-side doors and front quarter panel",
      timeOfDay: "Around 6:15 PM",
      policeReportFiled: true,
      otherPartiesInvolved: true,
      narrative:
        "Insured was sideswiped by another vehicle while merging onto I-280. The other driver was cited and found at fault. Damage limited to the driver-side body panels.",
    },
    description:
      "Insured's 2021 Toyota RAV4 sideswiped while merging on I-280. Other driver cited and at-fault. Damage to driver-side doors and front quarter panel. Recommended for approval pending senior sign-off (claim < $10k threshold).",
    triageScore: 0,
    triageComputed: false,
    riskFlags: [],
    assignedTo: "Jordan Okafor",
    documents: [
      { id: "d040", name: "police_report_CLM188.pdf", type: "police_report", uploadedAt: "2026-04-22T19:00:00Z", sizeKb: 280 },
      { id: "d041", name: "driver_side_damage.jpg", type: "photo", uploadedAt: "2026-04-22T18:45:00Z", sizeKb: 3100, url: "/images/moderate5.jpeg" },
    ],
    timeline: [
      { id: "t040", at: "2026-04-22T18:30:00Z", actor: "system", kind: "status_change", summary: "Claim opened." },
      { id: "t044", at: "2026-04-25T14:30:00Z", actor: "Jordan Okafor", kind: "status_change", summary: "Submitted to Senior Adjuster for approval." },
    ],
  },

  // ── 4. THE FRAUD CASE — vehicle mismatch + inconsistent damage pattern ──
  {
    id: "CLM-2026-00199",
    policyNumber: "POL-AUTO-62890",
    claimantName: "Patricia Sundaram",
    type: "repair",
    status: "open",
    priority: "high",
    dateOfLoss: "2026-03-22",
    reportedAt: "2026-04-14T16:00:00Z",
    amountClaimed: 0,
    vehicle: {
      year: 2018,
      make: "Subaru",
      model: "Outback",
      color: "Crystal White Pearl",
      bodyStyle: "Wagon",
      vin: "4S4BSANC5J3300001",
    },
    incident: {
      incidentType: "vandalism",
      location: "Apartment complex parking lot, 451 Hayes St, San Francisco",
      affectedArea: "Windshield and left-side body panel",
      timeOfDay: "Overnight (claimed)",
      policeReportFiled: false,
      otherPartiesInvolved: false,
      narrative:
        "Claimant reports vehicle was vandalised overnight in apartment lot. No witnesses, no police report. Photos show damage that looks more consistent with a collision than vandalism.",
    },
    description:
      "Insured reports windshield replacement and left-side panel damage following alleged vandalism. No witnesses. No police report. 23-day reporting delay.",
    triageScore: 0,
    triageComputed: false,
    riskFlags: ["late_reporting", "missing_documents"],
    assignedTo: "Jordan Okafor",
    documents: [
      { id: "d070", name: "left_side_damage.jpg", type: "photo", uploadedAt: "2026-04-14T16:20:00Z", sizeKb: 1850, url: "/images/moderate2.jpg" },
    ],
    timeline: [
      { id: "t070", at: "2026-04-14T16:00:00Z", actor: "system", kind: "status_change", summary: "Claim opened. 23-day reporting delay auto-flagged." },
    ],
    aiAssessment: undefined,
    aiFraudAnalysis: undefined,
  },

  // ── 5. Hit-and-run — clean repair claim ─────────────────────────────────
  {
    id: "CLM-2026-00219",
    policyNumber: "POL-AUTO-53417",
    claimantName: "Elijah Reeves",
    type: "repair",
    status: "open",
    priority: "medium",
    dateOfLoss: "2026-05-04",
    reportedAt: "2026-05-04T19:00:00Z",
    amountClaimed: 0,
    vehicle: {
      year: 2020,
      make: "Mazda",
      model: "CX-5",
      color: "Soul Red Crystal",
      bodyStyle: "SUV",
      vin: "JM3KFBDM5L0500001",
    },
    incident: {
      incidentType: "hit_and_run",
      location: "Safeway parking lot, 1335 Webster St, Oakland",
      affectedArea: "Rear quarter panel and trunk",
      timeOfDay: "Around 5:45 PM",
      policeReportFiled: true,
      otherPartiesInvolved: true,
      narrative:
        "Insured returned from grocery shopping to find rear quarter panel and trunk damaged. No note left, no witnesses. Surveillance footage requested from store.",
    },
    description:
      "Insured's parked vehicle struck by unknown driver in a grocery store lot. No witnesses identified. Surveillance footage requested. Damage to rear quarter panel and trunk. Damage pattern consistent with parking-lot strike.",
    triageScore: 0,
    triageComputed: false,
    riskFlags: [],
    assignedTo: "Jordan Okafor",
    documents: [
      { id: "d100", name: "rear_damage.jpg", type: "photo", uploadedAt: "2026-05-04T19:30:00Z", sizeKb: 2200, url: "/images/minor4.JPEG" },
    ],
    timeline: [
      { id: "t100", at: "2026-05-04T19:00:00Z", actor: "system", kind: "status_change", summary: "Claim opened. Hit-and-run, uninsured motorist coverage applies." },
    ],
    aiAssessment: undefined,
    aiFraudAnalysis: undefined,
  },

  // ── 6. Closed clean claim — happy-path demo (no AI needed, already paid) ─
  {
    id: "CLM-2026-00091",
    policyNumber: "POL-AUTO-29104",
    claimantName: "Nora Fitzpatrick",
    type: "repair",
    status: "closed",
    priority: "low",
    dateOfLoss: "2026-02-10",
    reportedAt: "2026-02-11T08:00:00Z",
    amountClaimed: 3850,
    vehicle: {
      year: 2017,
      make: "Volkswagen",
      model: "Jetta",
      color: "Pure White",
      bodyStyle: "Sedan",
      vin: "3VWD17AJ1HM100001",
    },
    incident: {
      incidentType: "collision",
      location: "Trader Joe's parking lot, 555 9th St, San Francisco",
      affectedArea: "Front bumper, passenger side",
      timeOfDay: "Around 11:00 AM",
      policeReportFiled: false,
      otherPartiesInvolved: true,
      narrative:
        "Minor parking-lot fender bender. Other driver admitted fault on scene. Both parties exchanged information.",
    },
    description:
      "Minor parking-lot fender bender. Other driver admitted fault on scene; their insurer paid out under subrogation. Closed in 18 days with no complications.",
    triageScore: 18,
    triageComputed: true,
    riskFlags: [],
    assignedTo: "Jordan Okafor",
    documents: [
      { id: "d090", name: "shop_invoice.pdf", type: "estimate", uploadedAt: "2026-02-12T10:00:00Z", sizeKb: 70 },
      { id: "d091", name: "subrogation_letter.pdf", type: "correspondence", uploadedAt: "2026-02-20T14:00:00Z", sizeKb: 95 },
      { id: "d092", name: "front_damage.jpg", type: "photo", uploadedAt: "2026-02-11T08:30:00Z", sizeKb: 1200, url: "/images/minor1.JPEG" },
    ],
    timeline: [
      { id: "t090", at: "2026-02-11T08:00:00Z", actor: "system", kind: "status_change", summary: "Claim opened." },
      { id: "t093", at: "2026-02-28T09:30:00Z", actor: "system", kind: "status_change", summary: "Payment issued. Claim closed." },
    ],
  },
];

export function getClaimById(id: string): Claim | undefined {
  return mockClaims.find((c) => c.id === id);
}

export function getAllClaims(): Claim[] {
  return mockClaims;
}
