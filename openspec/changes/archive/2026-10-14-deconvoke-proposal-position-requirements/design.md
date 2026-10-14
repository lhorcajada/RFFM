## Context

- `buildDeconvokeProposal` (`Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts`)
  calcula una puntuación de protección por jugador (reglas en `utils/rules/`), los ordena
  (primero los obligatorios y después de menor a mayor puntuación) y toma los `targetCount`
  primeros. Después aplica una sola corrección: si no queda ningún portero, cambia uno.
- `positionCoverageRule.ts` no está en `RULES` (`rules/index.ts`), así que no se ejecuta.
  `getPositionGroup` está duplicado en `deconvokeProposal.ts` y `positionCoverageRule.ts`, y en
  ambos casos clasifica por subcadenas del nombre.
- `PlayerResponse` solo tiene `position` (el nombre de la demarcación activa). Las posiciones
  posibles (`Demarcation.PossibleDemarcationIds`) solo se exponen en `GetTeamPlayer` (detalle).
- Catálogo `DemarcationMaster`: 1 POR, 2 LI, 3 LD, 4 DFC, 5 LIB, 6 MC, 7 MCD, 8 MCO, 9 MI, 10 MD,
  11 DC, 12 SD, 13 EI, 14 ED.

## Goals / Non-Goals

**Goals**: mínimos por rol aplicados a la selección, cobertura de reserva con posiciones
posibles, avisos cuando un mínimo no se cumple y visibilidad del motivo en cada tarjeta.

**Non-Goals**: mínimos configurables por equipo, cambiar la puntuación de las reglas, Mobile,
PDF de la propuesta.

## Decisions

### D1 · Backend: ids de demarcación en el listado
`GetPlayersByTeam.PlayersByTeamResponse` añade `int? ActivePositionId` e
`int[] PossibleDemarcationIds`. Se proyecta `tp.Demarcation.PossibleDemarcationIds` en el
`Select` anónimo (es un VO owned; si EF no lo traduce, se materializa `tp.Demarcation` y se mapea
en memoria, igual que ya se hace con el nombre). `null` → `[]`. Se usan ids en vez de nombres para
no depender de cómo se escriben los textos.

### D2 · `positionRequirements.ts` (función pura y testeable)
```ts
export type PositionRole = "goalkeeper" | "fullBack" | "centreBack" | "centralMid"
  | "attackingMid" | "wide" | "forward";
export function roleFromDemarcationId(id: number | null | undefined): PositionRole | null;
export function roleFromPositionName(name: string | null | undefined): PositionRole | null; // fallback
export const ROLE_MINIMUMS: Record<PositionRole, number> =
  { goalkeeper: 1, fullBack: 2, centreBack: 3, centralMid: 3, attackingMid: 1, wide: 3, forward: 1 };
export const EXTRA_COVER = { wide: 1, forward: 1 } as const; // polivalentes además del mínimo
export type PositionPlayer = { id: string; role: PositionRole | null; possibleRoles: PositionRole[] };
export type PositionShortfall = { requirement: RequirementKey; label: string; required: number; remaining: number };
export function evaluateRequirements(players: PositionPlayer[]): {
  shortfalls: PositionShortfall[]; deficit: number; coverAssignments: Map<string, RequirementKey>;
};
```
`RequirementKey` = los siete roles + `wideCover` + `forwardCover`. El rol sale de
`activePositionId`; si falta, se usa `roleFromPositionName(position)` con los 14 nombres del
catálogo normalizados (sin tildes ni mayúsculas) y, como último recurso, las subcadenas actuales.

Evaluación:
1. Contar los roles activos.
2. Para cada rol por debajo de su mínimo, buscar **reservas**: jugadores con ese rol entre sus
   `possibleRoles`, cuyo rol activo sea otro y tenga **excedente** (cuenta > mínimo). Se asignan
   uno a uno restando el excedente de su rol. Así una reserva nunca abre un hueco nuevo.
3. Cobertura extra: «puede jugar en banda» = jugadores de banda + cualquier otro con banda en
   `possibleRoles` que no esté asignado como reserva en el paso 2. Se exige ≥ `wide + 1`. Lo mismo
   para delantero (≥ `forward + 1`).
4. `deficit` = suma de `max(0, requerido − quedan)`. `shortfalls` = requisitos con déficit > 0.

Etiquetas: Porteros, Laterales, Centrales, Medios centro, Mediapuntas, Bandas,
Cobertura de banda, Delanteros, Cobertura de delantero → «Centrales: quedan 2 de 3».

### D3 · Selección en `buildDeconvokeProposal`
Se sustituye `slice(0, targetCount)` + la corrección del portero por:
1. `selected` = todos los `forced` (siempre, aunque rompan mínimos).
2. Recorrer los no obligatorios por puntuación ascendente mientras `selected < targetCount`:
   si quitar al candidato empeora el `deficit` (con reservas) **o** el `specialistDeficit`
   (solo posiciones activas), se **protege** (guardando el primer requisito que empeora); si no,
   se selecciona. El segundo criterio evita que un polivalente "tape" la salida de un
   especialista disponible: las reservas solo cubren huecos de obligatorios o de plantilla corta.
3. Si aún falta para llegar al objetivo, segunda pasada sobre los protegidos: se elige el que
   menos aumenta el `deficit`, después el `specialistDeficit` y, en caso de empate, el de menor
   puntuación, hasta llegar al objetivo. Esos dejan de estar protegidos.
4. `positionWarnings = evaluateRequirements(quedan finales).shortfalls`.

Así, en una línea con margen, sale el de menor puntuación de esa línea (D3.2 recorre por
puntuación), que es la «valoración dentro de la línea» que se pide, sin tocar las reglas de
puntuación.

### D4 · Cambios de tipos
- `PlayerResponse`: `activePositionId?: number | null; possibleDemarcationIds?: number[] | null`.
- `PlayerProposal`: `positionRole: PositionRole | null`. A los protegidos que no se proponen se les
  añade el factor `{ key: "positionProtection", label: "Protegido: mínimo de 3 centrales" |
  "Protegido: cobertura de delantero" …, value: requerido, impact: 0 }`.
- `DeconvokeProposal`: `positionWarnings: PositionShortfall[]`.
- `formatProposalFactorValue`: `positionProtection` → número entero.

### D5 · UI (`ConvocationTab.tsx`)
- El chip de posición muestra el rol en español (`roleLabel(positionRole)`, «Sin posición» si es
  `null`) seguido del nombre de la demarcación activa en un `title`.
- Bajo el subtítulo de la cabecera, si hay `positionWarnings`, un `Alert severity="warning"` de MUI
  con la lista. No se usan tablas y no se fijan anchos; se mantienen los estilos existentes.

### D6 · Limpieza
Se eliminan `utils/rules/positionCoverageRule.ts` y `getPositionGroup`, `FORMATION_STARTERS`,
`POSITION_MIN_CONVOKED` y `positionGroupCounts` de `deconvokeProposal.ts`. Hay que comprobar que
`RuleContext` no los necesita o quitarlos de `rules/types.ts`.

## Risks / Trade-offs

- La cobertura con reservas es voraz, no un emparejamiento óptimo. Con plantillas de unos 25
  jugadores y requisitos pequeños es suficiente, y nunca empeora el rol del que sale la reserva.
- Jugadores sin demarcación no cuentan: si la plantilla no tiene posiciones cargadas, saldrán
  avisos. Es el comportamiento que queremos, porque hace visible que falta ese dato.
- Coste O(n²) en evaluaciones (n ≈ 25): despreciable.
