import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { TeamNote } from "../../../../services/teamNoteService";
import type { MatchState } from "../convocationMatchDetail.types";

const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: writeTextMock },
  configurable: true,
  writable: true,
});

const getTeamNotesMock = vi.fn();
vi.mock("../../../../services/teamNoteService", () => ({
  getTeamNotes: (...args: unknown[]) => getTeamNotesMock(...args),
}));

import ConvocationDetailsDialog from "../ConvocationDetailsDialog";

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
  selectedKitNumber: 1,
  locationMapUrl: null,
};

const players: PlayerResponse[] = [
  {
    id: "p1",
    name: "Juan",
    lastName: "Pérez",
    alias: "",
    dorsal: 7,
    position: "Delantero",
  },
  {
    id: "p2",
    name: "Luis",
    lastName: "García",
    alias: "",
    dorsal: 4,
    position: "Defensa",
  },
];

const baseProps = {
  open: true,
  onClose: vi.fn(),
  match,
  calledIds: ["p1", "p2"],
  notCalledIds: [],
  players,
  photos: {},
  excuseMap: {},
  excuseTypes: [],
  kits: [],
  selectedKitNumber: null,
  teamId: "team-1",
};

describe("ConvocationDetailsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamNotesMock.mockResolvedValue([]);
  });

  it("muestra la información de la convocatoria cuando está abierto", () => {
    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={false} />);

    expect(screen.getByText(/CD Rivas/)).toBeInTheDocument();
    expect(screen.getByText(/CF Getafe/)).toBeInTheDocument();
    expect(screen.getByText(/Juan Pérez|Juan/)).toBeInTheDocument();
    expect(screen.getByText(/Luis García|Luis/)).toBeInTheDocument();
  });

  it("muestra los escudos de los equipos junto al nombre y la hora, cuando tienen URL", () => {
    const matchWithShields: MatchState = {
      ...match,
      localTeamShield: "https://example.com/rivas.png",
      visitorTeamShield: "https://example.com/getafe.png",
    };

    render(<ConvocationDetailsDialog {...baseProps} match={matchWithShields} canCopyToWhatsApp={false} />);

    const shieldSrcs = Array.from(document.querySelectorAll("img")).map((img) => img.src);
    expect(shieldSrcs).toContain("https://example.com/rivas.png");
    expect(shieldSrcs).toContain("https://example.com/getafe.png");
    expect(screen.getByText("17:00")).toBeInTheDocument();
  });

  it("no rompe cuando los equipos no tienen escudo", () => {
    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={false} />);

    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText(/CD Rivas/)).toBeInTheDocument();
  });

  it("no renderiza nada cuando está cerrado", () => {
    render(<ConvocationDetailsDialog {...baseProps} open={false} canCopyToWhatsApp={true} />);

    expect(screen.queryByText(/CD Rivas/)).not.toBeInTheDocument();
  });

  it("muestra el botón Copiar para WhatsApp para el rol Coach", () => {
    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={true} />);

    expect(screen.getByRole("button", { name: /copiar para whatsapp/i })).toBeInTheDocument();
  });

  it("no muestra el botón Copiar para WhatsApp para roles distintos de Coach", () => {
    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={false} />);

    expect(screen.queryByRole("button", { name: /copiar para whatsapp/i })).not.toBeInTheDocument();
  });

  it("copia el texto de la convocatoria al portapapeles al pulsar el botón", async () => {
    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={true} />);

    const btn = screen.getByRole("button", { name: /copiar para whatsapp/i });
    fireEvent.click(btn);

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    expect(writeTextMock.mock.calls[0][0]).toContain("CONVOCATORIA");
  });

  it("muestra un enlace de ubicación usando locationMapUrl cuando está presente", () => {
    render(
      <ConvocationDetailsDialog
        {...baseProps}
        match={{ ...match, locationMapUrl: "https://maps.example.com/campo-municipal" }}
        canCopyToWhatsApp={false}
      />,
    );

    const link = screen.getByRole("link", { name: /ver en el mapa/i });
    expect(link).toHaveAttribute("href", "https://maps.example.com/campo-municipal");
  });

  it("cae al enlace de búsqueda de Google Maps cuando no hay locationMapUrl", () => {
    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={false} />);

    const link = screen.getByRole("link", { name: /ver en el mapa/i });
    expect(link).toHaveAttribute(
      "href",
      `https://maps.google.com/?q=${encodeURIComponent("Campo Municipal")}`,
    );
  });

  it("muestra la equipación seleccionada sin ningún aviso fijo hardcodeado", () => {
    const kits = [
      { kitNumber: 1 as const, shirtColor: "#fff", shortsColor: "#fff", socksColor: "#fff" },
      { kitNumber: 2 as const, shirtColor: "#000", shortsColor: "#000", socksColor: "#000" },
    ];
    render(
      <ConvocationDetailsDialog
        {...baseProps}
        kits={kits}
        selectedKitNumber={1}
        canCopyToWhatsApp={false}
      />,
    );

    expect(screen.getByText(/se juega con: 1ª equipación/i)).toBeInTheDocument();
    expect(screen.queryByText(/traed las dos equipaciones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/espinilleras/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no podrá jugar el partido/i)).not.toBeInTheDocument();
  });

  it("carga y muestra las notas del equipo, en el orden recibido", async () => {
    const notes: TeamNote[] = [
      { id: "n1", teamId: "team-1", text: "Traed las dos equipaciones", order: 0 },
      { id: "n2", teamId: "team-1", text: "Espinilleras obligatorias", order: 1 },
    ];
    getTeamNotesMock.mockResolvedValue(notes);

    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={false} />);

    expect(await screen.findByText("Traed las dos equipaciones")).toBeInTheDocument();
    expect(screen.getByText("Espinilleras obligatorias")).toBeInTheDocument();
    expect(getTeamNotesMock).toHaveBeenCalledWith("team-1");
  });

  it("no muestra la sección de notas cuando el equipo no tiene ninguna", async () => {
    getTeamNotesMock.mockResolvedValue([]);

    render(<ConvocationDetailsDialog {...baseProps} canCopyToWhatsApp={false} />);

    await waitFor(() => expect(getTeamNotesMock).toHaveBeenCalled());
    expect(screen.queryByRole("list", { name: /notas/i })).not.toBeInTheDocument();
  });

  it("muestra ambas equipaciones con sus colores y marca cuál se juega", () => {
    const kits = [
      { kitNumber: 1 as const, shirtColor: "#E53935", shortsColor: "#FFFFFF", socksColor: "#FFFFFF" },
      { kitNumber: 2 as const, shirtColor: "#1E88E5", shortsColor: "#1E88E5", socksColor: "#1E88E5" },
    ];
    render(
      <ConvocationDetailsDialog
        {...baseProps}
        kits={kits}
        selectedKitNumber={1}
        canCopyToWhatsApp={false}
      />,
    );

    expect(screen.getByText(/se juega con esta/i)).toBeInTheDocument();
    expect(screen.getByText(/traer también/i)).toBeInTheDocument();
    // Both kit shirt colors named
    expect(screen.getByText(/rojo/i)).toBeInTheDocument();
    expect(screen.getByText(/azul/i)).toBeInTheDocument();
  });

  it("no muestra la sección de equipaciones cuando no hay kits configurados", () => {
    render(<ConvocationDetailsDialog {...baseProps} kits={[]} selectedKitNumber={null} canCopyToWhatsApp={false} />);

    expect(screen.queryByText(/se juega con esta/i)).not.toBeInTheDocument();
  });

  it("muestra los convocados ordenados por dorsal ascendente, sin agrupar por posición", () => {
    const withDorsals: PlayerResponse[] = [
      { id: "p1", name: "Sin", lastName: "Dorsal", alias: "", dorsal: null, position: "Delantero" },
      { id: "p2", name: "Diez", lastName: "García", alias: "", dorsal: 10, position: "Defensa" },
      { id: "p3", name: "Uno", lastName: "Pérez", alias: "", dorsal: 1, position: "Portero" },
    ];
    render(
      <ConvocationDetailsDialog
        {...baseProps}
        players={withDorsals}
        calledIds={["p1", "p2", "p3"]}
        canCopyToWhatsApp={false}
      />,
    );

    const names = screen.getAllByText(/Uno Pérez|Diez García|Sin Dorsal/).map((el) => el.textContent);
    expect(names).toEqual(["Uno Pérez", "Diez García", "Sin Dorsal"]);
    expect(screen.queryByText(/porteros|defensas|delanteros|medios/i)).not.toBeInTheDocument();
  });
});
