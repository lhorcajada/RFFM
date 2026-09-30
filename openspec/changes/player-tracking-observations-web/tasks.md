## 1. Servicio y hooks (~1h)

- [x] Red: `services/__tests__/playerTrackingService.test.ts`: URL del `GET` y URL + body del `POST`.
- [x] Red: `pages/player/hooks/__tests__/usePlayerObservations.test.ts`:
  - carga;
  - error con mensaje;
  - `reload`;
  - `create` inserta en orden (fecha desc).
- [x] Red: `pages/player/hooks/__tests__/useSubprincipioOptions.test.ts`:
  - aplana a `{ id, label, group }` en el orden del modelo;
  - sin temporada activa o sin modelo → `hasModel = false`.
- [x] Green: `playerTrackingService.ts`, `usePlayerObservations.ts`, `useSubprincipioOptions.ts` (design.md D1, D2).
- **Verify**: `npm run test -- playerTrackingService usePlayerObservations useSubprincipioOptions`.

## 2. Componentes (~1,5h)

- [x] Red: `components/tracking/__tests__/ObservationForm.test.tsx`:
  - «Guardar» deshabilitado sin subprincipio o sin valoración;
  - envía la request esperada;
  - tras guardar limpia los campos y mantiene la fecha;
  - con `hasModel = false` muestra el aviso.
- [x] Red: `components/tracking/__tests__/PlayerObservationList.test.tsx`:
  - tarjeta con fecha, valoración, «Fase · Principio», subprincipio y comentario;
  - vacío;
  - carga;
  - error + «Reintentar».
- [x] Red: `components/tracking/__tests__/PlayerTrackingPanel.test.tsx`:
  - guardar → snackbar de éxito y la observación aparece en la lista;
  - error → snackbar de error con `detail`.
- [x] Green: `ObservationForm.tsx`, `PlayerObservationList.tsx`, `PlayerTrackingPanel.tsx` + `.module.css` (D3).
- **Verify**: `npm run test -- tracking`.

## 3. Pestaña en la ficha (~0,5h)

- [x] Red: `pages/player/__tests__/PlayerDetail.trackingTab.test.tsx`: con acceso a `GameModel`, «Seguimiento» es la última pestaña y muestra el panel; sin acceso no aparece.
- [x] Green: pestaña y panel en `PlayerDetail.tsx` (D4).
- **Verify**: `npm run test -- PlayerDetail`.

## 4. Cierre

- [x] `npm run build` + `npm run test` (suite completa).
- [ ] Comprobación visual a ~360 px y en escritorio.
- [x] Subir la versión minor de la web (`npm version 1.1.0 --no-git-tag-version`).
- [x] `openspec validate player-tracking-observations-web --strict`.
- [ ] Commit `feat(front)` tras confirmación del usuario.
