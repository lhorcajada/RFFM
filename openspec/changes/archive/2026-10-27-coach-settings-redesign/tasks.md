## 1. Navegación de secciones (~1h)

- [x] Red: `Settings.nav.test.tsx` — escritorio: botones con `aria-current`; móvil: selector oculta la lista, la despliega y cambia de sección; jugador solo ve «Notificaciones».
- [x] Green: `Settings.tsx` + `Settings.module.css`.

## 2. Listas en tarjetas y paneles (~2h)

- [x] Red: tests de `SeasonManager`, `ClubSelector`, `TeamManager` — sin tabla, activa/anteriores, panel «Editar temporada» / «Crear club».
- [x] Green: `SettingsRowCard` (highlighted), `SettingsDrawer`, `SeasonManager`, `SeasonEditorForm`, `ClubSelector`, `TeamManager`.

## 3. Notificaciones y colores (~30 min)

- [x] `NotificationSettings.module.css` y variables del tema en `Settings.module.css`.

## 4. Crear y editar equipo (~1h)

- [x] Red: `EditTeam.rffmCompetition.test.tsx` y `CreateTeam.test.tsx` — secciones con título y botón Cancelar.
- [x] Green: `EditTeam.tsx`, `CreateTeam.tsx`, `TeamForm.module.css`.

## 5. Cierre

- [x] Subir versión minor web (`npm version 1.83.0 --no-git-tag-version`).
- [x] `npx vitest run src/apps/coach/pages/settings` + `npm run build`.
- [x] `openspec validate coach-settings-redesign --strict`.
- [ ] Comprobación visual en navegador (desarrollo y producción).
- [ ] Commits tras confirmación del usuario.
