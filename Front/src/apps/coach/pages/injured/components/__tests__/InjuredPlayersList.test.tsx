import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPlayersByTeam = vi.fn();
const mockGetTeamInjuries = vi.fn();
const mockUpdatePlayerInjury = vi.fn();
vi.mock("../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => mockGetPlayersByTeam(...args),
  },
  getTeamInjuries: (...args: unknown[]) => mockGetTeamInjuries(...args),
  createPlayerInjury: vi.fn(),
  updatePlayerInjury: (...args: unknown[]) => mockUpdatePlayerInjury(...args),
}));

import InjuredPlayersList from "../InjuredPlayersList";

const team = { id: "team-1", name: "Equipo 1" };

function renderList(isCoach: boolean, highlightedId?: string | null) {
  render(<InjuredPlayersList team={team} isCoach={isCoach} highlightedId={highlightedId} />);
}

describe("InjuredPlayersList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "tp-1", name: "Ana", lastName: "García", alias: "ana" },
    ]);
    mockGetTeamInjuries.mockResolvedValue([
      {
        teamPlayerId: "tp-1",
        injuries: [
          {
            id: "inj-1",
            startDate: "2026-01-01T00:00:00Z",
            injuryType: "Rotura fibrilar",
            endDate: null,
          },
        ],
      },
    ]);
  });

  it("nunca renderiza una tabla, usa tarjetas para mostrar las lesiones", async () => {
    renderList(true);

    await screen.findByText("Rotura fibrilar");

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("obtiene las lesiones de todo el equipo con una única llamada", async () => {
    renderList(true);

    await waitFor(() => expect(screen.getByText("Rotura fibrilar")).toBeInTheDocument());

    expect(mockGetTeamInjuries).toHaveBeenCalledTimes(1);
    expect(mockGetTeamInjuries).toHaveBeenCalledWith("team-1");
  });

  it("muestra un estado vacío cuando no hay lesiones registradas", async () => {
    mockGetTeamInjuries.mockResolvedValue([]);

    renderList(true);

    await waitFor(() =>
      expect(screen.getByText(/Sin lesiones registradas/i)).toBeInTheDocument()
    );
  });

  it("muestra las acciones de gestión solo para un coach", async () => {
    renderList(true);

    await screen.findByText("Rotura fibrilar");

    expect(
      screen.getByRole("button", { name: /añadir lesión/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^actualizar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dar de alta/i })).toBeInTheDocument();
  });

  it("oculta las acciones de gestión para roles distintos de coach", async () => {
    renderList(false);

    await screen.findByText("Rotura fibrilar");

    expect(
      screen.queryByRole("button", { name: /añadir lesión/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^actualizar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dar de alta/i })).not.toBeInTheDocument();
  });

  it("dar de alta abre un ConfirmDialog y solo llama al servicio al confirmar", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockUpdatePlayerInjury.mockResolvedValue({ id: "inj-1" });

    renderList(true);
    await screen.findByText("Rotura fibrilar");

    await userEvent.click(screen.getByRole("button", { name: /dar de alta/i }));

    expect(await screen.findByText(/¿dar de alta a ana garcía\?/i)).toBeInTheDocument();
    expect(mockUpdatePlayerInjury).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: /^dar de alta$/i }));

    await waitFor(() => expect(mockUpdatePlayerInjury).toHaveBeenCalledTimes(1));
  });

  it("highlights the injury card matching highlightedId", async () => {
    const styles = (await import("../InjuredPlayersList.module.css")).default as Record<
      string,
      string
    >;
    renderList(true, "inj-1");
    await screen.findByText("Rotura fibrilar");

    const card = document.getElementById("injury-inj-1")!;
    expect(card.className).toContain(styles.highlighted);
  });

  it("does not highlight any card when highlightedId is not set", async () => {
    const styles = (await import("../InjuredPlayersList.module.css")).default as Record<
      string,
      string
    >;
    renderList(true, null);
    await screen.findByText("Rotura fibrilar");

    const card = document.getElementById("injury-inj-1")!;
    expect(card.className).not.toContain(styles.highlighted);
  });
  describe("rediseño", () => {
    const injuries = [
      {
        id: "inj-active",
        startDate: "2026-10-08T00:00:00Z",
        injuryType: "Rotura fibrilar",
        estimatedRecovery: "2 semanas",
        endDate: null,
      },
      {
        id: "inj-free",
        startDate: "2026-10-10T00:00:00Z",
        injuryType: "Esguince",
        estimatedRecovery: "hasta nueva revisión",
        endDate: null,
      },
      {
        id: "inj-month",
        startDate: "2026-09-01T00:00:00Z",
        injuryType: "Contractura",
        endDate: "2026-10-05T00:00:00Z",
      },
      {
        id: "inj-old",
        startDate: "2026-06-01T00:00:00Z",
        injuryType: "Fractura de dedo",
        endDate: "2026-07-01T00:00:00Z",
      },
    ];

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-15T12:00:00Z") });
      mockGetPlayersByTeam.mockResolvedValue([
        {
          id: "tp-1",
          name: "Ana",
          lastName: "García",
          alias: "anita",
          dorsal: 9,
          position: "Delantera",
        },
      ]);
      mockGetTeamInjuries.mockResolvedValue([{ teamPlayerId: "tp-1", injuries }]);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("muestra el contador de lesiones activas", async () => {
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      expect(screen.getByTestId("injured-count-active")).toHaveTextContent("2");
    });

    it("muestra el contador de altas del mes actual", async () => {
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      expect(screen.getByTestId("injured-count-discharged")).toHaveTextContent("1");
    });

    it("lista por defecto solo las lesiones activas", async () => {
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      expect(screen.getByText("Esguince")).toBeInTheDocument();
      expect(screen.queryByText("Contractura")).not.toBeInTheDocument();
      expect(screen.queryByText("Fractura de dedo")).not.toBeInTheDocument();
    });

    it("el filtro Historial lista solo las lesiones con alta", async () => {
      const { default: userEvent } = await import("@testing-library/user-event");
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      await userEvent.click(screen.getByRole("button", { name: /^historial$/i }));

      expect(screen.getByText("Contractura")).toBeInTheDocument();
      expect(screen.getByText("Fractura de dedo")).toBeInTheDocument();
      expect(screen.queryByText("Rotura fibrilar")).not.toBeInTheDocument();
    });

    it("marca el filtro seleccionado con aria-pressed", async () => {
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      expect(screen.getByRole("button", { name: /^activas$/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByRole("button", { name: /^historial$/i })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });

    it("muestra un estado vacío propio cuando no hay lesiones activas", async () => {
      mockGetTeamInjuries.mockResolvedValue([
        { teamPlayerId: "tp-1", injuries: [injuries[3]] },
      ]);
      renderList(true);

      expect(await screen.findByText(/sin lesiones activas/i)).toBeInTheDocument();
    });

    it("muestra un estado vacío propio cuando no hay historial", async () => {
      const { default: userEvent } = await import("@testing-library/user-event");
      mockGetTeamInjuries.mockResolvedValue([
        { teamPlayerId: "tp-1", injuries: [injuries[0]] },
      ]);
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      await userEvent.click(screen.getByRole("button", { name: /^historial$/i }));

      expect(screen.getByText(/sin historial de lesiones/i)).toBeInTheDocument();
    });

    it("muestra dorsal, demarcación, alias y el chip Activa en la tarjeta", async () => {
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      const card = within(document.getElementById("injury-inj-active")!);
      expect(card.getByText("9")).toBeInTheDocument();
      expect(card.getByText("Ana García")).toBeInTheDocument();
      expect(card.getByText(/Delantera/)).toBeInTheDocument();
      expect(card.getByText(/anita/)).toBeInTheDocument();
      expect(card.getByText("Activa")).toBeInTheDocument();
      expect(card.getByText(/Rec\.: 2 semanas/)).toBeInTheDocument();
    });

    it("muestra la fecha de alta y el chip Alta en el historial", async () => {
      const { default: userEvent } = await import("@testing-library/user-event");
      renderList(true);
      await screen.findByText("Rotura fibrilar");
      await userEvent.click(screen.getByRole("button", { name: /^historial$/i }));

      const card = within(document.getElementById("injury-inj-month")!);
      expect(card.getByText("Alta")).toBeInTheDocument();
      expect(card.getByText(/Alta:.*5\/10\/2026/)).toBeInTheDocument();
    });

    it("muestra la barra de recuperación cuando la estimación es interpretable", async () => {
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      const card = within(document.getElementById("injury-inj-active")!);
      expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "54");
      expect(card.getByText(/Recuperación 54 %/)).toBeInTheDocument();
    });

    it("omite la barra de recuperación si la estimación es texto libre", async () => {
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      const card = within(document.getElementById("injury-inj-free")!);
      expect(card.getByText(/Rec\.: hasta nueva revisión/)).toBeInTheDocument();
      expect(card.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("el botón Actualizar abre el diálogo de edición de la lesión", async () => {
      const { default: userEvent } = await import("@testing-library/user-event");
      renderList(true);
      await screen.findByText("Rotura fibrilar");

      const card = within(document.getElementById("injury-inj-active")!);
      await userEvent.click(card.getByRole("button", { name: /^actualizar$/i }));

      expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });

    it("no ofrece Dar de alta en lesiones ya dadas de alta", async () => {
      const { default: userEvent } = await import("@testing-library/user-event");
      renderList(true);
      await screen.findByText("Rotura fibrilar");
      await userEvent.click(screen.getByRole("button", { name: /^historial$/i }));

      const card = within(document.getElementById("injury-inj-month")!);
      expect(card.getByRole("button", { name: /^actualizar$/i })).toBeInTheDocument();
      expect(card.queryByRole("button", { name: /dar de alta/i })).not.toBeInTheDocument();
    });
  });
});
