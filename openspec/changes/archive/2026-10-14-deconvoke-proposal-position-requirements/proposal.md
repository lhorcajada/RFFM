## Why

La «Propuesta automática de desconvocatoria» ordena a los convocados por su puntuación y propone
desconvocar a los de menor puntuación sin mirar su posición. Solo garantiza que quede **un
portero**: puede proponer desconvocar a cuatro defensas, dejar al equipo sin delantero o sin
mediapunta. La regla `positionCoverageRule.ts` existe, pero no está registrada en
`rules/index.ts`, así que no tiene efecto. Además usa solo cuatro líneas (los extremos y los
medios de banda caen en «centrocampista») y solo conoce la posición activa, no las posiciones
posibles del jugador.

El entrenador necesita que la propuesta respete una estructura mínima por línea y que, cuando una
posición no se pueda cubrir con especialistas, cuente con jugadores polivalentes.

## What Changes

- **Cinco líneas con roles** a partir del catálogo `DemarcationMaster`:
  - Portero: POR.
  - Defensa: **lateral** (LI, LD; los carrileros se registran como laterales) y **central**
    (DFC, LIB).
  - Medio centro: **medio centro** (MC, MCD) y **mediapunta** (MCO).
  - Bandas: MI, MD, EI, ED.
  - Delantero: DC, SD.
- **Mínimos obligatorios entre los convocados que quedan** tras la propuesta:
  - ≥1 portero.
  - ≥2 laterales y ≥3 centrales.
  - ≥3 medios centro (MC/MCD) y ≥1 mediapunta (MCO).
  - ≥3 de banda **y** al menos 1 jugador más que pueda jugar en banda (posición posible).
  - ≥1 delantero **y** al menos 1 jugador más que pueda jugar de delantero (posición posible,
    p. ej. un mediapunta o un extremo).
- **La posición activa cubre los mínimos**. Las posiciones posibles solo se usan **como reserva**:
  cuando no hay suficientes especialistas convocados (lesiones, sanciones…), y para los
  polivalentes de banda y de delantero.
- **Selección por línea**: los jugadores se siguen eligiendo por puntuación, pero si desconvocar a
  uno deja su línea por debajo del mínimo, se protege y se pasa al siguiente candidato. Así, quien
  sale es el de menor puntuación **de una línea que tenga margen**.
- **Las desconvocatorias obligatorias** (lesión, disponibilidad…) se mantienen aunque rompan un
  mínimo. El objetivo de desconvocados (límite de 18) también se mantiene. Cuando un mínimo no se
  puede cumplir, la propuesta muestra un **aviso** (p. ej. «Solo quedan 2 centrales de 3»).
- En cada tarjeta de la propuesta se ve la **línea/rol** del jugador y, si se ha protegido, el
  motivo («Protegido: mínimo de 3 centrales»).
- **Backend**: `GET /api/catalog/team/{teamId}/players` devuelve además `activePositionId` y
  `possibleDemarcationIds`.
- Se elimina `positionCoverageRule.ts` (código sin uso), que se sustituye por el nuevo módulo de
  requisitos.
- **Versiones**: API minor (`1.26.0`), Web minor (`1.48.0`). Mobile no cambia.

## Capabilities

### New Capabilities
- `deconvoke-proposal-positions`: requisitos mínimos por posición en la propuesta automática de
  desconvocatoria, con cobertura de reserva mediante posiciones posibles.

## Impact

- `Back/ExtractionApi`: `Features/Coaches/Players/Queries/GetPlayersByTeam.cs` (dos campos más en
  la respuesta). Sin migración.
- `Front`: `services/teamplayerService.ts` (`PlayerResponse`),
  `pages/convocations/utils/positionRequirements.ts` (nuevo), `utils/deconvokeProposal.ts`
  (selección y avisos), `components/ConvocationTab.tsx` (chip de rol + avisos);
  se elimina `utils/rules/positionCoverageRule.ts`.
- **Fuera de alcance**: mínimos configurables por equipo (por ahora son constantes en un solo
  módulo), distinguir banda izquierda/derecha, Mobile, PDF de la propuesta
  (`ConvocatoriaPrint`), cambiar la puntuación de las reglas existentes.
