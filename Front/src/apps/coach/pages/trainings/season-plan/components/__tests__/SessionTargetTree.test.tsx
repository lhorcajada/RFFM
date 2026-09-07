import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SessionTargetTree from "../SessionTargetTree";
import type { SessionTargetDetail } from "../../../../types/training";

function buildTarget(overrides: Partial<SessionTargetDetail> = {}): SessionTargetDetail {
  return {
    subSubPrincipioId: "ssp-1",
    rol: "Central",
    numero: "1.1.1",
    subprincipioId: "sub-1",
    subprincipioTitulo: "Presión alta",
    zonaId: null,
    zonaLabel: null,
    principioId: "principle-1",
    principioTitulo: "Defensa organizada",
    gameMomentId: 1,
    gameMomentName: "Fase defensiva",
    ...overrides,
  };
}

describe("SessionTargetTree — jerarquía agrupada", () => {
  it("muestra Fase/Principio/Subprincipio una sola vez cuando dos targets los comparten", () => {
    render(
      <SessionTargetTree
        targets={[
          buildTarget({ subSubPrincipioId: "ssp-1", rol: "Central", numero: "1.1.1" }),
          buildTarget({ subSubPrincipioId: "ssp-2", rol: "Lateral", numero: "1.1.2" }),
        ]}
        textoMap={new Map()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getAllByText("Fase defensiva")).toHaveLength(1);
    expect(screen.getAllByText("Defensa organizada")).toHaveLength(1);
    expect(screen.getAllByText(/Presión alta/)).toHaveLength(1);
    expect(screen.getByText(/Central/)).toBeInTheDocument();
    expect(screen.getByText(/Lateral/)).toBeInTheDocument();
  });

  it("muestra la Zona como una rama propia del árbol cuando el target tiene Zona", () => {
    render(
      <SessionTargetTree
        targets={[buildTarget({ zonaId: "zona-1", zonaLabel: "Ataque del centro" })]}
        textoMap={new Map()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText("Ataque del centro")).toBeInTheDocument();
  });

  it("omite la rama de Zona cuando el target no tiene Zona", () => {
    render(<SessionTargetTree targets={[buildTarget()]} textoMap={new Map()} onRemove={vi.fn()} />);

    expect(screen.queryByText("Ataque del centro")).not.toBeInTheDocument();
  });

  it("muestra siempre visible la descripción del sub-subprincipio resuelta del mapa de textos", () => {
    render(
      <SessionTargetTree
        targets={[buildTarget()]}
        textoMap={new Map([["ssp-1", "Cierra el pasillo interior."]])}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText("Cierra el pasillo interior.")).toBeInTheDocument();
  });

  it("pulsar el botón de eliminar de una hoja llama a onRemove con su subSubPrincipioId", async () => {
    const onRemove = vi.fn();
    render(
      <SessionTargetTree
        targets={[
          buildTarget({ subSubPrincipioId: "ssp-1", rol: "Central" }),
          buildTarget({ subSubPrincipioId: "ssp-2", rol: "Lateral", numero: "1.1.2" }),
        ]}
        textoMap={new Map()}
        onRemove={onRemove}
      />
    );

    const leaf = screen.getByText(/Lateral/).closest("[data-testid]") as HTMLElement;
    await userEvent.click(within(leaf).getByRole("button", { name: /eliminar objetivo/i }));

    expect(onRemove).toHaveBeenCalledWith("ssp-2");
  });

  it("muestra la pista vacía cuando no hay targets", () => {
    render(<SessionTargetTree targets={[]} textoMap={new Map()} onRemove={vi.fn()} />);

    expect(screen.getByText(/arrastra un objetivo/i)).toBeInTheDocument();
  });
});

describe("SessionTargetTree — check de completado por Sub-subprincipio", () => {
  it("muestra el check junto a la hoja cuando su subSubPrincipioId está en completedSubSubPrincipioIds", () => {
    render(
      <SessionTargetTree
        targets={[buildTarget({ subSubPrincipioId: "ssp-1" })]}
        textoMap={new Map()}
        onRemove={vi.fn()}
        completedSubSubPrincipioIds={new Set(["ssp-1"])}
      />
    );

    expect(screen.getByTestId("covered-ssp-ssp-1")).toBeInTheDocument();
  });

  it("no muestra el check cuando el subSubPrincipioId no está en completedSubSubPrincipioIds", () => {
    render(
      <SessionTargetTree targets={[buildTarget({ subSubPrincipioId: "ssp-1" })]} textoMap={new Map()} onRemove={vi.fn()} />
    );

    expect(screen.queryByTestId("covered-ssp-ssp-1")).not.toBeInTheDocument();
  });
});
