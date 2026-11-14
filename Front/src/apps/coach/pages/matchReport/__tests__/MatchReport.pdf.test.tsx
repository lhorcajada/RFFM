import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/matchReportService", () => ({
  getMatchReport: vi.fn(),
  getEventFederationActa: vi.fn(),
  getFederationActaByCode: vi.fn(),
}));
vi.mock("../../../../../shared/services/pdfService", () => ({
  exportElementToPdf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/acta/ActaContent/ActaContent", () => ({
  default: ({ acta }: { acta: { equipo_local?: string } }) => <div>Acta RFFM {acta.equipo_local}</div>,
}));
vi.mock("../../../../federation/components/players/PlayerQuickViewDialog/PlayerQuickViewDialog", () => ({
  default: () => null,
}));

import MatchReport from "../MatchReport";
import {
  getEventFederationActa,
  getFederationActaByCode,
  getMatchReport,
  type MatchReport as MatchReportType,
} from "../../../services/matchReportService";
import { exportElementToPdf } from "../../../../../shared/services/pdfService";

const acta = { equipo_local: "CD Local", equipo_visitante: "CF Visitante", goles_local: "1", goles_visitante: "0", fecha: "04-10-2026" };

const live: MatchReportType["live"] = {
  formationName: "4-4-2",
  matchDurationMinutes: 90,
  starters: [],
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
    localGoals: "1",
    visitorGoals: "0",
    matchCategory: "League",
    hasLiveReport: false,
    hasFederationReport: true,
    live: null,
    ...overrides,
  };
}

function renderPage(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <MatchReport />
    </MemoryRouter>,
  );
}

describe("MatchReport — descarga del acta en PDF desde la barra de botones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFederationActaByCode).mockResolvedValue(acta);
    vi.mocked(getEventFederationActa).mockResolvedValue(acta);
  });

  it("en un acta de federación por código, el botón está en la barra y exporta el acta", async () => {
    renderPage("/coach/match-report?codActa=123&season=21");

    await userEvent.click(await screen.findByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => expect(exportElementToPdf).toHaveBeenCalledTimes(1));
    const [element, fileName] = vi.mocked(exportElementToPdf).mock.calls[0];
    expect(element).toHaveTextContent("Acta RFFM CD Local");
    expect(fileName).toBe("Acta CD Local - CF Visitante.pdf");
  });

  it("en un partido propio sin acta en directo, el botón está en la barra y exporta el acta", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(report({ hasLiveReport: false }));
    renderPage("/coach/match-report?eventId=e1&teamId=t1");

    await userEvent.click(await screen.findByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => expect(exportElementToPdf).toHaveBeenCalledTimes(1));
    expect(vi.mocked(exportElementToPdf).mock.calls[0][1]).toBe("Acta CD Local - CF Visitante.pdf");
  });

  it("con las dos pestañas, el botón solo aparece mientras se ve la pestaña de Federación", async () => {
    vi.mocked(getMatchReport).mockResolvedValue(report({ hasLiveReport: true, live }));
    renderPage("/coach/match-report?eventId=e1&teamId=t1");
    expect(await screen.findByRole("button", { name: /descargar pdf/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Partido en directo" }));

    expect(screen.queryByRole("button", { name: /descargar pdf/i })).not.toBeInTheDocument();
  });

  it("si falla la generación del PDF avisa con un mensaje de error", async () => {
    vi.mocked(exportElementToPdf).mockRejectedValueOnce(new Error("boom"));
    const messages: string[] = [];
    const listener = (e: Event) => messages.push((e as CustomEvent<{ message: string }>).detail.message);
    window.addEventListener("rffm.show_snackbar", listener);
    renderPage("/coach/match-report?codActa=123");

    await userEvent.click(await screen.findByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => expect(messages).toContain("No se ha podido generar el PDF del acta."));
    window.removeEventListener("rffm.show_snackbar", listener);
  });
});
