import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerDocumentStatusChip from "../PlayerDocumentStatusChip";
import type { PlayerDocumentStatus } from "../../../../apps/coach/services/playerDocumentService";

describe("PlayerDocumentStatusChip", () => {
  it("renders Pending status with correct label", () => {
    render(<PlayerDocumentStatusChip status="Pending" />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("renders Delivered status with correct label", () => {
    render(<PlayerDocumentStatusChip status="Delivered" />);
    expect(screen.getByText("Entregado")).toBeInTheDocument();
  });

  it("renders Approved status with correct label", () => {
    render(<PlayerDocumentStatusChip status="Approved" />);
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });

  it("renders Rejected status with correct label", () => {
    render(<PlayerDocumentStatusChip status="Rejected" />);
    expect(screen.getByText("Rechazado")).toBeInTheDocument();
  });
});
