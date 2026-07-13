import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetSeasons = vi.fn();
const mockCreateSeason = vi.fn();
const mockUpdateSeason = vi.fn();
const mockDeleteSeason = vi.fn();
vi.mock("../../../../../../services/seasonService", () => ({
  default: {
    getSeasons: (...args: unknown[]) => mockGetSeasons(...args),
    createSeason: (...args: unknown[]) => mockCreateSeason(...args),
    updateSeason: (...args: unknown[]) => mockUpdateSeason(...args),
    deleteSeason: (...args: unknown[]) => mockDeleteSeason(...args),
  },
}));

const mockGetUserClubs = vi.fn();
vi.mock("../../../../../../services/clubService", () => ({
  default: {
    getUserClubs: (...args: unknown[]) => mockGetUserClubs(...args),
    createClubMultipart: vi.fn(),
  },
}));

vi.mock("../../../../../../services/countryService", () => ({
  default: { getCountries: vi.fn().mockResolvedValue([]) },
}));

import i18next from "../../../../../../../../shared/i18n/i18n";
import SeasonManager from "../SeasonManager";

describe("SeasonManager", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18next.changeLanguage("es");
    mockGetSeasons.mockResolvedValue([]);
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);
  });

  it("renderiza el listado y el botón 'Nueva temporada' aunque no haya clubId inicial", async () => {
    render(<SeasonManager clubId="" />);

    expect(screen.getByRole("button", { name: /nueva temporada/i })).toBeInTheDocument();
    expect(mockGetSeasons).not.toHaveBeenCalled();
  });

  it("usa el clubId inicial como club activo y carga sus temporadas", async () => {
    mockGetSeasons.mockResolvedValue([
      { id: "season-1", name: "Temporada 25/26", startDate: "2025-08-01", endDate: "2026-06-30", active: true },
    ]);

    render(<SeasonManager clubId="club-1" />);

    await waitFor(() => expect(mockGetSeasons).toHaveBeenCalledWith("club-1"));
    expect(await screen.findByText("Temporada 25/26")).toBeInTheDocument();
  });

  it("crea la temporada usando el club activo seleccionado en el formulario", async () => {
    mockCreateSeason.mockResolvedValue(undefined);

    render(<SeasonManager clubId="club-1" />);

    await userEvent.click(screen.getByRole("button", { name: /nueva temporada/i }));

    await waitFor(() => expect(screen.getByLabelText("Club")).toBeInTheDocument());

    const nameInput = screen.getByLabelText("Nombre");
    await userEvent.type(nameInput, "Temporada 26/27");

    await userEvent.click(screen.getByRole("button", { name: "Crear temporada" }));

    await waitFor(() =>
      expect(mockCreateSeason).toHaveBeenCalledWith(
        "Temporada 26/27",
        expect.any(Boolean),
        expect.any(String),
        expect.any(String),
        "club-1"
      )
    );
  });

  it("muestra el mensaje de error localizado cuando falla la creación", async () => {
    mockCreateSeason.mockRejectedValue({
      response: { status: 400, data: { code: "ValidationFailed" } },
    });

    render(<SeasonManager clubId="club-1" />);

    await userEvent.click(screen.getByRole("button", { name: /nueva temporada/i }));
    await waitFor(() => expect(screen.getByLabelText("Club")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Nombre"), "Temporada 26/27");
    await userEvent.click(screen.getByRole("button", { name: "Crear temporada" }));

    expect(
      await screen.findByText("Algunos datos del formulario no son válidos. Revisa los campos marcados.")
    ).toBeInTheDocument();
  });
});
