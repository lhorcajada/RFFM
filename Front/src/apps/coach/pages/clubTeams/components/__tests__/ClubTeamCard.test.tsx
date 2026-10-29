import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ClubTeamCard from "../ClubTeamCard";
import type { TeamResponse } from "../../../../services/teamService";

const baseTeam = {
  id: "t1",
  name: "Juvenil A",
  category: { id: 1, name: "Juvenil" },
  league: { id: 2, name: "Liga Norte" },
  club: { id: "c1", name: "FC Uno", country: { id: 1, name: "España", code: "ES" } },
  joinCode: "ABC123",
  canEdit: true,
  standardHalfDurationMinutes: null,
} as TeamResponse;

const onCopyCode = vi.fn();
const onEdit = vi.fn();
const onDelete = vi.fn();

function renderCard(team: TeamResponse = baseTeam, deleteDisabled = false) {
  return render(
    <MemoryRouter>
      <ClubTeamCard
        team={team}
        photoUrl={null}
        to="/coach/dashboard?teamId=t1&seasonId=s1"
        onCopyCode={onCopyCode}
        onEdit={onEdit}
        onDelete={onDelete}
        deleteDisabled={deleteDisabled}
      />
    </MemoryRouter>
  );
}

describe("ClubTeamCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el nombre y la liga con la categoría", () => {
    renderCard();
    expect(screen.getByText("Juvenil A")).toBeInTheDocument();
    expect(screen.getByText("Liga Norte · Juvenil")).toBeInTheDocument();
  });

  it("usa Sin liga y Sin categoría cuando faltan", () => {
    renderCard({ ...baseTeam, league: {}, category: { id: 0, name: "" } });
    expect(screen.getByText("Sin liga · Sin categoría")).toBeInTheDocument();
  });

  it("enlaza al dashboard del equipo", () => {
    renderCard();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/coach/dashboard?teamId=t1&seasonId=s1"
    );
  });

  it("muestra el código y lo copia", async () => {
    renderCard();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copiar código de equipo" }));
    expect(onCopyCode).toHaveBeenCalledWith("ABC123");
  });

  it("no muestra botón de copiar si el equipo no tiene código", () => {
    renderCard({ ...baseTeam, joinCode: null });
    expect(
      screen.queryByRole("button", { name: "Copiar código de equipo" })
    ).not.toBeInTheDocument();
  });

  it("llama a onEdit al pulsar editar", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Editar equipo" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("llama a onDelete al pulsar eliminar", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar equipo" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("deshabilita eliminar cuando deleteDisabled es verdadero", () => {
    renderCard(baseTeam, true);
    expect(screen.getByRole("button", { name: "Eliminar equipo" })).toBeDisabled();
  });
});
