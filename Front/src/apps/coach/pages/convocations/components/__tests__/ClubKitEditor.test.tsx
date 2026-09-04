import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ClubKit } from "../../../../services/kitService";

const saveClubKitsMock = vi.fn();

vi.mock("../../../../services/kitService", () => ({
  saveClubKits: (...args: unknown[]) => saveClubKitsMock(...args),
}));

import ClubKitEditor, { KIT_COLOR_PALETTE } from "../KitSelector/ClubKitEditor";

describe("ClubKitEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra selectores de color de camiseta y pantalón para ambas equipaciones", () => {
    render(<ClubKitEditor teamId="team-1" onSaved={vi.fn()} />);

    expect(screen.getByText("1ª equipación")).toBeInTheDocument();
    expect(screen.getByText("2ª equipación")).toBeInTheDocument();
    expect(screen.getAllByText("Color de camiseta")).toHaveLength(2);
    expect(screen.getAllByText("Color de pantalón")).toHaveLength(2);
    expect(screen.getAllByText("Color de medias")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /guardar equipaciones/i })).toBeInTheDocument();
  });

  it("llama a saveClubKits con el payload correcto (2 kits, incluyendo socksColor) al pulsar Guardar", async () => {
    const savedKits: ClubKit[] = [
      { kitNumber: 1, shirtColor: "#E53935", shortsColor: "#E53935", socksColor: "#E53935" },
      { kitNumber: 2, shirtColor: "#1E88E5", shortsColor: "#1E88E5", socksColor: "#1E88E5" },
    ];
    saveClubKitsMock.mockResolvedValue(savedKits);
    const onSaved = vi.fn();

    render(<ClubKitEditor teamId="team-1" onSaved={onSaved} />);

    // Pick "Rojo" for kit 1 shirt, shorts and socks
    const shirtGroups = screen.getAllByRole("group", { name: "Color de camiseta" });
    fireEvent.click(screen.getAllByRole("button", { name: "Rojo" })[0]);
    const shortsGroups = screen.getAllByRole("group", { name: "Color de pantalón" });
    fireEvent.click(screen.getAllByRole("button", { name: "Rojo" })[1]);
    const socksGroups = screen.getAllByRole("group", { name: "Color de medias" });
    fireEvent.click(screen.getAllByRole("button", { name: "Rojo" })[2]);
    // Pick "Azul" for kit 2 shirt, shorts and socks
    fireEvent.click(screen.getAllByRole("button", { name: "Azul" })[3]);
    fireEvent.click(screen.getAllByRole("button", { name: "Azul" })[4]);
    fireEvent.click(screen.getAllByRole("button", { name: "Azul" })[5]);

    void shirtGroups;
    void shortsGroups;
    void socksGroups;

    fireEvent.click(screen.getByRole("button", { name: /guardar equipaciones/i }));

    await waitFor(() => expect(saveClubKitsMock).toHaveBeenCalledTimes(1));

    expect(saveClubKitsMock).toHaveBeenCalledWith("team-1", [
      { kitNumber: 1, shirtColor: "#E53935", shortsColor: "#E53935", socksColor: "#E53935" },
      { kitNumber: 2, shirtColor: "#1E88E5", shortsColor: "#1E88E5", socksColor: "#1E88E5" },
    ]);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedKits));
  });

  it("muestra un mensaje de error legible si saveClubKits falla, sin romper la pantalla", async () => {
    saveClubKitsMock.mockRejectedValue({ response: { data: { detail: "Formato de color inválido" } } });
    const onSaved = vi.fn();

    render(<ClubKitEditor teamId="team-1" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar equipaciones/i }));

    expect(await screen.findByText("Formato de color inválido")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("muestra un mensaje de error genérico en español cuando el backend no da detail", async () => {
    saveClubKitsMock.mockRejectedValue(new Error("network down"));

    render(<ClubKitEditor teamId="team-1" onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar equipaciones/i }));

    expect(
      await screen.findByText(/error al guardar las equipaciones/i),
    ).toBeInTheDocument();
  });

  it("precarga los colores reales cuando se pasan initialKits", () => {
    const initialKits: ClubKit[] = [
      { kitNumber: 1, shirtColor: "#43A047", shortsColor: "#43A047", socksColor: "#43A047" },
      { kitNumber: 2, shirtColor: "#8E24AA", shortsColor: "#8E24AA", socksColor: "#8E24AA" },
    ];

    render(<ClubKitEditor teamId="team-1" onSaved={vi.fn()} initialKits={initialKits} />);

    const shirtGroups = screen.getAllByRole("group", { name: "Color de camiseta" });
    const kit1Selected = shirtGroups[0].querySelector('[aria-pressed="true"]');
    const kit2Selected = shirtGroups[1].querySelector('[aria-pressed="true"]');
    expect(kit1Selected).toHaveAttribute("aria-label", "Verde");
    expect(kit2Selected).toHaveAttribute("aria-label", "Morado");
  });

  it("usa los colores por defecto de la paleta cuando no se pasan initialKits", () => {
    render(<ClubKitEditor teamId="team-1" onSaved={vi.fn()} />);

    const shirtGroups = screen.getAllByRole("group", { name: "Color de camiseta" });
    const kit1Selected = shirtGroups[0].querySelector('[aria-pressed="true"]');
    expect(kit1Selected).toHaveAttribute("aria-label", "Azul");
  });

  it("muestra una vista previa del color de pantalón y de medias, igual que la camiseta", () => {
    const initialKits: ClubKit[] = [
      { kitNumber: 1, shirtColor: "#E53935", shortsColor: "#43A047", socksColor: "#FDD835" },
      { kitNumber: 2, shirtColor: "#1E88E5", shortsColor: "#8E24AA", socksColor: "#000000" },
    ];

    render(<ClubKitEditor teamId="team-1" onSaved={vi.fn()} initialKits={initialKits} />);

    const shortsPreview1 = screen.getByLabelText("Vista previa color de pantalón, 1ª equipación");
    const socksPreview1 = screen.getByLabelText("Vista previa color de medias, 1ª equipación");
    const shortsPreview2 = screen.getByLabelText("Vista previa color de pantalón, 2ª equipación");
    const socksPreview2 = screen.getByLabelText("Vista previa color de medias, 2ª equipación");

    expect(shortsPreview1).toHaveStyle({ color: "#43A047" });
    expect(socksPreview1).toHaveStyle({ color: "#FDD835" });
    expect(shortsPreview2).toHaveStyle({ color: "#8E24AA" });
    expect(socksPreview2).toHaveStyle({ color: "#000000" });
  });

  it("actualiza la vista previa de pantalón/medias al cambiar el color, igual que la camiseta", () => {
    render(<ClubKitEditor teamId="team-1" onSaved={vi.fn()} />);

    const shortsGroup1 = screen.getAllByRole("group", { name: "Color de pantalón" })[0];
    fireEvent.click(within(shortsGroup1).getByRole("button", { name: "Negro" }));

    expect(screen.getByLabelText("Vista previa color de pantalón, 1ª equipación")).toHaveStyle({
      color: "#000000",
    });
  });

  it("expone la paleta de colores predefinida con nombre y hex", () => {
    expect(KIT_COLOR_PALETTE.length).toBeGreaterThan(0);
    for (const color of KIT_COLOR_PALETTE) {
      expect(color.name).toEqual(expect.any(String));
      expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
