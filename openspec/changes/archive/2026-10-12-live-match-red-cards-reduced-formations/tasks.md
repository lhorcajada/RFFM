Frontend en `Front/`, salvo el bloque 0. Cada tarea es Red → Green → Refactor; los tests van en el `__tests__/`
contiguo. Verificación de cada bloque: `npx vitest run src/apps/coach/pages/convocations`.

## 0. Backend: doble amarilla en las estadísticas

- [x] 0.1 Red→Green: `UnitTests/PlayerCardCountServiceTests.cs` +
      `PlayerCardCountService.CountCards` — dos amarillas del mismo jugador en un partido
      cuentan 0 amarillas y 1 roja; no afecta a otros jugadores. `dotnet test` en verde.

## 1. Lógica pura de expulsiones y esquemas reducidos

- [x] 1.1 Red→Green: `utils/__tests__/expulsions.test.ts` + `utils/expulsions.ts` —
      `getCardStatus` (sin tarjetas, una amarilla, roja directa, doble amarilla, amarilla + roja,
      tarjetas del rival ignoradas) y `getExpelledIds`.
- [x] 1.2 Red→Green: `apps/coach/types/__tests__/formation.reduced.test.ts` + `apps/coach/types/formation.ts` —
      `REDUCED_FORMATIONS` (cada esquema de N tiene N casillas, `slotIndex` 0..N-1, PT en 0,
      coordenadas dentro del campo y sin solaparse), `formationsForPlayerCount`,
      `defaultReducedFormation` (mismo número de defensas; si no, el por defecto).
- [x] 1.3 Red→Green: `relocateAfterExpulsion` — expulsado de campo (portero se queda), portero
      expulsado (el elegido por `pickIndex` pasa al 0), sin huecos, expulsado fuera del resultado.

## 2. `useLiveMatch`: expulsión y esquema actual

- [x] 2.1 Red→Green: `hooks/__tests__/useLiveMatch.expulsion.test.tsx` —
      `currentFormation` se inicializa en `initMatch`, lo actualiza `changeFormation`, se guarda
      en el backup y se restaura; backup antiguo sin el campo usa el último `formationChanges`.
- [x] 2.2 Red→Green: `hooks/__tests__/useLiveMatch.expulsion.test.tsx` — roja directa y doble
      amarilla sacan al jugador (`isOnField: false`, minutos congelados), aplican el esquema
      reducido, añaden un `FormationChangeEvent`, no añaden ventana de cambios; roja rival y
      roja en `finished` no tocan el campo; segunda expulsión baja a 9.
- [x] 2.3 Red→Green: mismo archivo — portero expulsado: slot 0 ocupado por otro jugador.
- [x] 2.5 Red→Green: `hooks/__tests__/useLiveMatch.expulsion.test.tsx` — una ventana en
      la que solo se rellena una casilla vacía no cuenta para el cupo; quitar la tarjeta no
      mueve jugadores ni cambia el esquema.
- [x] 2.4 Red→Green: `hooks/__tests__/useLiveMatch.expulsion.test.tsx` — con 7 en el campo la
      roja queda en `pendingMinPlayersCard` sin registrar; `cancelMinPlayersEnd` no deja rastro;
      `confirmMinPlayersEnd` registra la tarjeta y deja `matchPhase: "finished"`.

## 3. Guardado automático

- [x] 3.1 Red→Green: `hooks/__tests__/useLiveMatch.autoSave.test.tsx` — `endMatch` llama a
      `saveMatchParticipation` una sola vez con marcador, tarjetas y minutos finales;
      `confirmMinPlayersEnd` también; fallo → `saveError` y `retrySave` vuelve a guardar.
- [x] 3.2 Eliminar `requestSave`/`confirmSave`/`cancelSave`/`isSaveConfirmOpen` del hook, el
      botón «Guardar datos del partido» y su diálogo en `PartidoEnDirectoTab`; botón
      «Reintentar» en el snackbar de error. Actualizar los mocks de `useLiveMatch` de los tests
      existentes de `PartidoEnDirectoTab`.

## 4. UI: tarjetas en la foto y expulsados en el banquillo

- [x] 4.1 Red→Green: `simulation/__tests__/PlayerCardBadge.test.tsx` + componente y CSS Module.
- [x] 4.2 Red→Green: prop `cardStatus` en `SimulationPlayerSlot` y `CompactBenchCard`;
      `SimulationField` recibe `cardStatusById`.
- [x] 4.3 Red→Green: `components/__tests__/PartidoEnDirectoTab.expulsion.test.tsx` — el
      expulsado aparece en el banquillo con su indicador, no es arrastrable en «preparar
      cambio» y soltarlo sobre una casilla no llama a `movePreparePlayer`.
- [x] 4.4 Red→Green: el selector «Esquema» lista solo los esquemas del número de jugadores
      permitido (11 − expulsados), también tras quitar una tarjeta; el campo usa `live.currentFormation` (se elimina el estado local `formationId`).

## 5. UI: botones de eventos y mínimo de jugadores

- [x] 5.1 Red→Green: `simulation/__tests__/LiveMatchEventButtons.test.tsx` + componente —
      cuatro botones con sus textos, deshabilitados en `preMatch` y `finished`; «Gol a favor»
      como visitante suma al visitante; «Tarjeta rival» abre el diálogo en modo rival.
- [x] 5.2 Red→Green: prop `side` en `CardEventDialog`.
- [x] 5.3 Quitar los botones y diálogos de `LiveMatchScoreboard`; actualizar
      `LiveMatchScoreboard.test.tsx` y los tests `.mobile`/`.mobileActions`.
- [x] 5.4 Red→Green: `components/__tests__/PartidoEnDirectoTab.expulsion.test.tsx` — con
      `pendingMinPlayersCard` se muestra el `ConfirmDialog`; confirmar y cancelar llaman a la
      acción correspondiente.

## 6. Cierre

- [x] 6.1 `npm run build` y `npm run test` completos en verde.
- [ ] 6.2 Comprobación visual a ~380px y en tablet apaisada (tarjetas en la foto, apartado de
      botones, esquemas reducidos).
- [x] 6.3 Subir la versión minor de `Front/package.json` y patch de la API
      (`Directory.Build.props`), cada una en su commit.
- [x] 6.4 `openspec validate live-match-red-cards-reduced-formations --strict`.
