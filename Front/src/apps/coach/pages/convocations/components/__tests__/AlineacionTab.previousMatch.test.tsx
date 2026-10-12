import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createRef } from "react";
import AlineacionTab from "../AlineacionTab";
import type { IdealLineupHandle, SquadPlayer } from "../../../squad/components/IdealLineup";
import {
  getIdealLineup,
  getPreviousMatchLineup,
  saveIdealLineup,
} from "../../../../services/idealLineupService";

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([
    { id: "f1", name: "4-4-2" },
    { id: "f2", name: "4-3-3" },
    { id: "f3", name: "4-2-3-1" },
  ]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn(),
  getPreviousMatchLineup: vi.fn(),
  saveIdealLineup: vi.fn(),
}));

const INHERITED_NOTICE = /alineación inicial del partido anterior/i;

const lineupPlayers: SquadPlayer[] = [
  { id: "p1", displayName: "Titular Anterior", dorsal: 1, position: "Portero" },
  { id: "p2", displayName: "Suplente Dos", dorsal: 2, position: "Defensa" },
];

const savedLineup = { id: "lineup-1", formationId: "f1", slots: [{ slotIndex: 0, teamPlayerId: "p2" }] };
const previousMatchLineup = { formationId: "f2", slots: [{ slotIndex: 0, teamPlayerId: "p1" }] };

async function renderTab() {
  const ref = createRef<IdealLineupHandle>();
  const { container } = render(
    <MemoryRouter>
      <AlineacionTab
        mgmtEventId="event-1"
        lineupPlayers={lineupPlayers}
        lineupRef={ref}
        teamId="team-1"
        onSavingChange={() => {}}
      />
    </MemoryRouter>,
  );
  await screen.findByText("Banquillo");
  await waitFor(() => expect(container.querySelector("[class*='fieldWrapper']")).not.toBeNull());
  const field = container.querySelector("[class*='fieldWrapper']") as HTMLElement;
  return { ref, field };
}

describe("AlineacionTab - alineación del partido anterior por defecto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIdealLineup).mockResolvedValue(null);
    vi.mocked(getPreviousMatchLineup).mockResolvedValue(previousMatchLineup);
    vi.mocked(saveIdealLineup).mockResolvedValue(undefined);
  });

  it("sin alineación guardada coloca en el campo a los titulares del partido anterior", async () => {
    const { field } = await renderTab();

    expect(within(field).getByText("Titular Anterior")).toBeInTheDocument();
    expect(getPreviousMatchLineup).toHaveBeenCalledWith("team-1", "event-1");
  });

  it("sin alineación guardada usa el esquema del partido anterior", async () => {
    await renderTab();

    expect(screen.getByRole("combobox", { name: /esquema/i })).toHaveTextContent("4-3-3");
  });

  it("avisa de que la alineación viene del partido anterior y aún no está guardada", async () => {
    await renderTab();

    expect(screen.getByText(INHERITED_NOTICE)).toBeInTheDocument();
  });

  it("al guardar, guarda esa alineación para este partido y quita el aviso", async () => {
    const { ref } = await renderTab();

    await act(async () => {
      await ref.current!.save();
    });

    expect(saveIdealLineup).toHaveBeenCalledWith("team-1", {
      formationId: "f2",
      seasonId: "event-1",
      slots: [{ slotIndex: 0, teamPlayerId: "p1" }],
    });
    expect(screen.queryByText(INHERITED_NOTICE)).not.toBeInTheDocument();
  });

  it("si guardar falla, mantiene el aviso", async () => {
    vi.mocked(saveIdealLineup).mockRejectedValue(new Error("network"));
    const { ref } = await renderTab();

    await act(async () => {
      await ref.current!.save();
    });

    expect(screen.getByText(INHERITED_NOTICE)).toBeInTheDocument();
  });

  it("con alineación guardada usa la guardada y no consulta el partido anterior", async () => {
    vi.mocked(getIdealLineup).mockResolvedValue(savedLineup);

    const { field } = await renderTab();

    expect(within(field).getByText("Suplente Dos")).toBeInTheDocument();
    expect(within(field).queryByText("Titular Anterior")).not.toBeInTheDocument();
    expect(getPreviousMatchLineup).not.toHaveBeenCalled();
    expect(screen.queryByText(INHERITED_NOTICE)).not.toBeInTheDocument();
  });

  it("sin partido anterior deja el campo vacío con el esquema por defecto y sin aviso", async () => {
    vi.mocked(getPreviousMatchLineup).mockResolvedValue(null);

    const { field } = await renderTab();

    expect(within(field).queryByText("Titular Anterior")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /esquema/i })).toHaveTextContent("4-2-3-1");
    expect(screen.queryByText(INHERITED_NOTICE)).not.toBeInTheDocument();
  });

  it("si falla la consulta del partido anterior, el editor sigue funcionando vacío", async () => {
    vi.mocked(getPreviousMatchLineup).mockRejectedValue(new Error("network"));

    const { field } = await renderTab();

    expect(within(field).queryByText("Titular Anterior")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /esquema/i })).toHaveTextContent("4-2-3-1");
  });

  it("si el esquema del partido anterior ya no existe, usa el esquema por defecto", async () => {
    vi.mocked(getPreviousMatchLineup).mockResolvedValue({ ...previousMatchLineup, formationId: "gone" });

    await renderTab();

    expect(screen.getByRole("combobox", { name: /esquema/i })).toHaveTextContent("4-2-3-1");
  });
});
