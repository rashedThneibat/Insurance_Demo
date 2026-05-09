import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { mockClaims } from "./mockData";
import type {
  AIAssessment,
  AIFraudAnalysis,
  Claim,
  ClaimDocument,
  TimelineEvent,
} from "./types";

interface ClaimsContextValue {
  claims: Claim[];
  getClaimById: (id: string) => Claim | undefined;
  addClaim: (claim: Claim) => void;
  updateClaim: (id: string, updates: Partial<Omit<Claim, "id">>) => void;
  addDocument: (claimId: string, doc: ClaimDocument) => void;
  addTimelineEvent: (claimId: string, event: TimelineEvent) => void;
  saveAIAssessment: (claimId: string, assessment: AIAssessment) => void;
  saveFraudAnalysis: (claimId: string, analysis: AIFraudAnalysis) => void;
}

const ClaimsContext = createContext<ClaimsContextValue | null>(null);

export function ClaimsProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Claim[]>(mockClaims);

  const getClaimById = useCallback(
    (id: string) => claims.find((c) => c.id === id),
    [claims]
  );

  const addClaim = useCallback((claim: Claim) => {
    setClaims((prev) => [claim, ...prev]);
  }, []);

  const updateClaim = useCallback((id: string, updates: Partial<Omit<Claim, "id">>) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const addDocument = useCallback((claimId: string, doc: ClaimDocument) => {
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId ? { ...c, documents: [...c.documents, doc] } : c
      )
    );
  }, []);

  const addTimelineEvent = useCallback((claimId: string, event: TimelineEvent) => {
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId ? { ...c, timeline: [...c.timeline, event] } : c
      )
    );
  }, []);

  const saveAIAssessment = useCallback((claimId: string, assessment: AIAssessment) => {
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId
          ? {
              ...c,
              aiAssessment: assessment,
              // AI computes triage; mark as computed and adopt its score.
              triageScore: typeof assessment.triageScore === "number" ? assessment.triageScore : c.triageScore,
              triageComputed: true,
              // If reserve is unset, seed it with the AI midpoint so downstream UI has a number to show.
              amountClaimed:
                c.amountClaimed > 0
                  ? c.amountClaimed
                  : Math.round((assessment.estimatedTotalLow + assessment.estimatedTotalHigh) / 2),
              timeline: [
                ...c.timeline,
                {
                  id: `${claimId}-ai-${Date.now()}`,
                  at: assessment.generatedAt,
                  actor: `AI · ${assessment.model.split("/").pop()}`,
                  kind: "ai_suggestion",
                  summary: `AI damage estimate generated: $${assessment.estimatedTotalLow.toLocaleString()}–$${assessment.estimatedTotalHigh.toLocaleString()}, severity ${assessment.severity}, triage ${assessment.triageScore}/100, recommended action: ${assessment.recommendedAction.replace(/_/g, " ")}.`,
                },
              ],
            }
          : c
      )
    );
  }, []);

  const saveFraudAnalysis = useCallback((claimId: string, analysis: AIFraudAnalysis) => {
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId
          ? {
              ...c,
              aiFraudAnalysis: analysis,
              timeline: [
                ...c.timeline,
                {
                  id: `${claimId}-fraud-${Date.now()}`,
                  at: analysis.generatedAt,
                  actor: `AI · ${analysis.model.split("/").pop()}`,
                  kind: "ai_suggestion",
                  summary: `Fraud analysis: ${analysis.riskLevel} risk (score ${analysis.fraudScore}/100), ${analysis.flags.length} flag${analysis.flags.length === 1 ? "" : "s"}, recommended action: ${analysis.recommendedAction.replace(/_/g, " ")}.`,
                },
              ],
            }
          : c
      )
    );
  }, []);

  return (
    <ClaimsContext.Provider
      value={{
        claims,
        getClaimById,
        addClaim,
        updateClaim,
        addDocument,
        addTimelineEvent,
        saveAIAssessment,
        saveFraudAnalysis,
      }}
    >
      {children}
    </ClaimsContext.Provider>
  );
}

export function useClaims() {
  const ctx = useContext(ClaimsContext);
  if (!ctx) throw new Error("useClaims must be used within ClaimsProvider");
  return ctx;
}
