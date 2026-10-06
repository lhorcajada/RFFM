import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../PlayerSeasonsDetail", () => ({
  default: ({ playerId, season }: { playerId: string; season: string }) => (
    <div>detalle {playerId} {season}</div>
  ),
}));

import PlayerRow from "../PlayerRow";

describe("PlayerRow", () => {
  it("al desplegar muestra el detalle por temporadas del jugador", async () => {
    render(<PlayerRow player={{ id: 1, name: "PEREZ, JOSE", playerId: "1001" }} season="22" />);

    await userEvent.click(screen.getByRole("button", { name: /ver estadísticas/i }));

    expect(screen.getByText("detalle 1001 22")).toBeInTheDocument();
  });
});
