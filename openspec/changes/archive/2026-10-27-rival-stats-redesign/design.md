## Context

`RivalStats` pinta una barra con la última actualización y una lista de `RivalTeamCard`; `RivalSimulation` pinta pestañas y tarjetas de partido/clasificación.

## Decisions

- **D1 · Resumen de liga**: con estado `Completed`, la barra superior pasa a un panel con «Equipos» (`teams.length`) y «Jugadores» (suma de `playerCount`), manteniendo «Última actualización», el aviso de espera y el botón «Actualizar». Sin props ni endpoints nuevos.
- **D2 · Tarjetas**: solo CSS Modules (escudo 44 px, cabecera `min-height: 64px`). Nombres accesibles sin cambios.
- **D3 · Probabilidades**: la barra usa `--mui-palette-primary-main` (local), neutro (empate) e info (visitante); desaparecen `success`/`error` de la barra. El borde de acierto/fallo de la tarjeta se conserva porque sí indica acierto.
- **D4 · Estilo**: sin `border-left`, solo tokens existentes, responsive con la rejilla `auto-fill` actual.

## Risks

- Tests existentes buscan textos exactos de probabilidades y botones: se conservan.
