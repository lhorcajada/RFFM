import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameModel } from "../../../../types/gameModel";
import GameModelPrintView from "../GameModelPrintView";

function buildGameModel(overrides?: Partial<GameModel>): GameModel {
  return {
    id: "gm-1",
    teamId: "team-1",
    name: "Modelo de Juego 2025/2026",
    season: "2025/2026",
    gameMoments: [
      {
        id: 1,
        name: "Defensa Organizada",
        zones: [
          {
            id: 1,
            name: "Zona de Iniciación",
            principles: [
              {
                id: 1,
                gameMomentId: 1,
                gameZoneId: 1,
                order: 1,
                title: "Presión en bloque medio",
                description: "El equipo presiona coordinadamente en la salida rival.",
                scenarios: [
                  {
                    id: 1,
                    order: 1,
                    name: "El rival juega por bandas",
                    context: "Contexto del escenario",
                    subPrinciples: [],
                    mediaUrl: null,
                    mediaType: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("GameModelPrintView", () => {
  it("renders each principle's title (prefixed with 'Principio:') and description as a heading above its scenarios", () => {
    render(<GameModelPrintView gameModel={buildGameModel()} teamName="CF Ejemplo" season="2025/2026" />);

    expect(
      screen.getByRole("heading", { name: "Principio: Presión en bloque medio" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("El equipo presiona coordinadamente en la salida rival.")
    ).toBeInTheDocument();
    expect(screen.getByText(/El rival juega por bandas/)).toBeInTheDocument();
  });

  it("does not render a principle description when it is empty", () => {
    const gameModel = buildGameModel();
    gameModel.gameMoments[0].zones[0].principles[0].description = "";

    render(<GameModelPrintView gameModel={gameModel} teamName="CF Ejemplo" season="2025/2026" />);

    expect(
      screen.getByRole("heading", { name: "Principio: Presión en bloque medio" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("El equipo presiona coordinadamente en la salida rival.")
    ).not.toBeInTheDocument();
  });

  it("renders the scenario's photo when it has an image", () => {
    const gameModel = buildGameModel();
    gameModel.gameMoments[0].zones[0].principles[0].scenarios[0].mediaUrl = "https://cdn.example.com/foto.jpg";
    gameModel.gameMoments[0].zones[0].principles[0].scenarios[0].mediaType = "image";

    render(<GameModelPrintView gameModel={gameModel} teamName="CF Ejemplo" season="2025/2026" />);

    const img = screen.getByRole("img", { name: /El rival juega por bandas/i });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/foto.jpg");
  });

  it("resolves a relative/storage-key media URL through resolveMediaUrl, like the read view does", () => {
    const gameModel = buildGameModel();
    gameModel.gameMoments[0].zones[0].principles[0].scenarios[0].mediaUrl = "scenarios/abc123.jpg";
    gameModel.gameMoments[0].zones[0].principles[0].scenarios[0].mediaType = "image";

    render(<GameModelPrintView gameModel={gameModel} teamName="CF Ejemplo" season="2025/2026" />);

    const img = screen.getByRole("img", { name: /El rival juega por bandas/i });
    expect(img).toHaveAttribute(
      "src",
      "/api/public/storage?url=" + encodeURIComponent("scenarios/abc123.jpg")
    );
  });

  it("does not render an image element for a scenario without media", () => {
    render(<GameModelPrintView gameModel={buildGameModel()} teamName="CF Ejemplo" season="2025/2026" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a text note instead of an image when the scenario media is a video", () => {
    const gameModel = buildGameModel();
    gameModel.gameMoments[0].zones[0].principles[0].scenarios[0].mediaUrl = "https://cdn.example.com/video.mp4";
    gameModel.gameMoments[0].zones[0].principles[0].scenarios[0].mediaType = "video";

    render(<GameModelPrintView gameModel={gameModel} teamName="CF Ejemplo" season="2025/2026" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/vídeo disponible en la aplicación/i)).toBeInTheDocument();
  });

  it("shows an empty-state message for a zone with no principles", () => {
    const gameModel = buildGameModel();
    gameModel.gameMoments[0].zones[0].principles = [];

    render(<GameModelPrintView gameModel={gameModel} teamName="CF Ejemplo" season="2025/2026" />);

    expect(screen.getByText("Sin escenarios definidos.")).toBeInTheDocument();
  });

  it("never renders a 'Principios tácticos colectivos' section", () => {
    render(<GameModelPrintView gameModel={buildGameModel()} teamName="CF Ejemplo" season="2025/2026" />);

    expect(screen.queryByText(/Principios tácticos colectivos/i)).not.toBeInTheDocument();
  });

  it("renders the document header with team name and season", () => {
    render(<GameModelPrintView gameModel={buildGameModel()} teamName="CF Ejemplo" season="2025/2026" />);

    expect(screen.getByRole("heading", { name: "Modelo de Juego 2025/2026" })).toBeInTheDocument();
    expect(screen.getByText("CF Ejemplo")).toBeInTheDocument();
    expect(screen.getByText("Temporada 2025/2026")).toBeInTheDocument();
  });
});
