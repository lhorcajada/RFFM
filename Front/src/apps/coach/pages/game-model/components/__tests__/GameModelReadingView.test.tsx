import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

import GameModelReadingView from "../GameModelReadingView";
import type { PendingChanges } from "../gameModelReadingTree";
import { mockGameModel } from "../../../../services/gameModelMock";
import type { GameModel, Principle } from "../../../../types/gameModel";

const SKILL_ACTIVACION = "defensa-organizada-1.1.1/hab:hab-1";
const SUB_1_1 = "defensa-organizada-1.1";
const PRINCIPLE_1 = "defensa-organizada-1";

const attackPrinciple: Principle = {
  id: 10,
  gameMomentId: 2,
  gameMomentName: "Ataque Organizado",
  numero: 1,
  titulo: "Salir jugando desde el portero",
  texto: "Buscamos superioridad en la primera línea.",
  notas: [],
  subprincipios: [],
};

const twoPhaseModel: GameModel = {
  ...mockGameModel,
  principles: [...mockGameModel.principles, attackPrinciple],
};

const scrollIntoViewMock = vi.fn();

function LocationProbe() {
  return <output aria-label="ubicación">{useLocation().search}</output>;
}

function renderView(
  props: { gameModel?: GameModel; pendingChanges?: PendingChanges } = {},
  route = "/coach/game-model"
) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[route]}>
      <GameModelReadingView gameModel={props.gameModel ?? mockGameModel} pendingChanges={props.pendingChanges} />
      <LocationProbe />
    </MemoryRouter>
  );
  return user;
}

function searchBox() {
  return screen.getByRole("searchbox", { name: "Buscar en el modelo" });
}

function marks(): string[] {
  return Array.from(document.querySelectorAll("mark")).map((m) => m.textContent ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMediaQuery.mockReturnValue(false);
  Element.prototype.scrollIntoView = scrollIntoViewMock;
});

describe("GameModelReadingView — búsqueda", () => {
  it("resalta las coincidencias sin distinguir mayúsculas y cuenta los resultados", async () => {
    const user = renderView();

    await user.type(searchBox(), "LATERAL Opuesto");

    expect(screen.getByText("1 de 1 resultado")).toBeInTheDocument();
    expect(marks()).toEqual(["lateral", "opuesto"]);
  });

  it("encuentra títulos con acento escribiendo sin acento", async () => {
    const user = renderView();

    await user.type(searchBox(), "presion");

    expect(marks()).toContain("presión");
  });

  it("encuentra el nodo por su número", async () => {
    const user = renderView();

    await user.type(searchBox(), "1.1");

    expect(marks()).toEqual(["1.1"]);
    expect(screen.getByText("1 de 1 resultado")).toBeInTheDocument();
  });

  it("expande la rama de un resultado profundo y lo muestra", async () => {
    const user = renderView();
    expect(screen.queryByText("Activación")).not.toBeInTheDocument();

    await user.type(searchBox(), "activacion");

    expect(screen.getByText("Activación", { selector: "mark" })).toBeInTheDocument();
  });

  it("sin resultados muestra un mensaje y deja el modelo como estaba", async () => {
    const user = renderView();

    await user.type(searchBox(), "zzzzzz");

    expect(screen.getByText("No hay resultados para «zzzzzz».")).toBeInTheDocument();
    expect(screen.getByText("0 resultados")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No permitir progresar al rival" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Evitar que el rival supere/ })).toBeInTheDocument();
  });

  it("al borrar la búsqueda recupera el estado de expansión previo", async () => {
    const user = renderView();
    await user.type(searchBox(), "activacion");
    expect(screen.getByText("Activación", { selector: "mark" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Borrar búsqueda" }));

    expect(screen.queryByText("Activación")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Evitar que el rival supere/ })).toBeInTheDocument();
    expect(screen.queryByText("Zona de Finalización")).not.toBeInTheDocument();
  });

  it("navega entre resultados con siguiente y anterior y hace scroll al resultado", async () => {
    const user = renderView();

    await user.type(searchBox(), "rival");
    expect(screen.getByText(/^1 de \d+ resultados$/)).toBeInTheDocument();
    scrollIntoViewMock.mockClear();

    await user.click(screen.getByRole("button", { name: "Resultado siguiente" }));
    expect(screen.getByText(/^2 de \d+ resultados$/)).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Resultado anterior" }));
    expect(screen.getByText(/^1 de \d+ resultados$/)).toBeInTheDocument();
  });

  it("deshabilita la navegación cuando no hay resultados", async () => {
    const user = renderView();

    await user.type(searchBox(), "zzzzzz");

    expect(screen.getByRole("button", { name: "Resultado siguiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resultado anterior" })).toBeDisabled();
  });
});

describe("GameModelReadingView — nivel de detalle y colapso", () => {
  it("abre por defecto mostrando principios y subprincipios, sin zonas", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "No permitir progresar al rival" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Evitar que el rival supere/ })).toBeInTheDocument();
    expect(screen.queryByText("Zona de Finalización")).not.toBeInTheDocument();
  });

  it("ofrece los cinco niveles de detalle", () => {
    renderView();

    const options = within(screen.getByLabelText("Nivel de detalle")).getAllByRole("option");

    expect(options.map((o) => o.textContent)).toEqual([
      "Principios",
      "Subprincipios",
      "Zonas",
      "Sub-subprincipios",
      "Habilidades y notas",
    ]);
  });

  it("el nivel de principios deja los principios contraídos", async () => {
    const user = renderView();

    await user.selectOptions(screen.getByLabelText("Nivel de detalle"), "1");

    expect(screen.getByRole("heading", { name: "No permitir progresar al rival" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Evitar que el rival supere/ })).not.toBeInTheDocument();
  });

  it("el nivel de zonas muestra las zonas contraídas", async () => {
    const user = renderView();

    await user.selectOptions(screen.getByLabelText("Nivel de detalle"), "3");

    expect(screen.getByRole("heading", { name: "Zona de Finalización" })).toBeInTheDocument();
    expect(screen.queryByText("Delantero")).not.toBeInTheDocument();
  });

  it("el nivel de habilidades y notas muestra el modelo completo", async () => {
    const user = renderView();

    await user.selectOptions(screen.getByLabelText("Nivel de detalle"), "5");

    expect(screen.getByText("Delantero")).toBeInTheDocument();
    expect(screen.getByText("Activación")).toBeInTheDocument();
    expect(screen.getByText("Riesgo aceptado:")).toBeInTheDocument();
    expect(screen.getByText(/El lateral opuesto rival queda completamente libre/)).toBeInTheDocument();
  });

  it("contrae y expande un nodo con su botón", async () => {
    const user = renderView();
    const toggle = screen.getByRole("button", { name: "Recuperar el balón" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: /Robar el balón cuando el rival no controla bien/ })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole("heading", { name: /Robar el balón cuando el rival no controla bien/ })).toBeInTheDocument();
  });

  it("cambiar de nivel descarta los cambios manuales de expansión", async () => {
    const user = renderView();
    await user.click(screen.getByRole("button", { name: "Recuperar el balón" }));
    expect(screen.queryByRole("heading", { name: /Robar el balón cuando el rival no controla bien/ })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Nivel de detalle"), "3");

    expect(screen.getByRole("heading", { name: /Robar el balón cuando el rival no controla bien/ })).toBeInTheDocument();
  });

  it("«Contraer todo» oculta el contenido y «Expandir todo» lo muestra completo", async () => {
    const user = renderView();

    await user.click(screen.getByRole("button", { name: "Contraer todo" }));
    expect(screen.queryByRole("heading", { name: "No permitir progresar al rival" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Defensa Organizada" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expandir todo" }));
    expect(screen.getByText("Activación")).toBeInTheDocument();
    expect(screen.getByLabelText("Nivel de detalle")).toHaveValue("5");
  });
});

describe("GameModelReadingView — índice", () => {
  it("lista fases, principios y subprincipios, pero no zonas ni niveles inferiores", () => {
    renderView({ gameModel: twoPhaseModel });

    const index = screen.getByRole("navigation", { name: "Índice del modelo" });

    expect(within(index).getByRole("link", { name: /Defensa Organizada/ })).toBeInTheDocument();
    expect(within(index).getByRole("link", { name: /Ataque Organizado/ })).toBeInTheDocument();
    expect(within(index).getByRole("link", { name: /No permitir progresar al rival/ })).toBeInTheDocument();
    expect(within(index).getByRole("link", { name: /Evitar que el rival supere/ })).toBeInTheDocument();
    expect(within(index).queryByText(/Zona de Finalización/)).not.toBeInTheDocument();
    expect(within(index).queryByText("Delantero")).not.toBeInTheDocument();
  });

  it("al elegir una entrada expande sus ancestros contraídos y hace scroll hasta ella", async () => {
    const user = renderView();
    await user.click(screen.getByRole("button", { name: "Contraer todo" }));
    expect(screen.queryByRole("heading", { name: /Evitar que el rival supere/ })).not.toBeInTheDocument();
    scrollIntoViewMock.mockClear();

    const index = screen.getByRole("navigation", { name: "Índice del modelo" });
    await user.click(within(index).getByRole("link", { name: /Evitar que el rival supere/ }));

    expect(screen.getByRole("heading", { name: /Evitar que el rival supere/ })).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(screen.getByLabelText("ubicación")).toHaveTextContent(`?nodo=${SUB_1_1}`);
  });

  it("en pantallas pequeñas el índice se abre desde el botón «Ir a…» y se cierra al elegir", async () => {
    mockUseMediaQuery.mockReturnValue(true);
    const user = renderView();
    expect(screen.queryByRole("navigation", { name: "Índice del modelo" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ir a…" }));
    const index = await screen.findByRole("navigation", { name: "Índice del modelo" });
    await user.click(within(index).getByRole("link", { name: /Recuperar el balón/ }));

    await waitFor(() =>
      expect(screen.queryByRole("navigation", { name: "Índice del modelo" })).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText("ubicación")).toHaveTextContent("?nodo=defensa-organizada-2");
  });

  it("en pantallas pequeñas no muestra el panel fijo del índice", () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderView();

    expect(screen.queryByRole("navigation", { name: "Índice del modelo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a…" })).toBeInTheDocument();
  });

  it("en escritorio no muestra el botón «Ir a…»", () => {
    renderView();

    expect(screen.queryByRole("button", { name: "Ir a…" })).not.toBeInTheDocument();
  });
});

describe("GameModelReadingView — enlaces directos", () => {
  it("cada sección enlazable tiene un enlace con el parámetro de su dirección", () => {
    renderView();

    expect(screen.getByRole("link", { name: "Enlace directo a No permitir progresar al rival" })).toHaveAttribute(
      "href",
      `?nodo=${PRINCIPLE_1}`
    );
  });

  it("un enlace directo abre el modelo posicionado en el nodo con sus ancestros expandidos", () => {
    renderView({}, `/coach/game-model?nodo=${encodeURIComponent(SKILL_ACTIVACION)}`);

    expect(screen.getByText("Activación")).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(screen.queryByText(/ya no existe/)).not.toBeInTheDocument();
  });

  it("un enlace a un nodo que ya no existe abre el modelo desde arriba con un aviso", () => {
    renderView({}, "/coach/game-model?nodo=no-existe");

    expect(screen.getByText(/La sección enlazada ya no existe/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No permitir progresar al rival" })).toBeInTheDocument();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});

describe("GameModelReadingView — comportamientos conservados", () => {
  it("incluye la entrada «Balón parado» y muestra cada regla con su subtipo", () => {
    renderView();

    const index = screen.getByRole("navigation", { name: "Índice del modelo" });
    expect(within(index).getByRole("link", { name: /Balón parado/ })).toBeInTheDocument();
    expect(screen.getByText("Córners defensivos")).toBeInTheDocument();
    expect(screen.getByText(/Defendemos con marcaje mixto/)).toBeInTheDocument();
  });

  it("no muestra «Balón parado» si el modelo no tiene reglas", () => {
    renderView({ gameModel: { ...mockGameModel, setPieceRules: [] } });

    expect(screen.queryByText(/Balón parado/)).not.toBeInTheDocument();
  });

  it("indica «misma que» cuando la habilidad referencia a otra", async () => {
    const model: GameModel = structuredClone(mockGameModel);
    model.principles[0].subprincipios[0].zonas[0].subSubPrincipios[0].habilidades[0].referenciaAKey = "hab-2";
    const user = renderView({ gameModel: model });

    await user.selectOptions(screen.getByLabelText("Nivel de detalle"), "5");

    expect(screen.getByText(/misma que hab-2/)).toBeInTheDocument();
  });

  it("muestra los pendientes abiertos siempre, también al buscar y al contraer todo", async () => {
    const user = renderView({ gameModel: twoPhaseModel });
    const panel = () => screen.getByRole("complementary", { name: /Pendientes abiertos/ });
    expect(within(panel()).getByText(/Revisión de coherencia/)).toBeInTheDocument();
    expect(within(panel()).getByText(/pendiente/)).toBeInTheDocument();

    await user.type(searchBox(), "zzzzzz");
    await user.click(screen.getByRole("button", { name: "Contraer todo" }));

    expect(within(panel()).getByText(/Revisión de coherencia/)).toBeInTheDocument();
  });

  it("en pantallas pequeñas los pendientes abiertos siguen visibles", () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderView();

    expect(screen.getByRole("complementary", { name: /Pendientes abiertos/ })).toBeInTheDocument();
  });

  it("muestra un mensaje cuando el modelo no tiene contenido", () => {
    renderView({ gameModel: { ...mockGameModel, principles: [], setPieceRules: [], openIssues: [] } });

    expect(screen.getByText("Este modelo de juego todavía no tiene contenido.")).toBeInTheDocument();
  });

  it("no usa tablas", async () => {
    const user = renderView();
    await user.click(screen.getByRole("button", { name: "Expandir todo" }));

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("GameModelReadingView — cambios pendientes", () => {
  const removeSkill: PendingChanges = { [SKILL_ACTIVACION]: { operation: "remove" } };

  it("mantiene visible y expandido el nodo con cambio aunque el nivel sea el de principios", async () => {
    const user = renderView({ pendingChanges: removeSkill });

    await user.selectOptions(screen.getByLabelText("Nivel de detalle"), "1");

    expect(screen.getByText("Activación")).toBeInTheDocument();
    expect(screen.getByText("Propuesta: eliminar")).toBeInTheDocument();
  });

  it("mantiene el nodo con cambio visible tras contraer todo y durante una búsqueda", async () => {
    const user = renderView({ pendingChanges: removeSkill });

    await user.click(screen.getByRole("button", { name: "Contraer todo" }));
    expect(screen.getByText("Activación")).toBeInTheDocument();

    await user.type(searchBox(), "anticipacion");
    expect(screen.getByText("Activación")).toBeInTheDocument();
  });

  it("muestra la propuesta de un cambio sobre el nodo", () => {
    renderView({
      pendingChanges: { [SUB_1_1]: { operation: "change", title: "Nuevo título", text: "Texto propuesto" } },
    });

    expect(screen.getByText("Propuesta: modificar")).toBeInTheDocument();
    expect(screen.getByText(/Texto propuesto/)).toBeInTheDocument();
  });

  it("una alta pinta un nodo marcador en su posición sin tocar el modelo guardado", () => {
    const before = JSON.stringify(mockGameModel);
    renderView({
      pendingChanges: {
        "nuevo-subprincipio": { operation: "add", parentAddress: PRINCIPLE_1, number: "1.2", title: "Presionar al portero" },
      },
    });

    expect(screen.getByText("Propuesta: añadir").parentElement).toHaveTextContent("1.2Presionar al portero");
    expect(JSON.stringify(mockGameModel)).toBe(before);
  });

  it("marca el nodo con cambio en el índice", () => {
    renderView({ pendingChanges: { [SUB_1_1]: { operation: "change" } } });

    const index = screen.getByRole("navigation", { name: "Índice del modelo" });

    expect(within(within(index).getByRole("link", { name: /Evitar que el rival supere/ })).getByText("Propuesta")).toBeInTheDocument();
  });

  it("un contador permite saltar entre los cambios pendientes", async () => {
    const user = renderView({
      pendingChanges: { [SUB_1_1]: { operation: "change" }, [SKILL_ACTIVACION]: { operation: "remove" } },
    });
    expect(screen.getByText("2 cambios propuestos")).toBeInTheDocument();
    scrollIntoViewMock.mockClear();

    await user.click(screen.getByRole("button", { name: "Cambio propuesto siguiente" }));

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });

  it("sin cambios pendientes no muestra el contador", () => {
    renderView();

    expect(screen.queryByText(/cambios? propuestos?/)).not.toBeInTheDocument();
  });
});
