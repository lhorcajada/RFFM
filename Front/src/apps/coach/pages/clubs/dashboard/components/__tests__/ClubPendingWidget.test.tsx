import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import ClubPendingWidget from "../ClubPendingWidget";

const renderWidget = (count: number) =>
  render(
    <MemoryRouter>
      <ClubPendingWidget clubId="club-1" pendingRequests={count} />
    </MemoryRouter>,
  );

describe("ClubPendingWidget", () => {
  it("muestra el contador y enlaza con las solicitudes de acceso", () => {
    renderWidget(3);

    const link = screen.getByRole("link", { name: /Solicitudes de acceso al club/ });
    expect(link).toHaveAttribute("href", "/club-join-requests?clubId=club-1");
    expect(link).toHaveTextContent("3");
  });

  it("indica que no hay nada pendiente", () => {
    renderWidget(0);

    expect(screen.getByText("Nada pendiente")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
