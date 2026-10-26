## Context

`AttendanceSummaryContent` monta `Tabs` (fullWidth) y tres paneles: `AttendanceDashboardTab` (+
`AttendanceEventChart`, SVG con paginador y tabla alternativa), `AttendanceTrainingsTab` y
`AttendanceMatchesTab` (acordeones MUI). Estilos en `AttendanceSummary.module.css`.

## Goals / Non-Goals

**Goals:** aspecto común, móvil primero, sin tablas ni scroll horizontal, misma funcionalidad.
**Non-Goals:** backend, cálculo de datos, exportaciones Excel/PDF, `Mobile/`.

## Decisions

### D1 · Etapas independientes
Panel, Entrenamientos y Partidos. Cada una deja tests y build en verde y sube la versión minor.

### D2 · Panel
Tarjeta global con anillo SVG accesible (`role="img"` y `aria-label` con el porcentaje). Cada categoría
conserva su color (`--chart-training/match/other`). `AttendanceEventChart` mantiene datos y paginación;
cambia a barras de los últimos eventos con `title` por barra. **Desviación del diseño:** se conserva la
paginación y el tooltip existentes; la tabla alternativa (`<table>`) se sustituye por una lista de
filas-tarjeta, por la regla de no usar tablas.

### D3 · Entrenamientos
Estado de búsqueda y orden en el cliente (sin tocar el servicio). Tarjeta con `Accordion` MUI existente
(mantiene teclado/ARIA). Colores de la barra por umbral: ≥85 verde, ≥70 naranja, <70 rojo (con el
porcentaje en texto, no solo color). Exportar Excel sigue usando `actionsSlot`/portal.

### D4 · Partidos
Se conservan `matchAttendanceState`, la leyenda y el detalle por jornada; cambia la maquetación (minutos
en grande, contadores, tira de forma ya existente de 5 partidos). Los botones de PDF y refresco pasan a
una barra apilable en móvil.

### D5 · Estilos
CSS Module existente; colores nuevos solo como variables en `:root` junto a las `--chart-*`.
