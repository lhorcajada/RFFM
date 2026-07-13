import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

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

import SeasonEditorForm, { type SeasonFormState } from "../SeasonEditorForm";

function buildForm(overrides: Partial<SeasonFormState> = {}): SeasonFormState {
  return {
    name: "",
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    isActive: true,
    ...overrides,
  };
}

describe("SeasonEditorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserClubs.mockResolvedValue([]);
  });

  it("muestra el selector de club al crear una temporada", async () => {
    render(
      <SeasonEditorForm
        form={buildForm()}
        isEditing={false}
        clubId=""
        saving={false}
        onChange={vi.fn()}
        onClubIdChange={vi.fn()}
        onReset={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Club")).toBeInTheDocument());
  });

  it("no muestra el selector de club al editar una temporada", async () => {
    render(
      <SeasonEditorForm
        form={buildForm({ name: "Temporada 25/26" })}
        isEditing
        clubId="club-1"
        saving={false}
        onChange={vi.fn()}
        onClubIdChange={vi.fn()}
        onReset={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Club")).not.toBeInTheDocument();
  });

  it("deshabilita 'Crear temporada' si no hay club seleccionado", async () => {
    render(
      <SeasonEditorForm
        form={buildForm({ name: "Temporada 25/26" })}
        isEditing={false}
        clubId=""
        saving={false}
        onChange={vi.fn()}
        onClubIdChange={vi.fn()}
        onReset={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Club")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Crear temporada" })).toBeDisabled();
  });

  it("habilita 'Crear temporada' cuando hay club y nombre", async () => {
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);
    render(
      <SeasonEditorForm
        form={buildForm({ name: "Temporada 25/26" })}
        isEditing={false}
        clubId="club-1"
        saving={false}
        onChange={vi.fn()}
        onClubIdChange={vi.fn()}
        onReset={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Club")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Crear temporada" })).toBeEnabled();
  });
});
