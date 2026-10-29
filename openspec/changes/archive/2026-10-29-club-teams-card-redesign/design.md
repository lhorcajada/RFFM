## Context

`ClubTeams.tsx` renderiza cada equipo con `DashboardCard` y ~30 variables `--rffm-club-teams-*`. El diseño aprobado (`.design/club-teams/`) usa tarjetas propias, sin tablas, mobile-first.

## Decisions

### D1 — Componente de tarjeta
`pages/clubTeams/components/ClubTeamCard.tsx` (+ `ClubTeamCard.module.css`). Props: `team`, `photoUrl`, `to`, `onCopyCode`, `onEdit`, `onDelete`, `deleteDisabled`. Área superior = `Link` a `to` (foto o `GroupsIcon`, nombre, meta); pie = código (si existe) + `IconButton` copiar/editar/eliminar con `aria-label` actuales («Copiar código de equipo», «Editar equipo», «Eliminar equipo»). Botones ≥44px.

### D2 — Página
`ClubTeams.tsx` conserva carga, fotos, filtros, agrupado y diálogo de borrado; solo cambia el marcado: se sustituye `DashboardCard` por `ClubTeamCard`, se añade el contador de equipos visibles y la rejilla pasa a `repeat(auto-fill, minmax(300px, 1fr))`. Meta = `Liga · Categoría` (`Sin liga`/`Sin categoría` por defecto).

### D3 — Estilos
CSS Modules co-ubicados; colores desde las variables existentes (`--rffm-card-bg`, `--rffm-card-text`, `--rffm-card-subtext`, `--rffm-primary`, `--rffm-dash-accent`, `--rffm-error`). Se eliminan las reglas `.cardWrap`, `.teamCard*`, `.teamPhoto`, `.code*`, `.footerRow` etc. que dejen de usarse. Sin tablas ni `style={{}}`.

### D4 — Tests
Vitest + Testing Library: `ClubTeamCard.test.tsx` (contenido, código ausente, callbacks, enlace) y `ClubTeams.test.tsx` (agrupado, filtros, contador, vacío, error, borrado con confirmación). Se mockean `teamService` y `seasonService`.
