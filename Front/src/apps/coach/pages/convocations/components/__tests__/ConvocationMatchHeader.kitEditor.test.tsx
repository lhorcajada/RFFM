import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConvocationMatchHeader from "../ConvocationMatchHeader";
import type { MatchState } from "../convocationMatchDetail.types";
import type { ClubKit } from "../../../../services/kitService";

vi.mock("../../../../services/teamNoteService", () => ({
  getTeamNotes: vi.fn().mockResolvedValue([]),
  createTeamNote: vi.fn(),
  updateTeamNote: vi.fn(),
  deleteTeamNote: vi.fn(),
}));

vi.mock("../../../../services/authService", () => ({
  coachAuthService: { hasRole: vi.fn().mockReturnValue(false) },
}));

const match: MatchState = {
  date: "2026-09-06",
  time: "17:00",
  localTeamName: "CD Rivas",
  localTeamShield: "",
  visitorTeamName: "CF Getafe",
  visitorTeamShield: "",
  isFinished: false,
  isHomeTeam: true,
  field: "Campo Municipal",
  codacta: null,
  selectedKitNumber: null,
  locationMapUrl: null,
};

const kits: ClubKit[] = [
  { kitNumber: 1, shirtColor: "#1E88E5", shortsColor: "#1E88E5", socksColor: "#1E88E5" },
  { kitNumber: 2, shirtColor: "#E53935", shortsColor: "#FFFFFF", socksColor: "#FFFFFF" },
];

describe("ConvocationMatchHeader — kit configuration", () => {
  it("muestra el botón 'Configurar equipación' cuando no hay equipación seleccionada", () => {
    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={kits}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByRole("button", { name: /configurar equipación/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("muestra un resumen compacto de la equipación seleccionada fuera del popup", () => {
    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={kits}
        selectedKitNumber={1}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText(/1ª equipación/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre un popup (Dialog) con el selector de equipación al pulsar el botón, cuando ya existen equipaciones", () => {
    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={kits}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /configurar equipación/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Seleccionar equipación")).toBeInTheDocument();
  });

  it("permite editar los colores de las equipaciones ya creadas dentro del popup", () => {
    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={kits}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /configurar equipación/i }));

    expect(screen.getByText(/configura las equipaciones/i)).toBeInTheDocument();
    const shirtGroups = screen.getAllByRole("group", { name: "Color de camiseta" });
    const kit1ShirtGroup = shirtGroups[0];
    const selectedSwatch = kit1ShirtGroup.querySelector('[aria-pressed="true"]');
    expect(selectedSwatch).toHaveAttribute("aria-label", "Azul");
  });

  it("muestra el editor de equipaciones del club dentro del popup cuando no hay equipaciones configuradas", () => {
    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={[]}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /configurar equipación/i }));

    expect(screen.getByText(/configura las equipaciones/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Seleccionar equipación")).not.toBeInTheDocument();
  });

  it("cierra el popup al pulsar Cerrar", async () => {
    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={kits}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /configurar equipación/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cierra el popup automáticamente tras guardar con éxito en el editor de equipaciones", async () => {
    const kitService = await import("../../../../services/kitService");
    const savedKits: ClubKit[] = [
      { kitNumber: 1, shirtColor: "#E53935", shortsColor: "#E53935", socksColor: "#E53935" },
      { kitNumber: 2, shirtColor: "#1E88E5", shortsColor: "#1E88E5", socksColor: "#1E88E5" },
    ];
    vi.spyOn(kitService, "saveClubKits").mockResolvedValue(savedKits);
    const onKitsSaved = vi.fn();

    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={[]}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={onKitsSaved}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /configurar equipación/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /guardar equipaciones/i }));

    await waitFor(() => expect(onKitsSaved).toHaveBeenCalledWith(savedKits));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("ConvocationMatchHeader — notas del equipo", () => {
  it("muestra un botón para abrir las notas del equipo", () => {
    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={kits}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByRole("button", { name: /notas/i })).toBeInTheDocument();
  });

  it("abre un popup con las notas del equipo al pulsar el botón", async () => {
    const teamNoteService = await import("../../../../services/teamNoteService");
    vi.mocked(teamNoteService.getTeamNotes).mockResolvedValue([
      { id: "n1", teamId: "team-1", text: "Traed las dos equipaciones", order: 0 },
    ]);

    render(
      <ConvocationMatchHeader
        match={match}
        teamId="team-1"
        kits={kits}
        selectedKitNumber={null}
        onSelectKit={vi.fn()}
        onKitsSaved={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /notas/i }));

    expect(await screen.findByText("Traed las dos equipaciones")).toBeInTheDocument();
  });
});
