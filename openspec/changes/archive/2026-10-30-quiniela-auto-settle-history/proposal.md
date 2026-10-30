## Why

Hoy la quiniela depende del entrenador en los dos extremos de cada jornada: él liquida cuando acaba
el último partido y él abre la siguiente. Hasta entonces la home sigue mostrando una quiniela
"en juego" sin resultado, y el usuario no puede ver jornadas pasadas ni preparar su boleto de la
siguiente. Se quiere que la app cierre el ciclo sola: bloquear los boletos al cerrarse el plazo,
mostrar el resultado y el reparto de premios cuando acabe la jornada y dejar al usuario a un paso de
su boleto de la nueva jornada.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Liquidación automática: un worker revisa las jornadas abiertas y liquida las que tienen todos sus
    partidos válidos finalizados, con la misma lógica que el botón manual (que se mantiene como respaldo).
  - Apertura automática de la siguiente jornada al liquidar, con el bote arrastrado; si no hay
    próxima jornada con partidos pendientes no hace nada. El botón manual del entrenador se mantiene.
  - Token de concurrencia (`xmin`) en `QuinielaJornada` para que worker y entrenador no liquiden dos
    veces (un único movimiento de fondo). Migración en commit aparte.
  - Nuevo endpoint paginado de histórico de jornadas liquidadas con ganadores, bolsa, bote y el
    resultado del propio usuario.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - Home: la tarjeta de la quiniela refleja claramente el cierre del plazo (hora de cierre pasada,
    boleto solo lectura) y, tras liquidarse, muestra el resultado y el reparto de premios de la
    última jornada junto a la quiniela nueva.
  - Nueva pantalla «Histórico de quinielas»: jornada actual arriba con acceso a crear/editar su
    boleto, y debajo las jornadas liquidadas con premiados. Responsive, tarjetas, sin tablas.
  - La página de la quiniela enlaza al histórico y mantiene los boletos en solo lectura al cerrarse
    el plazo. **Versión**: web minor.

## Capabilities

### New Capabilities
- `quiniela-history`: histórico de jornadas liquidadas con premiados y acceso a la jornada actual.

### Modified Capabilities
- `quiniela-team-pool`: liquidación y apertura automáticas; la home muestra cierre y resultado.

## Impact

- `Back/ExtractionApi`: nuevo `Features/Coaches/Quiniela/GetQuinielaHistory.cs`, lógica de
  liquidación y apertura extraída de `SettleQuiniela.cs`/`OpenQuiniela.cs` a un servicio compartido,
  nuevo `QuinielaAutoCloseWorker` (patrón de `MatchResultNotificationWorker`) registrado en
  `ServiceCollectionExtensions`, `QuinielaJornada` + `QuinielaEntityConfiguration` (xmin), migración.
- `Front/`: `quinielaService.ts`, `QuinielaPromoCard.tsx`, `QuinielaWinnersCard.tsx`, nueva
  `QuinielaHistory.tsx`, ruta y enlaces desde `Quiniela.tsx`.
- **Fuera de alcance**: `Mobile/`, notificaciones push del resultado, abono automático de premios
  al monedero, cambio del cálculo de premios.
