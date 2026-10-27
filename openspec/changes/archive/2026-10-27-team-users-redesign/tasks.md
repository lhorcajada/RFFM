## 1. Filtros y contadores (~1h)

- [x] Red: tests — contadores, filtro Pendientes/Aprobados/Todos con `aria-pressed`, mensaje de filtro vacío.
- [x] Green: `TeamUsers.tsx`.

## 2. Tarjetas y estilos (~1h)

- [x] Red: test — avatar con la inicial; las existentes (roles, aprobación, eliminar) siguen en verde.
- [x] Green: `TeamUsers.tsx` + `TeamUsers.module.css`.

## 3. Cierre

- [x] Subir versión minor web (`npm version 1.84.0 --no-git-tag-version`).
- [x] `npx vitest run src/apps/coach/pages/team-users` + `npm run build`.
- [x] `openspec validate team-users-redesign --strict`.
- [x] Comprobación visual en navegador.
- [ ] Commits tras confirmación del usuario.
