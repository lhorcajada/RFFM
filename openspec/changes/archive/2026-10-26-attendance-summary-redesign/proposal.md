## Why

El resumen de asistencia del entrenador (`/coach/attendance/summary`) tiene tres pestañas (Panel,
Entrenamientos, Partidos) con tarjetas de aspecto muy distinto, gráficos con tabla alternativa y chips
apiñados en móvil. El entrenador quiere un aspecto común, pensado primero para móvil y sin tablas.

Diseño de referencia: https://claude.ai/artifact/7TsbCaBkV3PFzVfSQ5uVRy (tres tableros: Panel,
Entrenamientos, Partidos). Fuentes locales en `.design/attendance-summary/` (no se commitean).

## What Changes

- **Frontend (Coach, `Front/`)**, por etapas independientes:
  1. **Panel**: anillo con la tasa global y tres cifras; tarjeta por categoría (entrenamientos, partidos,
     otros) con tasa, barras de los últimos 8 eventos y chips de totales.
  2. **Entrenamientos**: buscador por jugador, orden (menor asistencia / nombre), tarjeta con porcentaje
     grande, barra de progreso y faltas desplegables con fecha, motivo y evento.
  3. **Partidos**: leyenda en una barra, tarjeta con minutos de temporada, contadores, últimos 5 partidos
     y detalle por jornada desplegable.
- Pestaña activa en naranja sólido, cabecera común, sin scroll horizontal.
- **Versión**: web minor por etapa entregada.

## Capabilities

### New Capabilities
- `attendance-summary-dashboard`, `attendance-summary-trainings`, `attendance-summary-matches`.

## Impact

- `Front/src/apps/coach/pages/attendance/components/summary/*` y `AttendanceSummary.module.css`.
- Sin cambios de backend ni de contratos de API. Exportaciones Excel/PDF y lógica de datos intactas.
