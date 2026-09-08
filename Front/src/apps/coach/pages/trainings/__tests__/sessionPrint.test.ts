import { describe, expect, it } from "vitest";
import { buildSessionPrintHtml } from "../sessionPrint";
import type { Exercise, TrainingSessionDetail } from "../../../types/training";

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex1",
    name: "Rondo 4v2",
    tipo: "Analitico",
    objetivo: "Mantener la posesión bajo presión",
    modelRelations: [],
    nivelesColumnas: [],
    niveles: [],
    logistica: "4 conos, 2 balones",
    descripcion: "",
    isAssociatedToGameModel: false,
    ...overrides,
  };
}

function buildSession(overrides: Partial<TrainingSessionDetail> = {}): TrainingSessionDetail {
  return {
    id: "sess-1",
    name: "Sesión de presión alta",
    description: "",
    date: "2026-09-10",
    startTime: "18:00:00",
    endTime: "19:30:00",
    location: "Campo 2",
    isAssociatedToPlan: false,
    blocks: [],
    targets: [],
    ...overrides,
  };
}

describe("buildSessionPrintHtml", () => {
  it("incluye el nombre y el horario de la sesión", () => {
    const html = buildSessionPrintHtml(buildSession());
    expect(html).toContain("Sesión de presión alta");
    expect(html).toContain("18:00");
    expect(html).toContain("19:30");
    expect(html).toContain("Campo 2");
  });

  it("indica sesión sin programar cuando no tiene fecha", () => {
    const html = buildSessionPrintHtml(buildSession({ date: null, startTime: null, endTime: null }));
    expect(html).toContain("Sin fecha (sin programar)");
  });

  it("incluye el evento deportivo solo cuando está presente", () => {
    const withEvent = buildSessionPrintHtml(buildSession({ sportEventName: "Jornada 3 vs CD Rival" }));
    expect(withEvent).toContain("Jornada 3 vs CD Rival");

    const withoutEvent = buildSessionPrintHtml(buildSession({ sportEventName: null }));
    expect(withoutEvent).not.toContain('<span class="pill">');
  });

  it("incluye el objetivo general y el mapa de campo solo cuando están presentes", () => {
    const html = buildSessionPrintHtml(
      buildSession({ objetivoGeneral: "Mejorar la salida de balón", mapaCampoTexto: "Ver anexo táctico" }),
    );
    expect(html).toContain("Mejorar la salida de balón");
    expect(html).toContain("Ver anexo táctico");

    const empty = buildSessionPrintHtml(buildSession({ objetivoGeneral: null, mapaCampoTexto: null }));
    expect(empty).not.toContain("Objetivo general");
    expect(empty).not.toContain("Mapa de campo");
  });

  it("renderiza los bloques con su conexión con el anterior y sus ejercicios", () => {
    const html = buildSessionPrintHtml(
      buildSession({
        blocks: [
          {
            id: "b1",
            order: 1,
            nombre: "Activación",
            comoConectaConAnterior: "Primer bloque de la sesión",
            rotacionEntreEjercicios: "Cambio cada 8 minutos",
            exercises: [
              { id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2", exerciseDurationMinutes: 15 },
            ],
          },
        ],
      }),
    );
    expect(html).toContain("Activación");
    expect(html).toContain("Primer bloque de la sesión");
    expect(html).toContain("Cambio cada 8 minutos");
    expect(html).toContain("Rondo 4v2");
    expect(html).toContain("15 min");
  });

  it("no renderiza la sección de bloques cuando no hay bloques", () => {
    const html = buildSessionPrintHtml(buildSession({ blocks: [] }));
    expect(html).not.toContain("Bloques");
  });

  it("renderiza los objetivos ADN agrupados por fase/principio/subprincipio", () => {
    const html = buildSessionPrintHtml(
      buildSession({
        targets: [
          {
            subSubPrincipioId: "ssp-1",
            rol: "Central",
            numero: "1.1.1",
            subprincipioId: "sp-1",
            subprincipioTitulo: "Presión alta",
            principioId: "p-1",
            principioTitulo: "Presión",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
          },
        ],
      }),
    );
    expect(html).toContain("Objetivos ADN");
    expect(html).toContain("Fase defensiva");
    expect(html).toContain("Presión");
    expect(html).toContain("Presión alta");
    expect(html).toContain("Central (1.1.1)");
  });

  it("no renderiza la sección de objetivos ADN cuando no hay targets", () => {
    const html = buildSessionPrintHtml(buildSession({ targets: [] }));
    expect(html).not.toContain("Objetivos ADN");
  });

  it("escapa HTML en campos de texto libre", () => {
    const html = buildSessionPrintHtml(buildSession({ objetivoGeneral: "<script>alert(1)</script>" }));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renderiza el contenido completo de un ejercicio cuando se provee su detalle", () => {
    const session = buildSession({
      blocks: [
        {
          id: "b1",
          order: 1,
          nombre: "Activación",
          comoConectaConAnterior: "",
          exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2" }],
        },
      ],
    });
    const exercisesById = new Map([
      [
        "ex1",
        buildExercise({
          objetivo: "Mantener la posesión bajo presión",
          nivelesColumnas: ["Nivel 1", "Nivel 2"],
          niveles: [{ nivel: 1, valores: { "Nivel 1": "3 toques", "Nivel 2": "2 toques" } }],
          modelRelations: [
            {
              id: "rel1",
              subprincipioId: "sp-1",
              subprincipioNumero: "1.1",
              subprincipioTitulo: "Presión alta",
              isFoco: true,
              habilidadesImprescindibles: ["Anticipación"],
              items: [],
            },
          ],
        }),
      ],
    ]);

    const html = buildSessionPrintHtml(session, exercisesById);

    expect(html).toContain("Mantener la posesión bajo presión");
    expect(html).toContain("3 toques");
    expect(html).toContain("Presión alta");
    expect(html).toContain("Anticipación");
  });

  it("incluye la imagen del ejercicio cuando tiene urlImage", () => {
    const session = buildSession({
      blocks: [
        {
          id: "b1",
          order: 1,
          nombre: "Activación",
          comoConectaConAnterior: "",
          exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2" }],
        },
      ],
    });
    const exercisesById = new Map([["ex1", buildExercise({ urlImage: "exercises/rondo.png" })]]);

    const html = buildSessionPrintHtml(session, exercisesById);

    expect(html).toContain("<img");
    expect(html).toContain("rondo.png");
  });

  it("pinta el dibujo real de la pizarra cuando el ejercicio no tiene imagen", () => {
    const session = buildSession({
      blocks: [
        {
          id: "b1",
          order: 1,
          nombre: "Activación",
          comoConectaConAnterior: "",
          exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2" }],
        },
      ],
    });
    const boardStateJson = JSON.stringify({
      placedChapas: { p1: { x: 10, y: 10 } },
    });
    const exercisesById = new Map([["ex1", buildExercise({ boardStateJson })]]);

    const html = buildSessionPrintHtml(session, exercisesById);

    expect(html).toContain("Vista previa de la pizarra");
    expect(html).not.toContain("pizarra táctica disponible al editar el ejercicio");
    expect(html).not.toContain("<img");
  });

  it("resuelve dorsal/alias del jugador en el dibujo de pizarra cuando se provee el roster", () => {
    const session = buildSession({
      blocks: [
        {
          id: "b1",
          order: 1,
          nombre: "Activación",
          comoConectaConAnterior: "",
          exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2" }],
        },
      ],
    });
    const boardStateJson = JSON.stringify({
      placedChapas: { "player-1": { x: 10, y: 10 } },
    });
    const exercisesById = new Map([["ex1", buildExercise({ boardStateJson })]]);
    const playersById = new Map([["player-1", { id: "player-1", name: "Ana", alias: "Ani", dorsal: 9 } as any]]);

    const html = buildSessionPrintHtml(session, exercisesById, playersById);

    expect(html).toContain("Ani");
    expect(html).toContain(">9<");
  });

  it("recurre al resumen del ejercicio cuando no se provee su detalle completo", () => {
    const session = buildSession({
      blocks: [
        {
          id: "b1",
          order: 1,
          nombre: "Activación",
          comoConectaConAnterior: "",
          exercises: [
            { id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2", exerciseDurationMinutes: 15 },
          ],
        },
      ],
    });

    const html = buildSessionPrintHtml(session);

    expect(html).toContain("Rondo 4v2");
    expect(html).toContain("15 min");
  });
});
