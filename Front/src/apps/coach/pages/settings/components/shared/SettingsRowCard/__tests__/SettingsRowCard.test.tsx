import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SettingsRowCard from "../SettingsRowCard";

describe("SettingsRowCard", () => {
  it("renderiza el título, los campos etiqueta/valor y las acciones", () => {
    render(
      <SettingsRowCard
        title="FC Uno"
        fields={[
          { label: "País", value: "España" },
          { label: "Código", value: "ABC123" },
        ]}
        actions={<button>Eliminar</button>}
        data-testid="row-card-1"
      />
    );

    const card = screen.getByTestId("row-card-1");
    expect(card).toBeInTheDocument();
    expect(screen.getByText("FC Uno")).toBeInTheDocument();
    expect(screen.getByText("País")).toBeInTheDocument();
    expect(screen.getByText("España")).toBeInTheDocument();
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  it("expone el título como aria-label del grupo cuando es texto plano", () => {
    render(<SettingsRowCard title="Temporada 25/26" fields={[]} data-testid="row-card-2" />);

    expect(screen.getByRole("group", { name: "Temporada 25/26" })).toBeInTheDocument();
  });
});
