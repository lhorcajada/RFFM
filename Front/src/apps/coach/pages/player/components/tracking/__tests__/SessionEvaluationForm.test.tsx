import { describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionEvaluationForm from "../SessionEvaluationForm";
import type { PlayerSessionListItem, SessionEvaluation } from "../../../../../services/playerTrackingService";
import type { SessionTargetDetail, TrainingSessionDetail } from "../../../../../types/training";

function target(overrides: Partial<SessionTargetDetail> = {}): SessionTargetDetail {
  return {
    subSubPrincipioId: "ssp-231",
    rol: "Extremo: fijar por dentro",
    numero: "2.3.1",
    subprincipioId: "s-23",
    subprincipioTitulo: "Circular para desordenar",
    zonaId: null,
    zonaLabel: "Zona de Creación Rival",
    principioId: "p-2",
    principioTitulo: "Ataque posicional",
    gameMomentId: 2,
    gameMomentName: "Ataque organizado",
    texto: "Fija por dentro para liberar el pasillo al lateral.",
    ...overrides,
  };
}

const SESSION: PlayerSessionListItem = {
  sessionId: "ses-1",
  name: "10. Desorganizar rival",
  date: "2026-10-01",
  isHeld: true,
  hasCalendarEvent: true,
  assistanceTypeId: 1,
  evaluation: null,
};

const DETAIL: TrainingSessionDetail = {
  id: "ses-1",
  name: "10. Desorganizar rival",
  description: "",
  date: "2026-10-01T00:00:00",
  startTime: null,
  isAssociatedToPlan: false,
  objetivoGeneral: "Desorganizar al rival antes de atacar",
  targets: [
    target(),
    target({
      subSubPrincipioId: "ssp-411",
      numero: "4.1.1",
      rol: "Todos: asegurar el pase",
      subprincipioId: "s-41",
      subprincipioTitulo: "Asegurar tras robo",
      principioTitulo: "Transición tras robo",
      gameMomentName: "Transición defensa-ataque",
    }),
  ],
  blocks: [
    {
      id: "b-1",
      order: 1,
      nombre: "Parte principal",
      exercises: [{ id: "e-1", exerciseId: "ex-1", position: 1, name: "Rondo 4x4+3", objetivo: "Circular con paciencia", durationMinutes: 15 }],
    },
  ],
};

function renderForm(props: Partial<React.ComponentProps<typeof SessionEvaluationForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <SessionEvaluationForm session={SESSION} detail={DETAIL} loadingDetail={false} initial={null} saving={false} onSubmit={onSubmit} {...props} />,
  );
  return onSubmit;
}

function block(title: string) {
  return screen.getByRole("group", { name: title });
}

describe("SessionEvaluationForm", () => {
  it("muestra la sesión, sus ejercicios y un bloque por subprincipio sin habilidades", () => {
    renderForm();

    expect(screen.getByText("01/10/2026 · 10. Desorganizar rival")).toBeInTheDocument();
    expect(screen.getByText("Rondo 4x4+3")).toBeInTheDocument();
    expect(screen.getByText("Circular con paciencia · 15'")).toBeInTheDocument();
    expect(within(block("Circular para desordenar")).getByText("2.3.1 Extremo: fijar por dentro · Zona de Creación Rival")).toBeInTheDocument();
    expect(block("Asegurar tras robo")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /habilidades/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Actitud" })).not.toBeInTheDocument();
  });

  it("muestra la descripción de cada sub-subprincipio de la sesión", () => {
    renderForm();

    expect(
      within(block("Circular para desordenar")).getByText("Fija por dentro para liberar el pasillo al lateral."),
    ).toBeInTheDocument();
  });

  it("deshabilita Guardar hasta valorar algún subprincipio y envía solo los valorados", async () => {
    const onSubmit = renderForm();
    const save = screen.getByRole("button", { name: /guardar/i });
    expect(save).toBeDisabled();

    await userEvent.click(within(block("Circular para desordenar")).getByRole("button", { name: "No lo hace" }));
    await userEvent.click(within(block("Circular para desordenar")).getByLabelText(/comentario/i));
    await userEvent.paste("Busca el pase vertical");
    await userEvent.click(save);

    expect(onSubmit).toHaveBeenCalledWith([{ subprincipioId: "s-23", assessment: "NotAchieved", comment: "Busca el pase vertical" }]);
  });

  it("al editar precarga las valoraciones guardadas", () => {
    const initial: SessionEvaluation = {
      id: "ev-1",
      trainingSessionId: "ses-1",
      sessionName: "10. Desorganizar rival",
      sessionDate: "2026-10-01",
      subprincipios: [
        {
          subprincipioId: "s-41",
          momentName: "Transición defensa-ataque",
          principleLabel: "4. Transición tras robo",
          subprincipioLabel: "4.1 Asegurar tras robo",
          assessment: "Partial",
          comment: "Mejora",
        },
      ],
      createdAt: "2026-10-01T20:00:00Z",
      updatedAt: "2026-10-01T20:00:00Z",
    };
    renderForm({ initial });

    expect(within(block("Asegurar tras robo")).getByRole("button", { name: "A veces" })).toHaveAttribute("aria-pressed", "true");
    expect(within(block("Asegurar tras robo")).getByLabelText(/comentario/i)).toHaveValue("Mejora");
    expect(screen.getByRole("button", { name: /guardar/i })).toBeEnabled();
  });

  it("si el jugador no asistió avisa y exige comentario en lo valorado", async () => {
    renderForm({ session: { ...SESSION, assistanceTypeId: 3 } });

    expect(screen.getByText(/no asistió a este entrenamiento \(sin excusa\)/i)).toBeInTheDocument();
    await userEvent.click(within(block("Circular para desordenar")).getByRole("button", { name: "A veces" }));

    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
    expect(within(block("Circular para desordenar")).getByText("Indica por qué: no asistió al entrenamiento")).toBeInTheDocument();
  });

  it("si la sesión no tiene subprincipios lo indica y no permite guardar", () => {
    renderForm({ detail: { ...DETAIL, targets: [] } });

    expect(screen.getByText(/esta sesión no tiene subprincipios del modelo de juego asociados/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });

  it("mientras carga el detalle muestra un indicador", () => {
    renderForm({ detail: null, loadingDetail: true });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("si falla el guardado conserva lo escrito", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("400"));
    renderForm({ onSubmit });
    await userEvent.click(within(block("Circular para desordenar")).getByRole("button", { name: "Lo hace" }));

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(within(block("Circular para desordenar")).getByRole("button", { name: "Lo hace" })).toHaveAttribute("aria-pressed", "true");
  });
});
