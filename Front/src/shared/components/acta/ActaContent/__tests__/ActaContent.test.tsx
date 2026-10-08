import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../services/imageService", () => ({
  fetchImage: vi.fn().mockResolvedValue(null),
}));

import ActaContent from "../ActaContent";
import type { Acta } from "../../../../types/acta";

const acta: Acta = {
  equipo_local: "CD Local",
  equipo_visitante: "UD Visitante",
  goles_local: "2",
  goles_visitante: "1",
  jugadores_equipo_local: [
    { codjugador: "1", nombre_jugador: "Pedro Local", dorsal: "9", titular: "1" },
  ],
  jugadores_equipo_visitante: [
    { codjugador: "2", nombre_jugador: "Juan Visitante", dorsal: "7", titular: "1" },
  ],
  goles_equipo_local: [{ codjugador: "1", nombre_jugador: "Pedro Local", minuto: "12" }],
  goles_equipo_visitante: [],
  sustituciones_equipo_local: [
    { minuto: "60", nombre_jugador_entra: "Luis Suplente", nombre_jugador_sale: "Pedro Local" },
  ],
  sustituciones_equipo_visitante: [],
};

describe("ActaContent", () => {
  it("muestra las alineaciones de ambos equipos y las secciones de goles y sustituciones", () => {
    render(<ActaContent acta={acta} />);

    expect(screen.getByText(/Local — CD Local/)).toBeInTheDocument();
    expect(screen.getByText(/Visitante — UD Visitante/)).toBeInTheDocument();
    expect(screen.getByText("Goles")).toBeInTheDocument();
    expect(screen.getByText("Sustituciones")).toBeInTheDocument();
  });
});
