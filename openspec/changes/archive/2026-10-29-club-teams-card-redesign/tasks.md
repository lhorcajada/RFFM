## 1. Tarjeta de equipo (~1h)

- [x] Red: `components/__tests__/ClubTeamCard.test.tsx` (nombre y «Liga · Categoría»; enlace; código y copiar; sin código; editar; eliminar; eliminar deshabilitado).
- [x] Green: `ClubTeamCard.tsx` + `ClubTeamCard.module.css` (D1, D3).
- **Verify**: `npx vitest run src/apps/coach/pages/clubTeams/components`.

## 2. Página (~1.5h)

- [x] Red: `__tests__/ClubTeams.test.tsx` (agrupado por categoría; filtros; contador; vacío; error; confirmar y cancelar borrado; copiar código).
- [x] Green: `ClubTeams.tsx` y `ClubTeams.module.css` con `ClubTeamCard` y rejilla responsive (D2, D3).
- [x] Subir la versión minor de la web (`Front/package.json`).
- **Verify**: `npx vitest run src/apps/coach/pages/clubTeams`.

## 3. Verificación final

- [x] Suite completa `npx vitest run --maxWorkers=2` y `npm run build` (una sola vez, al terminar).
- [ ] Comprobación visual a 390 px y a escritorio (pendiente de la persona usuaria).
- **Verify**: `openspec validate club-teams-card-redesign --strict`.
