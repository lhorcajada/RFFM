## Why

Los equipos montan a mano una quiniela con los partidos de liga de cada jornada (papel, grupos de
mensajería, Bizum). Cuesta llevar quién ha rellenado, quién ha pagado y cuánto hay en la bolsa. Se
quiere una página dentro de la app que gestione la quiniela entre los usuarios del equipo
(jugadores, familiares y entrenador) con las mismas reglas que La Quiniela oficial, y que dé al
entrenador el control de la bolsa y de los pagos.

El diseño aprobado está en `.design/quiniela/` (participante escritorio y móvil, popup de reglas,
bolsa y pagos del entrenador).

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nuevas entidades de quiniela por equipo y jornada RFFM: jornada, boleto y pronósticos.
  - El entrenador abre la quiniela de una jornada; los participantes guardan su boleto (1/X/2 por
    partido válido y Pleno con los goles 0/1/2/M del último partido).
  - El entrenador marca boletos como pagados/pendientes y liquida la jornada: categorías de premio,
    bote y aportación al fondo del equipo (`TeamFundMovement`).
  - Precio de 1 € por boleto; plazo de pago hasta el viernes 23:59; los partidos aplazados o
    suspendidos no cuentan.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - Página de participante «Quiniela» con tarjetas por partido, popup de reglas, estado del boleto y
    bolsa.
  - Página de entrenador «Bolsa y pagos» con totales, filtro de boletos, marcar pagado y liquidar.
  - Ambas responsive, sin tablas.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `quiniela-team-pool`: quiniela del equipo sobre los partidos de liga, con bolsa y pagos.

## Impact

- `Back/ExtractionApi`: nuevo `Features/Coaches/Quiniela/*`, entidades en `Domain/Entities/Teams/`,
  configuraciones EF, migración (commit aparte), nuevo valor de `TeamFundMovementSource`.
- `Front/`: nuevo `pages/quiniela/*`, `quinielaService.ts`, ruta y entrada de menú.
- **Fuera de alcance**: app `Mobile/`, pasarela de pago online (el cobro es en mano/Bizum y lo
  registra el entrenador), pantalla de ajustes de la bolsa (porcentajes fijos por defecto en v1),
  recordatorios push a pendientes, histórico de jornadas.
