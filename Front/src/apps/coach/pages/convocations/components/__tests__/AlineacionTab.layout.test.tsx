import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createRef } from "react";
import AlineacionTab from "../AlineacionTab";
import type { IdealLineupHandle, SquadPlayer } from "../../../squad/components/IdealLineup";

const saveIdealLineupMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([
    { id: "f1", name: "4-4-2" },
    { id: "f2", name: "4-3-3" },
  ]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue({
    id: "lineup-1",
    formationId: "f1",
    slots: [{ slotIndex: 0, teamPlayerId: "p1" }],
  }),
  saveIdealLineup: (...args: unknown[]) => saveIdealLineupMock(...args),
}));

const lineupPlayers: SquadPlayer[] = [
  { id: "p1", displayName: "Titular Uno", dorsal: 1, position: "Portero", readiness: 70, fatigue: 10 },
  { id: "p2", displayName: "Suplente Dos", dorsal: 2, position: "Defensa", competitiveness: 8, readiness: 50, fatigue: 20 },
];

function renderTab(props: Partial<React.ComponentProps<typeof AlineacionTab>> = {}) {
  const ref = createRef<IdealLineupHandle>();
  const utils = render(
    <MemoryRouter>
      <AlineacionTab
        mgmtEventId="event-1"
        lineupPlayers={lineupPlayers}
        lineupRef={ref}
        teamId="team-1"
        onSavingChange={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );
  return { ...utils, ref };
}

async function benchPanel() {
  const heading = await screen.findByText("Banquillo");
  return heading.closest("div")!.parentElement as HTMLElement;
}

describe("AlineacionTab - misma distribución que el partido en directo (avatares)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coloca al titular guardado en el campo y al resto en el banquillo", async () => {
    const { container } = renderTab();

    const bench = await benchPanel();
    await waitFor(() => expect(container.querySelector("[class*='fieldWrapper']")).not.toBeNull());
    const field = container.querySelector("[class*='fieldWrapper']") as HTMLElement;

    expect(within(field).getByText("Titular Uno")).toBeInTheDocument();
    expect(within(bench).getByText("Suplente Dos")).toBeInTheDocument();
    expect(within(bench).queryByText("Titular Uno")).not.toBeInTheDocument();
  });

  it("muestra el banquillo como avatares arrastrables, no como tarjetas con badges", async () => {
    renderTab();

    const bench = await benchPanel();
    const name = within(bench).getByText("Suplente Dos");
    expect(name.closest("[class*='dragHandle']")).not.toBeNull();
    expect(within(bench).queryByText(/Comp\.\s*8/)).not.toBeInTheDocument();
  });

  it("permite elegir el esquema con el selector 'Esquema'", async () => {
    renderTab();

    expect(await screen.findByRole("combobox", { name: /esquema/i })).toHaveTextContent("4-4-2");
  });

  it("desconvocar desde el avatar del banquillo invoca onDeconvoke", async () => {
    const onDeconvoke = vi.fn();
    renderTab({ onDeconvoke });

    const bench = await benchPanel();
    await userEvent.click(within(bench).getByRole("button", { name: "Desconvocar a Suplente Dos" }));

    expect(onDeconvoke).toHaveBeenCalledWith("p2");
  });

  it("guarda el esquema y los titulares a través de lineupRef", async () => {
    const { ref } = renderTab();
    await benchPanel();
    await waitFor(() => expect(ref.current).not.toBeNull());

    await act(async () => {
      await ref.current!.save();
    });

    expect(saveIdealLineupMock).toHaveBeenCalledWith("team-1", {
      formationId: "f1",
      seasonId: "event-1",
      slots: [{ slotIndex: 0, teamPlayerId: "p1" }],
    });
  });
});
