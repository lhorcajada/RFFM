import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SessionTargetDetail, TrainingSession } from "../../../../../types/training";
import type { SessionAttendance } from "../../../hooks/usePlayerSessionAttendance";

const useSessionDetailMock = vi.fn();
vi.mock("../../../hooks/useSessionDetail", () => ({
  useSessionDetail: (id: string | null) => useSessionDetailMock(id),
}));

const useAttendanceMock = vi.fn();
vi.mock("../../../hooks/usePlayerSessionAttendance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../hooks/usePlayerSessionAttendance")>()),
  usePlayerSessionAttendance: (eventId: string | null, teamPlayerId: string) => useAttendanceMock(eventId, teamPlayerId),
}));

import SessionObservationForm from "../SessionObservationForm";

function target(overrides: Partial<SessionTargetDetail> = {}): SessionTargetDetail {
  return {
    subSubPrincipioId: "ssp-231",
    rol: "Extremo: fijar por dentro",
    numero: "2.3.1",
    subprincipioId: "s-23",
    subprincipioTitulo: "Circular para desordenar",
    zonaId: "z-1",
    zonaLabel: "Zona de Creación Rival",
    principioId: "p-2",
    principioTitulo: "Ataque posicional",
    gameMomentId: 2,
    gameMomentName: "Ataque organizado",
    ...overrides,
  };
}

const SESSION: TrainingSession = {
  id: "ses-1",
  name: "Sesión 1",
  description: "",
  date: "2026-10-14T00:00:00",
  startTime: null,
  sportEventId: "ev-1",
  isAssociatedToPlan: false,
  exerciseCount: 0,
  targets: [
    target(),
    target({ subSubPrincipioId: "ssp-232", numero: "2.3.2", rol: "Mediocentro: dar línea de pase", zonaId: null, zonaLabel: null }),
    target({
      subSubPrincipioId: "ssp-411",
      numero: "4.1.1",
      rol: "Todos: asegurar el pase tras robo",
      subprincipioId: "s-41",
      subprincipioTitulo: "Asegurar tras robo",
      zonaLabel: "Zona de Creación Propia",
      principioId: "p-4",
      principioTitulo: "Transición tras robo",
      gameMomentName: "Transición defensa-ataque",
    }),
  ],
};

function renderForm(
  onSubmit = vi.fn().mockResolvedValue([]),
  session: TrainingSession = SESSION,
) {
  render(<SessionObservationForm session={session} teamPlayerId="tp-1" saving={false} onSubmit={onSubmit} />);
  return onSubmit;
}

function block(title: string) {
  return screen.getByRole("group", { name: title });
}

async function rate(title: string, label: string, comment?: string) {
  await userEvent.click(within(block(title)).getByRole("button", { name: label }));
  if (comment) await userEvent.type(within(block(title)).getByLabelText(/comentario/i), comment);
}

function mockAttendance(attendance: SessionAttendance) {
  useAttendanceMock.mockReturnValue({ attendance, loading: false });
}

describe("SessionObservationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionDetailMock.mockReturnValue({ detail: null, loading: false });
    mockAttendance("attended");
  });

  it("usa la fecha de la sesión: no muestra campo de fecha ni buscador de subprincipio", () => {
    renderForm();

    expect(screen.getByText("14/10/2026 · Sesión 1")).toBeInTheDocument();
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /subprincipio/i })).not.toBeInTheDocument();
  });

  it("muestra un bloque por subprincipio con sus roles y zonas", () => {
    renderForm();

    const circular = block("Circular para desordenar");
    expect(within(circular).getByText("Ataque organizado · Ataque posicional")).toBeInTheDocument();
    expect(within(circular).getByText("2.3.1 Extremo: fijar por dentro · Zona de Creación Rival")).toBeInTheDocument();
    expect(within(circular).getByText("2.3.2 Mediocentro: dar línea de pase")).toBeInTheDocument();
    expect(block("Asegurar tras robo")).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /./ }).filter((g) => g.tagName === "FIELDSET")).toHaveLength(2);
  });

  it("pide el contenido de la sesión para mostrar qué se hizo", () => {
    renderForm();

    expect(useSessionDetailMock).toHaveBeenCalledWith("ses-1");
    expect(useAttendanceMock).toHaveBeenCalledWith("ev-1", "tp-1");
  });

  it("deshabilita Guardar mientras no se valore ningún subprincipio", () => {
    renderForm();

    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("crea una observación por cada subprincipio valorado con la fecha y el vínculo a la sesión", async () => {
    const onSubmit = renderForm();

    await rate("Circular para desordenar", "No lo hace", "Busca siempre el pase vertical");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      {
        date: "2026-10-14",
        subprincipioId: "s-23",
        assessment: "NotAchieved",
        comment: "Busca siempre el pase vertical",
        trainingSessionId: "ses-1",
      },
    ]);
  });

  it("tras guardar limpia los bloques guardados y conserva los que fallaron", async () => {
    renderForm(vi.fn().mockResolvedValue([1]));
    await rate("Circular para desordenar", "A veces");
    await rate("Asegurar tras robo", "No lo hace", "No asegura tras robo");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(within(block("Circular para desordenar")).getByRole("button", { name: "A veces" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
    expect(within(block("Asegurar tras robo")).getByRole("button", { name: "No lo hace" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(block("Asegurar tras robo")).getByLabelText(/comentario/i)).toHaveValue("No asegura tras robo");
  });

  it("avisa si la sesión no tiene subprincipios asociados", () => {
    renderForm(undefined, { ...SESSION, targets: [] });

    expect(screen.getByText(/esta sesión no tiene subprincipios del modelo de juego asociados/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });

  describe("asistencia", () => {
    it("si no asistió sin excusa avisa y pide explicarlo en el comentario", () => {
      mockAttendance("absent-unexcused");
      renderForm();

      expect(screen.getByText(/no asistió a este entrenamiento \(sin excusa\)/i)).toBeInTheDocument();
    });

    it("si no asistió con excusa lo indica", () => {
      mockAttendance("absent-excused");
      renderForm();

      expect(screen.getByText(/no asistió a este entrenamiento \(con excusa\)/i)).toBeInTheDocument();
    });

    it("si no asistió el comentario es obligatorio en lo que se valore", async () => {
      mockAttendance("absent-unexcused");
      renderForm();

      await rate("Circular para desordenar", "No lo hace");

      expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
      expect(within(block("Circular para desordenar")).getByText("Indica por qué: no asistió al entrenamiento")).toBeInTheDocument();

      await userEvent.type(within(block("Circular para desordenar")).getByLabelText(/comentario/i), "No vino, no lo trabajó");
      expect(screen.getByRole("button", { name: /guardar/i })).toBeEnabled();
    });

    it("si llegó tarde lo indica y el comentario sigue siendo opcional", async () => {
      mockAttendance("late");
      renderForm();

      expect(screen.getByText(/llegó tarde a este entrenamiento/i)).toBeInTheDocument();
      await rate("Circular para desordenar", "Lo hace");
      expect(screen.getByRole("button", { name: /guardar/i })).toBeEnabled();
    });

    it("si no hay asistencia registrada lo indica", () => {
      mockAttendance("unknown");
      renderForm();

      expect(screen.getByText(/no hay asistencia registrada para este jugador en esta sesión/i)).toBeInTheDocument();
    });

    it("si la sesión no está vinculada al calendario indica que no se puede comprobar", () => {
      mockAttendance("no-event");
      renderForm();

      expect(screen.getByText(/no se puede comprobar la asistencia/i)).toBeInTheDocument();
    });

    it("si asistió no muestra ningún aviso", () => {
      renderForm();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
