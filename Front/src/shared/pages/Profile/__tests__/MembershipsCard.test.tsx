import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/useFeaturePermission", () => ({
  useFeaturePermission: vi.fn(),
}));

import MembershipsCard from "../components/MembershipsCard";
import { useFeaturePermission } from "../../../hooks/useFeaturePermission";
import type { MyMemberships } from "../../../services/profile/profileService";

const memberships: MyMemberships = {
  clubs: [
    { clubId: "club-1", clubName: "CD Ejemplo", role: "Directive" },
    { clubId: "club-2", clubName: "CD Sin Equipo", role: "ClubMember" },
  ],
  teams: [
    {
      teamId: "team-1",
      teamName: "Infantil A",
      clubId: "club-1",
      clubName: "CD Ejemplo",
      role: "FamilyPlayer",
      linkedPlayerName: "Lucas Pérez",
    },
  ],
};

function renderCard(data: MyMemberships = memberships) {
  return render(
    <MemoryRouter>
      <MembershipsCard memberships={data} />
    </MemoryRouter>
  );
}

describe("MembershipsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeaturePermission).mockReturnValue({ hasAccess: false, loading: false });
  });

  it("enlaza cada equipo a su panel", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /infantil a/i })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=team-1"
    );
  });

  it("muestra el rol en español y el jugador vinculado", () => {
    renderCard();

    expect(screen.getByText("Familiar")).toBeInTheDocument();
    expect(screen.getByText("Directiva")).toBeInTheDocument();
    expect(screen.getByText("Jugador: Lucas Pérez")).toBeInTheDocument();
  });

  it("con permiso de gestión de clubes, enlaza el club a su página", () => {
    vi.mocked(useFeaturePermission).mockReturnValue({ hasAccess: true, loading: false });
    renderCard();

    expect(screen.getByRole("link", { name: /^cd ejemplo/i })).toHaveAttribute("href", "/coach/clubs/dashboard/club-1");
  });

  it("sin permiso, enlaza el club a su primer equipo", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /^cd ejemplo/i })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=team-1"
    );
  });

  it("sin permiso ni equipos en el club, lo muestra sin enlace", () => {
    renderCard();

    expect(screen.getByText("CD Sin Equipo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /cd sin equipo/i })).not.toBeInTheDocument();
  });

  it("muestra un aviso cuando no hay vinculaciones", () => {
    renderCard({ clubs: [], teams: [] });

    expect(screen.getByText("No estás vinculado a ningún club ni equipo")).toBeInTheDocument();
  });
});
