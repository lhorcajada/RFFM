import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SanctionCard from "../SanctionCard";
import type { SanctionRecord } from "../../../../services/teamplayerSanctionService";

const player = { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 };

function renderCard(sanction: Partial<SanctionRecord>, pendingAmount: number | null) {
  const full: SanctionRecord = {
    id: "s1",
    startDate: "2026-01-01",
    sanctionType: "Amonestación",
    description: null,
    estimatedEnd: null,
    endDate: null,
    isAutomatic: false,
    fine: null,
    ...sanction,
  };
  render(
    <SanctionCard
      player={player}
      sanction={full}
      status="Pending"
      pendingAmount={pendingAmount}
      showPlayerName
      canManage
      canDelete
      onEdit={vi.fn()}
      onLift={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

describe("SanctionCard — dinero y acciones", () => {
  it("muestra la barra de pago con el porcentaje pagado", () => {
    renderCard({ fine: 30, amountPaid: 10 }, 20);

    expect(screen.getByRole("progressbar", { name: /pagado/i })).toHaveAttribute("aria-valuenow", "33");
  });

  it("muestra el importe pendiente", () => {
    renderCard({ fine: 30, amountPaid: 10 }, 20);

    expect(screen.getByText("Pendiente 20 €")).toBeInTheDocument();
  });

  it("no muestra barra de pago si la sanción no tiene multa", () => {
    renderCard({ fine: null }, null);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("los botones de gestión muestran su texto", () => {
    renderCard({}, null);

    expect(screen.getByRole("button", { name: /^editar$/i })).toHaveTextContent("Editar");
    expect(screen.getByRole("button", { name: /^eliminar$/i })).toHaveTextContent("Eliminar");
  });
});
