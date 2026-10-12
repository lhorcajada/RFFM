## Why

En el partido en directo una tarjeta roja solo queda anotada en la lista de tarjetas: el
jugador sigue en el campo, el esquema sigue siendo de 11 y el entrenador tiene que vaciar una
casilla a mano, lo que deja huecos en el campo. Además, al terminar hay que acordarse de pulsar
«Guardar datos del partido», y los botones de gol y tarjeta están en el marcador, lejos del
banquillo, que es donde el entrenador trabaja en la tablet.

## What Changes

- **Expulsión automática**: una roja a un jugador propio, o su segunda amarilla, lo saca del
  campo al banquillo en ese minuto. Un expulsado no puede volver a entrar.
- **Tarjetas en la foto**: amarilla, roja o amarilla+roja (doble amarilla) sobre la foto del
  jugador, en el campo y en el banquillo.
- **Esquemas reducidos** (10, 9, 8 y 7 jugadores): al expulsar se aplica uno por defecto y el
  selector «Esquema» pasa a ofrecer solo los del número de jugadores actual.
- **Siempre hay portero**: si el expulsado es el portero, un jugador de campo al azar ocupa la
  portería hasta que el entrenador decida.
- **Mínimo de 7 jugadores**: la expulsión que dejaría al equipo con 6 pide confirmación para
  finalizar el partido; al confirmar se finaliza y se guarda con el marcador de ese momento.
- **Guardado automático al finalizar**: desaparecen el botón «Guardar datos del partido» y su
  confirmación. Se mantienen «Eliminar datos del partido» y la edición manual.
- **Botones de eventos bajo el banquillo**: «Gol a favor», «Gol en contra», «Tarjeta nuestra» y
  «Tarjeta rival», en un apartado propio; salen del marcador.
- **Doble amarilla en las estadísticas**: dos amarillas al mismo jugador en un partido cuentan
  como una roja y ninguna amarilla (estadísticas, ciclo de acumulación y sanción por
  expulsión), también en los partidos ya guardados.
- **Tarjeta puesta por error**: al quitarla, el selector vuelve a ofrecer los esquemas del
  número de jugadores permitido y el entrenador recoloca con un cambio; rellenar una casilla
  vacía sin que salga nadie no consume ventana de cambios.
- **Esquema actual tras recargar**: al recuperar un partido en curso se restaura el último
  esquema aplicado (hoy vuelve al de la alineación inicial).

## Non-goals

- Mobile y Federación no cambian; el contrato de `SaveMatchParticipation` es el mismo.
- Quitar una tarjeta puesta por error no devuelve al jugador al campo ni restaura el esquema
  automáticamente: lo hace el entrenador (ver «What Changes»).
- La pestaña de simulación no registra tarjetas y no cambia.
- Expulsiones del rival: se siguen anotando, sin efecto sobre el campo.
- Editar tarjetas desde la edición manual tras el partido no recoloca jugadores.

## Capabilities

### Modified Capabilities
- `coach-live-match-tracking`: expulsiones, esquemas reducidos, mínimo de jugadores, guardado
  automático y nuevo apartado de botones de eventos.

## Impact

- Backend (`back-specialist`): `Features/Coaches/Players/Services/PlayerCardCountService.cs`
  (regla de la doble amarilla; lo usan estadísticas, historial, tarjetas de temporada de Mobile
  y sanciones automáticas). Sin migraciones. Versión de la API +patch.
- Frontend (`front-specialist`): `types/formation.ts` (esquemas reducidos),
  `hooks/useLiveMatch.ts` (expulsión, guardado automático, esquema actual en el backup),
  `components/PartidoEnDirectoTab.tsx`, `simulation/LiveMatchScoreboard.tsx`,
  `simulation/SimulationPlayerSlot.tsx`, `simulation/CompactBenchCard.tsx`,
  `simulation/CardEventDialog.tsx`, nuevo `simulation/LiveMatchEventButtons.tsx` y nuevo
  `utils/expulsions.ts`. Sin librerías nuevas. Versión de `Front` +minor.
