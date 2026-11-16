## Why

Los jugadores y familiares de jugador no pueden entrar hoy en la pantalla de partido (`/coach/convocations/match`): la ruta está bloqueada con `allowPlayerAccess={false}`. Necesitan consultar la convocatoria y las desconvocatorias de su equipo y seguir el partido en directo, sin poder gestionar nada.

## What Changes

- Abrir las rutas `convocations/match` y `convocations/live` a los roles Player, FamilyPlayer y FamilyMember.
- En la pantalla de partido, para esos roles: solo las pestañas Desconvocatorias y Convocatoria (sin Alineación ni Simular Partido).
- En la barra de acciones, para esos roles: solo "Volver"; "Partido en directo" aparece únicamente cuando ya ha llegado la hora de inicio del evento.
- En la pestaña Convocatoria, para esos roles: solo lectura, sin "Proponer desconvocados", sin arrastrar ni mover jugadores.
- La pantalla de partido en directo se muestra en solo lectura (sin controles de acción).
- **Backend**: permitir la lectura del partido en directo (REST y unión al hub) a jugadores y familiares del equipo del evento; las acciones siguen siendo solo de coaches.

## Capabilities

### New Capabilities
- `player-family-match-view`: vista restringida y de solo lectura de la pantalla de partido para jugadores y familiares.

### Modified Capabilities
- `live-match-team-access`: la lectura del partido en directo y la unión al hub se abren a jugadores y familiares del equipo; las acciones siguen restringidas a coaches.

## Impact

- Front (`Front/src/apps/coach`): `routes.tsx`, `ConvocationMatchDetail.tsx`, `ConvocationMatchActionBar.tsx`, `ConvocationTab.tsx`, `LiveMatchPage.tsx`, `PartidoEnDirectoTab`, hook `useIsPlayerRole`.
- Back (`Back/ExtractionApi/.../Features/Coaches/LiveMatch`): `GetLiveMatch`, `LiveMatchHub` y el chequeo compartido de pertenencia al equipo.
- Versionado: `feat` en Front (minor) y en API (minor).

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/routes.tsx
- Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx
- Front/src/apps/coach/pages/convocations/components/ConvocationMatchActionBar.tsx
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- Front/src/apps/coach/pages/convocations/components/convocationMatchDetail.types.ts
- Front/src/apps/coach/pages/convocations/LiveMatchPage.tsx
- Front/src/apps/coach/components/RequireFeaturePermission.tsx
- Front/src/apps/coach/hooks/isPlayerRole.ts
- Front/src/apps/coach/pages/attendance/AttendanceEvent.tsx
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/GetLiveMatch.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchHub.cs
- openspec/specs/live-match-team-access/spec.md

**External URLs**:
<!-- none -->

## Additional Notes

- `computeIsPlayerRole` ya devuelve false si el usuario también es Coach o Administrator, así que esos usuarios mantienen la vista completa.
- `GetLiveMatch` tiene `[Authorize(Roles = "Coach,Administrator")]`; el hub solo `[Authorize]` con comprobación de equipo.
- Los endpoints que alimentan Convocatoria/Desconvocatorias (`useConvocationManagement`, `useDesconvocatoriasGrid`) deben verificarse con un usuario jugador: si devuelven 403 habrá que abrirlos en lectura.
