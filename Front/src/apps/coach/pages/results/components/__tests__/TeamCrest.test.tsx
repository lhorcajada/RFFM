import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamCrest from "../TeamCrest";

describe("TeamCrest", () => {
  it("muestra el escudo resolviendo las rutas relativas de la RFFM", () => {
    render(<TeamCrest name="Rival UD" imageUrl="/escudos/rival.png" />);

    expect(screen.getByRole("img", { name: "Escudo de Rival UD" })).toHaveAttribute(
      "src",
      "https://www.rffm.es/escudos/rival.png",
    );
  });

  it("muestra las iniciales cuando no hay escudo", () => {
    render(<TeamCrest name="CF Los Pinos" imageUrl="" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("LP")).toBeInTheDocument();
  });
});
