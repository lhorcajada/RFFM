import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SanctionCard from "../SanctionCard";
import type { SanctionRecord } from "../../../../services/teamplayerSanctionService";

const player = { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 };

function baseSanction(overrides: Partial<SanctionRecord> = {}): SanctionRecord {
  return {
    id: "s1",
    startDate: "2026-01-01",
    sanctionType: "Amonestación",
    description: null,
    estimatedEnd: null,
    endDate: null,
    isAutomatic: false,
    fine: null,
    ...overrides,
  };
}

function renderCard(overrides: Partial<React.ComponentProps<typeof SanctionCard>> = {}) {
  const props: React.ComponentProps<typeof SanctionCard> = {
    player,
    sanction: baseSanction(),
    status: "Pending",
    pendingAmount: null,
    showPlayerName: true,
    canManage: true,
    canDelete: true,
    onEdit: vi.fn(),
    onLift: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<SanctionCard {...props} />);
  return props;
}

describe("SanctionCard", () => {
  it("shows the player name and alias when showPlayerName is true", () => {
    renderCard({ showPlayerName: true });
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText(/Juanito/)).toBeInTheDocument();
  });

  it("hides the player name when showPlayerName is false", () => {
    renderCard({ showPlayerName: false });
    expect(screen.queryByText("Juan Pérez")).not.toBeInTheDocument();
  });

  it("shows an economic icon when the sanction has a fine", () => {
    renderCard({ sanction: baseSanction({ fine: 50 }) });
    expect(screen.getByTestId("EuroIcon")).toBeInTheDocument();
  });

  it("does not show the economic icon when there is no fine", () => {
    renderCard({ sanction: baseSanction({ fine: null }) });
    expect(screen.queryByTestId("EuroIcon")).not.toBeInTheDocument();
  });

  it("shows a sportive icon when the sanction has a sportive punishment", () => {
    renderCard({
      sanction: baseSanction({ sportivePunishmentType: "Deconvocation" }),
    });
    expect(screen.getByTestId("SportsSoccerIcon")).toBeInTheDocument();
  });

  it("does not show the sportive icon for a plain internal-discipline sanction", () => {
    renderCard({ sanction: baseSanction() });
    expect(screen.queryByTestId("SportsSoccerIcon")).not.toBeInTheDocument();
  });

  it("shows both icons when the sanction is both economic and sportive", () => {
    renderCard({
      sanction: baseSanction({ fine: 30, sportivePunishmentType: "MinutesLimit", minutesLimit: 20 }),
    });
    expect(screen.getByTestId("EuroIcon")).toBeInTheDocument();
    expect(screen.getByTestId("SportsSoccerIcon")).toBeInTheDocument();
  });

  it("shows the Pendiente chip for a pending sanction", () => {
    renderCard({ status: "Pending" });
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("shows Cumplida for a fulfilled sanction", () => {
    renderCard({ status: "Fulfilled", sanction: baseSanction({ endDate: "2026-02-01" }) });
    expect(screen.getByText("Cumplida")).toBeInTheDocument();
  });

  it("hides management actions when canManage is false", () => {
    renderCard({ canManage: false });
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /levantar sanción/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^eliminar$/i })).not.toBeInTheDocument();
  });

  it("calls onEdit, onLift and onDelete when the corresponding buttons are clicked", async () => {
    const props = renderCard({ canManage: true, status: "Pending", canDelete: true });

    await userEvent.click(screen.getByRole("button", { name: /^editar$/i }));
    expect(props.onEdit).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /levantar sanción/i }));
    expect(props.onLift).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it("disables the delete button when canDelete is false", () => {
    renderCard({ canManage: true, canDelete: false });
    expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeDisabled();
  });

  it("does not show the 'Levantar sanción' button for an already fulfilled sanction", () => {
    renderCard({ canManage: true, status: "Fulfilled", sanction: baseSanction({ endDate: "2026-02-01" }) });
    expect(screen.queryByRole("button", { name: /levantar sanción/i })).not.toBeInTheDocument();
  });
});
