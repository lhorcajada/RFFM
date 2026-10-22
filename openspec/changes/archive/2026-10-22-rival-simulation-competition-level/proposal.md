## Why

El diagnóstico con datos reales de la jornada 1 (FEPE GETAFE III 'D' – U.D. MÓSTOLES BALOMPIÉ 'C', 2-2)
mostró que la fuerza de plantilla de `rival-match-simulation` iguala a los dos equipos (1,29 frente a 1,23)
cuando el rival es claramente superior:

- **Ignora la categoría**: un 4º de Segunda Infantil (0,67) puntúa mucho más que un 8º de Primera
  Infantil (0,22) y casi como un 3º de Primera (0,78).
- **Ignora la edad**: haber jugado ya en Cadete no aporta nada.
- **Tamaño de grupo**: solo ve a los jugadores de la liga, así que casi todos los grupos se estiman en 10
  equipos cuando tienen 14-18.
- **Titularidad y goles** se miden dentro del propio equipo y pesan un 40 %: premian ser titular en un
  equipo flojo.
- La diferencia de fuerza se **aplana** demasiado al convertirla en goles esperados.

## What Changes

- **Nivel de competición** de cada participación = rango de edad + rango de división, ambos leídos del
  nombre de la competición:
  - División: Tercera 0, Segunda 1, Primera 2, Preferente 3, Primera División Autonómica 4, División de
    Honor 5, Superliga 6.
  - Edad: Prebenjamín 0, Benjamín 1, Alevín 2, Infantil 3, Cadete 4, Juvenil 5, Aficionado 6. Una
    categoría de edad más equivale a una división más (Segunda Cadete = Primera Infantil).
- **Valor de un jugador** = nivel + puesto en el grupo (0-1, grupos de al menos 16 equipos) + pequeños
  desempates por titularidad (0,2) y goles (0,1). Con varias participaciones: 70 % la mejor + 30 % la media.
  Sin ninguna participación con nivel reconocible cuenta como jugador nuevo.
- **Fuerza del equipo** = `e^(0,6 · (valor del equipo − media de la liga))`, acotada a `[0,5, 2]`.
- **Versión del modelo** guardada en cada simulación por jornada: las jornadas **rellenadas a posteriori**
  se recalculan cuando cambia la versión; las congeladas en su momento real no se tocan nunca. El
  historial indica qué jornadas se calcularon a posteriori.
- Nueva migración `AddModelVersionToRffmRoundSimulations` con `ModelVersion` e `IsBackfilled`: la de
  `rival-simulation-history` ya está aplicada en la base de datos real y no se modifica.
- **Versiones**: se mantienen las de `rival-simulation-history` (API `1.29.0`, Web `1.58.0`), que aún no
  se han publicado; se commitean juntos.

## Capabilities

### New Capabilities
- `rival-simulation-competition-level`: fuerza de plantilla según nivel de competición y edad, y
  recálculo versionado de las jornadas rellenadas a posteriori.

## Impact

- `Back/ExtractionApi`: `Domain/Services/MatchSimulation/CompetitionLevel.cs` (nuevo),
  `SquadStrengthCalculator.cs`, `RffmRoundSimulation.cs`, `RivalRoundSimulationService.cs`,
  `GetRivalSimulationHistory.cs`, migración `AddRffmRoundSimulations` regenerada.
- `Front`: `rivalStatsService.ts` (`isBackfilled`) y `RivalSimulation.tsx` (aviso «calculada a posteriori»).
- **Fuera de alcance**: partidos jugados por participación (la RFFM no los da por equipo); calibración
  automática del factor 0,6; Mobile.
