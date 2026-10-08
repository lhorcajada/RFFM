import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/matchReportService", () => ({
  getMatchReport: vi.fn(),
  getEventFederationActa: vi.fn(),
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/acta/ActaContent/ActaContent", () => ({
  default: ({ acta }: { acta: { equipo_local?: string } }) => <div>Acta RFFM {acta.equipo_local}</div>,
}));

import MatchReport from "../MatchReport";
import { getMatchReport, getEventFederationActa, type MatchReport as MatchReportType } from "../../../services/matchReportService";

const live: MatchReportType["live"] = {
  formationName: "4-4-2",
  matchDurationMinutes: 90,
  starters: [{ teamPlayerId: "p1", name: "Hugo", dorsal: 9, photoUrl: null, slotIndex: 9, minutesPlayed: 90 }],
  bench: [],
  goals: [],
  cards: [],
  substitutionWindows: [],
};

function report(overrides: Partial<MatchReportType>): MatchReportType {
  return {
    eventId: "e1",
    teamName: "Mi Equipo",
    teamPhotoUrl: null,
    rivalName: "Rival FC",
    rivalPhotoUrl: null,
    isHomeMatch: true,
    date: "2026-10-04T10:00:00Z",
    localGoals: "2",
    visitorGoals: "1",
    matchCategory: "League",
    hasLiveReport: true,
    hasFederationReport: true,
    live,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/match-report?eventId=e1&teamId=t1"]}>
      <MatchReport />
    </MemoryRouter>,
  );
}

describe("MatchReport - pestañas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEventFederationActa).mockResolvedValue({ equipo_local: "Mi Equipo" });
  });

  it("con acta de federación y partido en directo muestra ambas pestañas con Federación seleccionada", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(report({}));

    renderPage();

    const federationTab = await screen.findByRole("tab", { name: "Federación" });
    expect(federationTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Partido en directo" })).toBeInTheDocument();
    expect(await screen.findByText("Acta RFFM Mi Equipo")).toBeInTheDocument();
  });

  it("al cambiar a la pestaña Partido en directo muestra la alineación", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(report({}));
    renderPage();

    await userEvent.click(await screen.findByRole("tab", { name: "Partido en directo" }));

    expect(await screen.findByText("Titulares")).toBeInTheDocument();
  });

  it("en un amistoso con partido en directo no muestra pestañas ni pide el acta de federación", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(
      report({ matchCategory: "Friendly", hasFederationReport: false }),
    );

    renderPage();

    expect(await screen.findByText("Titulares")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(getEventFederationActa).not.toHaveBeenCalled();
  });

  it("si el acta de federación falla muestra un aviso y el partido en directo sigue disponible", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(report({}));
    vi.mocked(getEventFederationActa).mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByText("No se ha podido cargar el acta de federación.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Partido en directo" }));
    expect(await screen.findByText("Titulares")).toBeInTheDocument();
  });

  it("muestra el marcador del partido en la cabecera", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(report({}));

    renderPage();

    await waitFor(() => expect(screen.getByText("2 - 1")).toBeInTheDocument());
    expect(screen.getByText("Mi Equipo")).toBeInTheDocument();
    expect(screen.getByText("Rival FC")).toBeInTheDocument();
  });

  it("carga el escudo propio guardado en el almacenamiento a través de la API y el del rival tal cual", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(
      report({ teamPhotoUrl: "teams/mi-escudo.png", rivalPhotoUrl: "https://rffm.es/rival.png" }),
    );

    renderPage();

    const ownShield = await screen.findByAltText("Escudo de Mi Equipo");
    expect(ownShield.getAttribute("src")).toContain(
      `/api/catalog/team/photo?url=${encodeURIComponent("teams/mi-escudo.png")}`,
    );
    expect(screen.getByAltText("Escudo de Rival FC")).toHaveAttribute("src", "https://rffm.es/rival.png");
  });

  it("si el informe no se puede cargar muestra un error", async () => {
    vi.mocked(getMatchReport).mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByText("No se ha podido cargar el acta del partido.")).toBeInTheDocument();
  });
});
