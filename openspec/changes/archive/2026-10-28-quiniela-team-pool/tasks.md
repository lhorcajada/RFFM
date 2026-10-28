## 1. Backend: dominio y scoring (~2h)

- [x] Red: tests de dominio `QuinielaScoring` (aciertos, categorías, partido inválido ignorado, bote, redondeo, 55/45).
- [x] Red: tests de `QuinielaJornada`/`QuinielaTicket` (fábricas, cierre por primer partido, plazo viernes 23:59, expirado derivado).
- [x] Green: entidades, SmartEnums, `QuinielaScoring`, `TeamFundMovementSource.QuinielaFund` (D1, D2, D4, D5).
- [x] Verificar con datos reales cómo se marca un partido aplazado/suspendido en `RffmMatch` (D2).
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 2. Backend: features (~3h)

- [x] Red: handler y validator de cada feature (abrir, guardar boleto, pagos, marcar pago, liquidar, current) incl. roles y errores ProblemDetails.
- [x] Green: features `Features/Coaches/Quiniela/*.cs` (D6, D7).
- [x] Red/Green: tests de integración de los endpoints (401/403/409).
- [x] Configuraciones EF; migración en commit aparte (`manage-migrations.ps1`).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet build` + `dotnet test`.

## 3. Frontend: servicio y página de participante (~3h)

- [x] Red: `quinielaService.test.ts` y tests de `Quiniela` (tarjetas, selección 1/X/2, Pleno, partido aplazado, no abierta, cerrada, abrir reglas).
- [x] Red: tests de `teamSections` (entradas «Quiniela» y «Bolsa de la quiniela» por rol/permiso) y de `QuickActions` (acción rápida «Quiniela») (D9).
- [x] Green: tipos, servicio, componentes, `Quiniela.tsx` + CSS Modules, ruta lazy (D8).
- [x] Green: `COACH_FEATURE_ROUTES.Quiniela`, `teamNavRoutes`, `teamSections` («Quiniela» y «Bolsa de la quiniela»), `QUICK_ACTION_KEYS` y rutas con `RequireFeaturePermission` (D9).
- **Verify**: `npm run build` + `npx vitest run --maxWorkers=2`.

## 4. Frontend: bolsa y pagos del entrenador (~2h)

- [x] Red: tests de `QuinielaPool` (totales, filtros, marcar pagado, `ConfirmDialog` al liquidar, no accesible para no entrenador).
- [x] Green: `QuinielaPool.tsx` y componentes.
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + tests.

## 4b. Frontend: tarjeta «Quiniela» en la home del equipo (~2h)

- [x] Red: tests de `QuinielaPromoCard` (estados sin rellenar / pendiente / pagado / cerrado, etiqueta «Novedad» y su desaparición por primera apertura y por 14 días, sin almacenamiento, oculta sin quiniela abierta para jugador, acceso «Abrir quiniela» para el entrenador) y de `TeamDashboard` (tarjeta primera en la columna principal para jugador y entrenador) (D10).
- [x] Green: `QuinielaPromoCard.tsx` + CSS Module, helper de «Novedad» con `localStorage` (try/catch) y su integración en `TeamDashboard.tsx` (D10).
- **Verify**: tests del área (`npx vitest run src/apps/coach/pages/team-dashboard`); la suite completa solo al final (ver `frontend-testing.md` §4.6).

## 5. Cierre

- [x] `openspec validate quiniela-team-pool --strict`.
- [x] Comprobación visual a ~360 px y escritorio.
- [x] Commits tras confirmación del usuario.
