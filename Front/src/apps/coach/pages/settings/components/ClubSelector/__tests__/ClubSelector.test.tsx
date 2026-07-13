import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUserClubs = vi.fn();
const mockGetClubById = vi.fn();
const mockGetClubEmblem = vi.fn();
const mockDeleteClub = vi.fn();
const mockCreateClubMultipart = vi.fn();
vi.mock("../../../../../services/clubService", () => ({
  default: {
    getUserClubs: (...args: unknown[]) => mockGetUserClubs(...args),
    getClubById: (...args: unknown[]) => mockGetClubById(...args),
    getClubEmblem: (...args: unknown[]) => mockGetClubEmblem(...args),
    deleteClub: (...args: unknown[]) => mockDeleteClub(...args),
    createClubMultipart: (...args: unknown[]) => mockCreateClubMultipart(...args),
  },
}));

vi.mock("../../../../../services/countryService", () => ({
  default: { getCountries: vi.fn().mockResolvedValue([]) },
}));

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

import ClubSelector from "../ClubSelector";

describe("ClubSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(false);
    mockGetClubEmblem.mockRejectedValue(new Error("no emblem"));
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);
    mockGetClubById.mockResolvedValue({
      id: "club-1",
      name: "FC Uno",
      country: { name: "España" },
      invitationCode: "ABC123",
      emblemUrl: null,
    });
  });

  it("en escritorio muestra los clubes en una tabla", async () => {
    mockUseMediaQuery.mockReturnValue(false);
    const onChange = vi.fn();

    render(<ClubSelector initialValue={null} onChange={onChange} />);

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByText("España")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.queryByTestId("club-row-card-club-1")).not.toBeInTheDocument();
  });

  it("en móvil/tablet muestra los clubes como tarjetas con acciones funcionales", async () => {
    mockUseMediaQuery.mockReturnValue(true);
    const onChange = vi.fn();
    mockDeleteClub.mockResolvedValue(undefined);

    render(<ClubSelector initialValue={null} onChange={onChange} />);

    await screen.findByText("FC Uno");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const card = screen.getByTestId("club-row-card-club-1");
    expect(within(card).getByText("FC Uno")).toBeInTheDocument();
    expect(within(card).getByText("España")).toBeInTheDocument();
    expect(within(card).getByText("ABC123")).toBeInTheDocument();

    const toggle = within(card).getByLabelText("Marcar club preferido");
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith("club-1");

    const deleteButton = within(card).getByRole("button", { name: "Eliminar FC Uno" });
    await userEvent.click(deleteButton);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(mockDeleteClub).toHaveBeenCalledWith("club-1"));
  });
});
