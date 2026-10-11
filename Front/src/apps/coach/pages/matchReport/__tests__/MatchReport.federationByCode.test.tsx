import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/matchReportService", () => ({
  getMatchReport: vi.fn(),
  getEventFederationActa: vi.fn(),
  getFederationActaByCode: vi.fn(),
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/acta/ActaContent/ActaContent", () => ({
  default: ({
    acta,
    onPlayerClick,
  }: {
    acta: { equipo_local?: string };
    onPlayerClick?: (code: string, name?: string) => void;
  }) => (
    <div>
      Acta RFFM {acta.equipo_local}
      <button onClick={() => onPlayerClick?.("J77", "Leo Ajeno")}>Leo Ajeno</button>
    </div>
  ),
}));
vi.mock("../../../../federation/components/players/PlayerQuickViewDialog/PlayerQuickViewDialog", () => ({
  default: ({ open, playerCode, playerName, seasonId }: { open: boolean; playerCode: string | null; playerName?: string | null; seasonId?: string }) =>
    open ? <div role="dialog">Ficha de {playerName} ({playerCode}) temporada {seasonId ?? "actual"}</div> : null,
}));

import MatchReport from "../MatchReport";
import { getFederationActaByCode, getMatchReport } from "../../../services/matchReportService";

const acta = {
  equipo_local: "CD Ajeno",
  equipo_visitante: "UD Lejano",
  goles_local: "3",
  goles_visitante: "0",
  fecha: "04-10-2026",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/match-report?codActa=123&teamId=t1&season=21&competition=555&group=777"]}>
      <MatchReport />
    </MemoryRouter>,
  );
}

describe("MatchReport - acta de federación por código de acta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFederationActaByCode).mockResolvedValue(acta);
  });

  it("carga el acta de federación con la temporada, competición y grupo de la URL", async () => {
    renderPage();

    expect(await screen.findByText("Acta RFFM CD Ajeno")).toBeInTheDocument();
    expect(getFederationActaByCode).toHaveBeenCalledWith("123", { season: "21", competition: "555", group: "777" });
  });

  it("no pide el acta del coach, que solo existe para los partidos del equipo", async () => {
    renderPage();

    await screen.findByText("Acta RFFM CD Ajeno");
    expect(getMatchReport).not.toHaveBeenCalled();
  });

  it("muestra los equipos y el marcador del acta en la cabecera", async () => {
    renderPage();

    expect(await screen.findByText("3 - 0")).toBeInTheDocument();
    expect(screen.getByText("CD Ajeno")).toBeInTheDocument();
    expect(screen.getByText("UD Lejano")).toBeInTheDocument();
  });

  it("no muestra pestañas", async () => {
    renderPage();

    await screen.findByText("Acta RFFM CD Ajeno");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("si el acta no se puede cargar avisa de que no hay acta disponible", async () => {
    vi.mocked(getFederationActaByCode).mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByText("No hay acta disponible para este partido.")).toBeInTheDocument();
  });

  it("al pulsar un jugador del acta abre su ficha estadística de la temporada del acta", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Leo Ajeno" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Ficha de Leo Ajeno (J77) temporada 21");
  });
});
