import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayerSessionListItem } from "../../../../../services/playerTrackingService";

const useSessionDetailMock = vi.fn();
vi.mock("../../../hooks/useSessionDetail", () => ({
  useSessionDetail: (id: string | null) => useSessionDetailMock(id),
}));

const getSessionEvaluationMock = vi.fn();
vi.mock("../../../../../services/playerTrackingService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../services/playerTrackingService")>()),
  getSessionEvaluation: (...args: unknown[]) => getSessionEvaluationMock(...args),
}));

vi.mock("../SessionEvaluationForm", () => ({
  default: ({ session, initial }: { session: PlayerSessionListItem; initial: { id: string } | null }) => (
    <div>{`formulario:${session.sessionId}:${initial ? initial.id : "nuevo"}`}</div>
  ),
}));

import SessionEvaluationDialog from "../SessionEvaluationDialog";

function item(overrides: Partial<PlayerSessionListItem>): PlayerSessionListItem {
  return {
    sessionId: "ses-1",
    name: "Sesión",
    date: "2026-10-01",
    isHeld: true,
    hasCalendarEvent: true,
    assistanceTypeId: 1,
    evaluation: null,
    ...overrides,
  };
}

const SESSIONS = [
  item({ sessionId: "future", name: "Futura", date: "2026-10-09", isHeld: false }),
  item({ sessionId: "pending", name: "Pendiente", date: "2026-10-01" }),
  item({
    sessionId: "done",
    name: "Valorada",
    date: "2026-09-28",
    evaluation: { achieved: 1, partial: 0, notAchieved: 0, updatedAt: "2026-09-28T20:00:00Z" },
  }),
];

function renderDialog(initialSessionId: string | null = null) {
  render(
    <SessionEvaluationDialog
      open
      teamId="team-1"
      teamPlayerId="tp-1"
      sessions={SESSIONS}
      initialSessionId={initialSessionId}
      saving={false}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
}

describe("SessionEvaluationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionDetailMock.mockReturnValue({ detail: null, loading: false });
  });

  it("sin sesión inicial ofrece solo las sesiones celebradas sin seguimiento", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("combobox", { name: /sesión/i }));

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["01/10 · Pendiente"]);
  });

  it("al elegir la sesión muestra su formulario de valoración", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("combobox", { name: /sesión/i }));
    await userEvent.click(await screen.findByRole("option", { name: "01/10 · Pendiente" }));

    expect(await screen.findByText("formulario:pending:nuevo")).toBeInTheDocument();
    expect(useSessionDetailMock).toHaveBeenLastCalledWith("pending");
  });

  it("con una sesión ya valorada carga su seguimiento para editarlo, sin selector", async () => {
    getSessionEvaluationMock.mockResolvedValue({ id: "ev-9" });

    renderDialog("done");

    expect(screen.queryByRole("combobox", { name: /sesión/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("formulario:done:ev-9")).toBeInTheDocument());
    expect(getSessionEvaluationMock).toHaveBeenCalledWith("team-1", "tp-1", "done");
  });
});
