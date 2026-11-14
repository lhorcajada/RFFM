import { describe, it, expect } from "vitest";
import { actaPdfFileName, buildActaPdfModel } from "../actaPdfModel";
import type { Acta } from "../../types/acta";

const acta: Acta = {
  nombre_competicion: "SEGUNDA CADETE",
  nombre_grupo: "Grupo 34",
  jornada: "5",
  fecha: "08-11-2026",
  hora: "18:00",
  campo: "Campo Municipal",
  equipo_local: "ATLETICO TRABENCO",
  equipo_visitante: "FEPE GETAFE III 'D'",
  goles_local: "2",
  goles_visitante: "2",
  jugadores_equipo_local: [
    { codjugador: "L1", dorsal: "1", nombre_jugador: "Portero Local", titular: "1", portero: "1", capitan: "0" },
    { codjugador: "L9", dorsal: "9", nombre_jugador: "Delantero Local", titular: "1", capitan: "1" },
    { codjugador: "L12", dorsal: "12", nombre_jugador: "Suplente Local", titular: "0" },
  ],
  jugadores_equipo_visitante: [
    { codjugador: "V7", dorsal: "7", nombre_jugador: "Extremo Visitante", titular: "1" },
    { codjugador: "V14", dorsal: "14", nombre_jugador: "Suplente Visitante", titular: "0" },
  ],
  goles_equipo_local: [
    { codjugador: "L9", minuto: "10", tipo_gol: "100" },
    { codjugador: "L9", minuto: "70", tipo_gol: "101" },
  ],
  goles_equipo_visitante: [
    { codjugador: "V7", minuto: "30", tipo_gol: "100" },
    { codjugador: "L1", minuto: "55", tipo_gol: "102", nombre_jugador: "Portero Local" },
  ],
  sustituciones_equipo_local: [
    { minuto: "60", entradorsal: "12", nombre_jugador_entra: "Suplente Local", saledorsal: "9", nombre_jugador_sale: "Delantero Local" },
  ],
  sustituciones_equipo_visitante: [
    { Minute: "65", EnteringNumber: "14", EnteringPlayerName: "Suplente Visitante", ExitingNumber: "7", ExitingPlayerName: "Extremo Visitante" },
  ],
  tarjetas_equipo_local: [{ codjugador: "L9", minuto: "40", codigo_tipo_amonestacion: "100" }],
  tarjetas_equipo_visitante: [
    { codjugador: "V7", minuto: "80", codigo_tipo_amonestacion: "101" },
    { codjugador: "V14", minuto: "85", codigo_tipo_amonestacion: "102" },
  ],
  entrenador_local: "Pepe Entrenador",
  delegadolocal: "Luis Delegado",
  otros_tecnicos_local: [{ cod_tecnico: "t1", tipo: "AUXILIAR ", nombre: "Ana Auxiliar" }],
  entrenador_visitante: "Lucio Coach",
  arbitros_partido: [{ cod_arbitro: "a1", tipo_arbitro: "ARBITRO", nombre_arbitro: "Juan Árbitro" }],
};

describe("buildActaPdfModel", () => {
  const model = buildActaPdfModel(acta);

  it("resume la cabecera con competición, grupo, jornada, fecha, hora y campo", () => {
    expect(model.matchInfo).toBe("SEGUNDA CADETE · Grupo 34 · Jornada 5");
    expect(model.placeInfo).toBe("08-11-2026 · 18:00 · Campo Municipal");
  });

  it("da el marcador con los dos equipos", () => {
    expect(model.scoreLine).toBe("ATLETICO TRABENCO 2 - 2 FEPE GETAFE III 'D'");
  });

  it("separa titulares y suplentes marcando capitán y portero", () => {
    expect(model.teams[0].starters).toEqual(["1  Portero Local (P)", "9  Delantero Local (C)"]);
    expect(model.teams[0].substitutes).toEqual(["12  Suplente Local"]);
  });

  it("lista los goles ordenados por minuto con el marcador en ese momento", () => {
    expect(model.goals).toEqual([
      "10'  ATLETICO TRABENCO · 9 Delantero Local   1 - 0",
      "30'  FEPE GETAFE III 'D' · 7 Extremo Visitante   1 - 1",
      "55'  FEPE GETAFE III 'D' · 1 Portero Local (en propia puerta)   1 - 2",
      "70'  ATLETICO TRABENCO · 9 Delantero Local (penalti)   2 - 2",
    ]);
  });

  it("describe los cambios aunque vengan con los campos en inglés", () => {
    expect(model.teams[0].substitutions).toEqual(["60'  Entra 12 Suplente Local · Sale 9 Delantero Local"]);
    expect(model.teams[1].substitutions).toEqual(["65'  Entra 14 Suplente Visitante · Sale 7 Extremo Visitante"]);
  });

  it("distingue tarjetas amarillas, rojas y doble amarilla", () => {
    expect(model.teams[0].cards).toEqual(["40'  Amarilla · 9 Delantero Local"]);
    expect(model.teams[1].cards).toEqual([
      "80'  Roja · 7 Extremo Visitante",
      "85'  Doble amarilla · 14 Suplente Visitante",
    ]);
  });

  it("incluye el cuerpo técnico de cada equipo y los árbitros", () => {
    expect(model.teams[0].staff).toEqual(["ENTRENADOR  Pepe Entrenador", "DELEGADO  Luis Delegado", "AUXILIAR  Ana Auxiliar"]);
    expect(model.teams[1].staff).toEqual(["ENTRENADOR  Lucio Coach"]);
    expect(model.referees).toEqual(["ARBITRO  Juan Árbitro"]);
  });

  it("no rompe con un acta casi vacía", () => {
    const empty = buildActaPdfModel({});
    expect(empty.goals).toEqual([]);
    expect(empty.teams[0].starters).toEqual([]);
    expect(empty.scoreLine).toBe("Local - Visitante");
  });
});

describe("actaPdfFileName", () => {
  it("nombra el archivo con los dos equipos", () => {
    expect(actaPdfFileName(acta)).toBe("Acta ATLETICO TRABENCO - FEPE GETAFE III 'D'.pdf");
  });
});
