import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import GameModelFormEditor from "../GameModelFormEditor";
import { GameModelDraftProvider, useGameModelDraft } from "../../../../context/GameModelDraftContext";
import type { GameMomentCatalogItem, GameModel } from "../../../../types/gameModel";

const moments: GameMomentCatalogItem[] = [
  { id: 1, name: "Defensa Organizada", order: 1 },
  { id: 2, name: "Ataque Organizado", order: 2 },
  { id: 5, name: "Balón Parado", order: 5 },
];

function buildDraft(): GameModel {
  return {
    id: "draft-1",
    teamId: "team-1",
    name: "Modelo de prueba",
    season: "2025/2026",
    principles: [
      {
        id: 1,
        gameMomentId: 1,
        numero: 1,
        titulo: "Principio 1",
        texto: "texto",
        notas: [],
        subprincipios: [
          {
            id: 1,
            numero: "1.1",
            titulo: "Subprincipio 1.1",
            texto: "texto sp",
            notas: [],
            zonas: [],
            subSubPrincipios: [],
          },
        ],
      },
    ],
    setPieceRules: [],
    openIssues: [],
  };
}

function DraftInspector({ onDraft }: { onDraft: (d: GameModel) => void }) {
  const { draft } = useGameModelDraft();
  onDraft(draft);
  return null;
}

function renderEditor() {
  let latestDraft: GameModel | null = null;
  const utils = render(
    <GameModelDraftProvider initialDraft={buildDraft()}>
      <Inner />
    </GameModelDraftProvider>
  );

  function Inner() {
    return (
      <>
        <DraftInspector onDraft={(d) => (latestDraft = d)} />
        <GameModelFormEditor moments={moments} />
      </>
    );
  }

  return { ...utils, getDraft: () => latestDraft as unknown as GameModel };
}

describe("GameModelFormEditor — CRUD at every level", () => {
  it("renders the model name field and moment sections in order, excluding Balón Parado from the tree", () => {
    renderEditor();

    expect(screen.getByLabelText("Nombre del modelo")).toHaveValue("Modelo de prueba");
    expect(screen.getByRole("heading", { level: 3, name: "Defensa Organizada" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Ataque Organizado" })).toBeInTheDocument();
    // "Balón Parado" appears once, as the flat SetPieceRule section, not a principle moment section
    expect(screen.getAllByRole("heading", { level: 3, name: "Balón Parado" })).toHaveLength(1);
  });

  it("adding a principle in a moment section dispatches ADD_PRINCIPLE for the right moment", async () => {
    const user = userEvent.setup();
    const { getDraft } = renderEditor();

    const ataqueSection = screen
      .getByRole("heading", { level: 3, name: "Ataque Organizado" })
      .closest('[class*="momentSection"]') as HTMLElement;
    const addButton = within(ataqueSection).getByRole("button", { name: /Añadir principio/i });
    await user.click(addButton);

    const draft = getDraft();
    expect(draft.principles).toHaveLength(2);
    expect(draft.principles[1].gameMomentId).toBe(2);
  });

  it("expanding a principle and adding a subprincipio grows the tree", async () => {
    const user = userEvent.setup();
    const { getDraft } = renderEditor();

    await user.click(screen.getByRole("button", { name: /Principio 1/i }));
    await user.click(screen.getByRole("button", { name: /Añadir subprincipio/i }));

    expect(getDraft().principles[0].subprincipios).toHaveLength(2);
  });

  it(
    "adding a Zona then hides the direct sub-subprincipio option (mutual exclusivity)",
    async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /Principio 1/i }));
      await user.click(screen.getByRole("button", { name: /Subprincipio 1.1/i }));
      await user.click(screen.getByRole("button", { name: "Añadir zona" }));

      expect(screen.queryByRole("button", { name: /Añadir sub-subprincipio directo/i })).not.toBeInTheDocument();
    },
    10000
  );

  it("deleting a principle removes it and everything nested under it", async () => {
    const user = userEvent.setup();
    const { getDraft } = renderEditor();

    await user.click(screen.getByRole("button", { name: /Principio 1/i }));
    await user.click(screen.getByRole("button", { name: /Eliminar principio/i }));

    expect(getDraft().principles).toHaveLength(0);
  });

  it("adding a Balón Parado rule adds a flat SetPieceRule entry", async () => {
    const user = userEvent.setup();
    const { getDraft } = renderEditor();

    await user.click(screen.getByRole("button", { name: /Añadir regla de balón parado/i }));

    expect(getDraft().setPieceRules).toHaveLength(1);
  });

  it("adding an OpenIssue adds a flat pending-decision entry with status open", async () => {
    const user = userEvent.setup();
    const { getDraft } = renderEditor();

    await user.click(screen.getByRole("button", { name: /Añadir pendiente/i }));

    expect(getDraft().openIssues).toHaveLength(1);
    expect(getDraft().openIssues[0].status).toBe("open");
  });

  it("does not mount a collapsed Principio's fields until it is expanded (perf: avoids mounting the whole tree upfront)", async () => {
    const user = userEvent.setup();
    renderEditor();

    // "Subprincipio 1.1" only exists inside Principio 1's AccordionDetails — while Principio 1
    // is collapsed, MUI must not keep that subtree mounted in the DOM.
    expect(screen.queryByText(/Subprincipio 1\.1/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Principio 1/i }));

    expect(screen.getByText(/Subprincipio 1\.1/)).toBeInTheDocument();
  });

  it("renders Subprincipios in numeric order regardless of draft array order, while still dispatching against the right underlying entry", async () => {
    const user = userEvent.setup();
    const draft: GameModel = {
      id: "draft-2",
      teamId: "team-1",
      name: "Modelo de orden",
      season: "2025/2026",
      principles: [
        {
          id: 1,
          gameMomentId: 1,
          numero: 1,
          titulo: "Principio 1",
          texto: "",
          notas: [],
          subprincipios: [
            { id: 2, numero: "1.2", titulo: "Segundo", texto: "", notas: [], zonas: [], subSubPrincipios: [] },
            { id: 1, numero: "1.1", titulo: "Primero", texto: "", notas: [], zonas: [], subSubPrincipios: [] },
          ],
        },
      ],
      setPieceRules: [],
      openIssues: [],
    };
    let latestDraft: GameModel | null = null;
    function Inner() {
      const { draft: d } = useGameModelDraft();
      latestDraft = d;
      return <GameModelFormEditor moments={moments} />;
    }
    render(
      <GameModelDraftProvider initialDraft={draft}>
        <Inner />
      </GameModelDraftProvider>
    );

    await user.click(screen.getByRole("button", { name: /Principio 1/i }));

    const headings = screen.getAllByText(/^Subprincipio 1\./).map((el) => el.textContent);
    expect(headings[0]).toContain("1.1");
    expect(headings[1]).toContain("1.2");

    // Deleting the first-shown one ("1.1" — array index 1) must remove that exact entry,
    // not array index 0 ("1.2"), even though it renders first.
    await user.click(screen.getByRole("button", { name: /Subprincipio 1\.1/i }));
    await user.click(screen.getByRole("button", { name: /Eliminar subprincipio/i }));

    expect(latestDraft!.principles[0].subprincipios).toHaveLength(1);
    expect(latestDraft!.principles[0].subprincipios[0].titulo).toBe("Segundo");
  });

  it("renders SubSubPrincipios (direct, no Zona) in numeric order regardless of draft array order", async () => {
    const user = userEvent.setup();
    const draft: GameModel = {
      id: "draft-3",
      teamId: "team-1",
      name: "Modelo de orden SSP",
      season: "2025/2026",
      principles: [
        {
          id: 1,
          gameMomentId: 1,
          numero: 1,
          titulo: "Principio 1",
          texto: "",
          notas: [],
          subprincipios: [
            {
              id: 1,
              numero: "1.1",
              titulo: "Uno",
              texto: "",
              notas: [],
              zonas: [],
              subSubPrincipios: [
                { id: 2, numero: "1.1.2", rol: "Segundo", texto: "", habilidades: [], notas: [] },
                { id: 1, numero: "1.1.1", rol: "Primero", texto: "", habilidades: [], notas: [] },
              ],
            },
          ],
        },
      ],
      setPieceRules: [],
      openIssues: [],
    };
    render(
      <GameModelDraftProvider initialDraft={draft}>
        <GameModelFormEditor moments={moments} />
      </GameModelDraftProvider>
    );

    await user.click(screen.getByRole("button", { name: /Principio 1/i }));
    await user.click(screen.getByRole("button", { name: /Subprincipio 1.1/i }));

    const headings = screen.getAllByText(/^Sub-subprincipio 1\.1\./).map((el) => el.textContent);
    expect(headings[0]).toContain("1.1.1");
    expect(headings[1]).toContain("1.1.2");
  });
});
