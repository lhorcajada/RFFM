export type PlayerActions = {
  kind: "convocation" | "availability";
  onYes: () => void;
  onNo: () => void;
  busy: boolean;
};

export const PLAYER_ACTION_LABELS: Record<PlayerActions["kind"], { yes: string; no: string }> = {
  convocation: { yes: "Voy", no: "No voy" },
  availability: { yes: "Sí", no: "No" },
};
