import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayerPhysicalEvolution as Evolution } from "../../../../services/teamPlayerStatisticsService";

type MockSeries = { label: string; data: (number | null)[] };
type MockChartProps = {
  series: MockSeries[];
  xAxis: { data: Date[] }[];
  onAxisClick?: (event: unknown, data: { dataIndex: number } | null) => void;
  children?: React.ReactNode;
};

vi.mock("@mui/x-charts/LineChart", () => ({
  LineChart: ({ series, xAxis, onAxisClick, children }: MockChartProps) => (
    <div data-testid="line-chart">
      {series.map((s) => (
        <span key={s.label}>{`serie:${s.label}:${s.data.join(",")}`}</span>
      ))}
      <span>{`dias:${xAxis[0].data.length}`}</span>
      {xAxis[0].data.map((_, i) => (
        <button key={i} type="button" onClick={() => onAxisClick?.({}, { dataIndex: i })}>
          {`dia-${i}`}
        </button>
      ))}
      {children}
    </div>
  ),
}));

vi.mock("@mui/x-charts/ChartsReferenceLine", () => ({
  ChartsReferenceLine: ({ label }: { label?: string }) => <span>{`ref:${label ?? ""}`}</span>,
}));

const getPlayerPhysicalEvolutionMock = vi.fn();
vi.mock("../../../../services/teamPlayerStatisticsService", () => ({
  getPlayerPhysicalEvolution: (...args: unknown[]) => getPlayerPhysicalEvolutionMock(...args),
}));

import PlayerPhysicalEvolution from "../PlayerPhysicalEvolution";

const EVOLUTION: Evolution = {
  teamPlayerId: "tp-1",
  days: 28,
  formStatusAvailable: true,
  points: [
    { date: "2026-09-27T00:00:00Z", formStatus: null, readiness: 73, fatigue: 23 },
    { date: "2026-09-28T00:00:00Z", formStatus: 54, readiness: 72, fatigue: 50 },
    { date: "2026-09-29T00:00:00Z", formStatus: 60, readiness: 71, fatigue: 40 },
    { date: "2026-09-30T00:00:00Z", formStatus: 62, readiness: 70, fatigue: 35 },
  ],
  events: [
    { date: "2026-09-28T19:00:00Z", eventId: "t1", eventTypeId: 2, kind: "Training", trainingTypes: ["Fisico"], minutesPlayed: 0 },
    { date: "2026-09-29T11:00:00Z", eventId: "m1", eventTypeId: 1, kind: "Match", trainingTypes: [], minutesPlayed: 60 },
  ],
  injuries: [{ startDate: "2026-09-27T00:00:00Z", endDate: null }],
};

const renderSection = () => render(<PlayerPhysicalEvolution teamId="team-1" teamPlayerId="tp-1" />);

describe("PlayerPhysicalEvolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayerPhysicalEvolutionMock.mockResolvedValue(EVOLUTION);
  });

  it("pinta las tres series con los valores diarios", async () => {
    renderSection();

    expect(await screen.findByText("serie:Forma:,54,60,62")).toBeInTheDocument();
    expect(screen.getByText("serie:Rodaje:73,72,71,70")).toBeInTheDocument();
    expect(screen.getByText("serie:Cansancio:23,50,40,35")).toBeInTheDocument();
  });

  it("resume el valor actual y la variación del periodo de cada métrica", async () => {
    renderSection();

    const summary = await screen.findByLabelText("Resumen del periodo");
    expect(within(summary).getByText("Forma 62 (+8)")).toBeInTheDocument();
    expect(within(summary).getByText("Rodaje 70 (−3)")).toBeInTheDocument();
    expect(within(summary).getByText("Cansancio 35 (+12)")).toBeInTheDocument();
  });

  it("no muestra la Forma si la categoría no la tiene", async () => {
    getPlayerPhysicalEvolutionMock.mockResolvedValue({
      ...EVOLUTION,
      formStatusAvailable: false,
      points: EVOLUTION.points.map((p) => ({ ...p, formStatus: null })),
    });
    renderSection();

    await screen.findByText("serie:Rodaje:73,72,71,70");
    expect(screen.queryByText(/^serie:Forma/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Forma /)).not.toBeInTheDocument();
  });

  it("pide 8 semanas al seleccionar ese rango", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByTestId("line-chart");

    await user.click(screen.getByRole("button", { name: "8 semanas" }));

    expect(getPlayerPhysicalEvolutionMock).toHaveBeenLastCalledWith("team-1", "tp-1", 56);
  });

  it("marca los días de partido y el inicio de las lesiones", async () => {
    renderSection();

    expect(await screen.findByText("ref:Liga")).toBeInTheDocument();
    expect(screen.getByText("ref:Lesión")).toBeInTheDocument();
  });

  it("muestra hoy como día seleccionado por defecto", async () => {
    renderSection();

    const detail = await screen.findByLabelText("Día seleccionado");
    expect(within(detail).getByText("30/09")).toBeInTheDocument();
    expect(within(detail).getByText("Sin entrenos ni partidos")).toBeInTheDocument();
  });

  it("al seleccionar un día muestra sus valores y sus eventos", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByTestId("line-chart");

    await user.click(screen.getByRole("button", { name: "dia-1" }));

    const detail = screen.getByLabelText("Día seleccionado");
    expect(within(detail).getByText("28/09")).toBeInTheDocument();
    expect(within(detail).getByText("Forma 54")).toBeInTheDocument();
    expect(within(detail).getByText("Entreno · Físico")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "dia-2" }));
    expect(within(screen.getByLabelText("Día seleccionado")).getByText("Liga · 60'")).toBeInTheDocument();
  });

  it("muestra un indicador mientras carga", () => {
    getPlayerPhysicalEvolutionMock.mockReturnValue(new Promise(() => {}));
    renderSection();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("muestra un error con opción de reintentar", async () => {
    const user = userEvent.setup();
    getPlayerPhysicalEvolutionMock.mockRejectedValueOnce(new Error("network error"));
    renderSection();

    expect(await screen.findByText("No se pudo cargar la evolución")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByTestId("line-chart")).toBeInTheDocument();
  });

  it("indica que no hay actividad si el periodo está vacío", async () => {
    getPlayerPhysicalEvolutionMock.mockResolvedValue({
      ...EVOLUTION,
      points: EVOLUTION.points.map((p) => ({ ...p, formStatus: null, readiness: null, fatigue: 0 })),
      events: [],
      injuries: [],
    });
    renderSection();

    expect(await screen.findByText("Sin actividad en este periodo")).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });
});
