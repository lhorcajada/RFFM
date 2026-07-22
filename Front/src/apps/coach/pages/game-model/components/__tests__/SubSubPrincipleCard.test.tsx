import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SubSubPrincipleCard from "../SubSubPrincipleCard";
import styles from "../SubSubPrincipleCard.module.css";
import type { SubSubPrinciple } from "../../../../types/gameModel";

const ssp: SubSubPrinciple = {
  id: 1,
  order: 1,
  name: "Sub-subprincipio de prueba",
  action: "Acción de prueba",
  essentialSkills: [],
};

describe("SubSubPrincipleCard", () => {
  it("el botón de expandir lleva la clase de touch-target", () => {
    render(
      <MemoryRouter>
        <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="" />
      </MemoryRouter>
    );
    const expandBtn = screen.getByRole("button");
    expect(expandBtn.className).toContain(styles.expandBtn);
  });

  it("el título aplica la clase con ajuste de línea para textos largos", () => {
    render(
      <MemoryRouter>
        <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="" />
      </MemoryRouter>
    );
    expect(screen.getByText(/Sub-subprincipio de prueba/)).toHaveClass(styles.title);
  });
});
