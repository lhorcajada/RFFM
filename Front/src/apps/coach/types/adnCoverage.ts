// Read-only ADN coverage/usage report — the content-board's left-panel data source for
// checkmarks (Zona/Subprincipio/Principio tri-state coverage) and usage badges (which sessions
// target a Sub-subprincipio). Distinct from AdnOptions (seasonPlan.ts), which feeds pickers, not
// a usage report. See openspec/changes/season-plan-content-board design.md Decision 5.

/** Tri-state coverage: a node is "completed" only when every one of its descendant
 * Sub-subprincipios is targeted by at least one session; "in-progress" when at least one is but
 * not all; "not-started" when none are (or it has no descendants). SubSubPrincipioCoverage
 * itself stays boolean (`isUsed`) — it's the atomic leaf this tri-state is derived from. */
export type CoverageStatus = "not-started" | "in-progress" | "completed";

export interface SessionUsage {
  sessionId: string;
  sessionName: string;
  date: string | null;
}

export interface SubSubPrincipioCoverage {
  subSubPrincipioId: string;
  isUsed: boolean;
  sessions: SessionUsage[];
}

export interface ZonaCoverage {
  zonaId: string;
  status: CoverageStatus;
}

export interface SubprincipioCoverage {
  subprincipioId: string;
  status: CoverageStatus;
}

export interface PrincipioCoverage {
  principioId: string;
  status: CoverageStatus;
}

export interface AdnCoverage {
  subSubPrincipios: SubSubPrincipioCoverage[];
  zonas: ZonaCoverage[];
  subprincipios: SubprincipioCoverage[];
  principios: PrincipioCoverage[];
}
