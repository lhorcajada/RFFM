## Context

Hechos verificados:
- `buildDeconvokeProposal` (`deconvokeProposal.ts`) llama a `runRules(ctx)` (`rules/index.ts`), que ejecuta 10 reglas en un array fijo `RULES`. Cada regla es una función pura `(ctx, prev) => { factors, delta, forced? }` con constantes internas (p. ej. `POINTS_PER_GOAL = 2`, `STREAK_POINTS`, `RECENT_DECONVOCATION_POINTS`, `MULTIPLIER = 40`, `-120` en lesionado).
- `combinedRule` emite 3 factores (`rating`, `necessity`, `weeklyTrainingAccum`).
- `attendanceWeights.ts` define la penalización por tipo de excusa (`ABSENCE_PENALTY_BY_EXCUSE`) y se usa al construir `WeeklyTrainingStats` (fuera del motor de reglas).
- Hay un patrón de ajustes por equipo en backend: `QuinielaTeamSettings` (entidad única por `TeamId`) + `Get/UpdateQuinielaSettings` (vertical slice, `QuinielaSupport.RequireRoleAsync`).
- La propuesta se recalcula en vivo con `useMemo` en `useConvocationProposal`; no se persiste.

Supuestos: el rol coach del equipo se comprueba como en Quiniela (`CoachOnly`); lectura permitida a cualquier rol de coach del equipo.

## Goals / Non-Goals

Goals:
- Reglas configurables por equipo (texto, puntos, pesos, alta/baja desde catálogo) con defecto restablecible.
- Defecto = valores actuales: resultado idéntico sin configurar.
- Botón «Actualizar» que regenera la propuesta con la configuración vigente.

Non-goals:
- App móvil.
- Recalcular o guardar propuestas de partidos pasados.
- Reglas con fórmulas libres / condiciones definidas por el usuario.
- Configurar la protección por posiciones, el bloqueo de portero o `matchUnavailable`.

## Decisions

### D1. Modelo de regla: `{ condition, text, points, weights }`
Una regla = condición del catálogo + texto (label del factor) + `points: number | number[]` + `weights: Record<string, number>`. Los «puntos» son la magnitud base; los «pesos» son factores con nombre propios de cada condición, declarados en el catálogo con su valor por defecto. Reparto por condición:

| Condición | Puntos | Pesos |
|---|---|---|
| goals | puntos por gol (2) | — |
| streak | tabla por racha `[50,45,20,15,10,5,3]` | offset/pendiente/tope de la rama racha 0 (8.5, 0.6, 22, 40/15, 6) |
| minimum | puntos por convocatoria faltante (4.5) | tope (24) |
| rivalResult | base por resultado: derrota/empate/victoria (22/14/8) | umbral abultado (7) |
| injured | puntos (-120) | — |
| weeklyTraining | máx. asistencia (12), puntos forzado (-100) | penalización por excusa (`attendanceWeights`), umbral asistencia fiable (0.8) |
| recentRecovery | protección retorno (30), puntos forzado (-100) | — |
| recentDeconvocation | tabla `[15,10,5]` | — |
| technicalTotal | multiplicador (40) | — |
| rating | máx. (100) | pesos Comp/Fis/Tac/Tec (0.45/0.25/0.2/0.1) y peso del bloque (0.45) |
| necessity | máx. (100) | peso del bloque (0.45) |
| weeklyTrainingAccum | máx. temporada (25) | — |

Alternativa descartada: un único multiplicador «peso» sobre el delta final de cada regla — no permite ajustar partes (p. ej. penalización por excusa) y confunde puntos con pesos. El catálogo (`ruleCatalog.ts`) es la fuente de verdad de claves, valores por defecto y rangos.

### D2. Motor parametrizable: las reglas reciben su configuración
`Rule` pasa a `(ctx, cfg, prev)`; `runRules(ctx, rules)` itera sobre la lista configurada (no sobre `RULES` fijo), resolviendo la función por `condition` y pasando `cfg`. Orden = orden de la lista (las reglas dependen de `prev` solo cuando ya existen). La configuración por defecto (`defaultRules.ts`) reproduce las constantes actuales; tests de caracterización fijan que defecto ⇒ mismas puntuaciones. `weeklyTraining` y `attendanceWeights.absencePenalty` reciben los pesos por excusa desde la config (`WeeklyTrainingStats` se construye con ellos); si la regla no existe se usan los valores por defecto para el cálculo de estadísticas.

`BuildProposalInput` gana `rules?: DeconvocationRuleConfig[]` (opcional ⇒ defecto) para no romper llamadas ni tests existentes.

### D3. Persistencia en backend, por equipo, como JSON
Nueva entidad `DeconvocationRulesSettings : BaseEntity` en `AppDbContext` (schema `app`), única por `TeamId`, con `RulesJson` (columna `jsonb`) y `UpdatedOn`. Sin fila ⇒ defecto (el defecto vive en el front; el backend no lo conoce). Alternativa descartada: tabla normalizada de reglas — sobrecoste de migración/joins para un documento que se lee y escribe entero.
Endpoints (vertical slice, 1 feature = 1 `.cs`):
- `GET /api/teams/{teamId}/deconvocation-rules` → `{ rules, isDefault }`; sin fila devuelve `{ rules: null, isDefault: true }` y el front aplica el defecto.
- `PUT /api/teams/{teamId}/deconvocation-rules` (solo coach) con validador FluentValidation: condición conocida, sin repetidas, texto no vacío y ≤ 200, puntos/pesos finitos en `[-1000, 1000]`, máx. 20 reglas.
- `DELETE /api/teams/{teamId}/deconvocation-rules` (solo coach) = restablecer; idempotente.
Errores `ProblemDetails`; 403 para no coach (misma ayuda que Quiniela). El backend valida la forma, no recalcula nada.

### D4. Front: servicio, hook y botón Actualizar
`deconvocationRulesService.ts` (get/save/reset) y hook `useDeconvocationRules(teamId)` que devuelve `{ rules, reload }` (defecto mientras carga o si `isDefault`). `useConvocationProposal` recibe `rules` en su input y lo incluye en las dependencias del `useMemo`. El botón «Actualizar» de la pantalla de propuesta llama a `reload()` (y vuelve a calcular); sin él, los cambios guardados desde el diálogo se aplicarían solo al recargar.

### D5. UI de configuración: diálogo con tarjetas
`DeconvocationRulesDialog` (CSS Module, MUI, sin tablas): una `Card` por regla con campos texto, puntos y pesos en secciones separadas; botón eliminar (con `ConfirmDialog`), «Añadir regla» (select de condiciones no usadas), «Restablecer valores por defecto» (con `ConfirmDialog`), «Guardar». Avisos vía `rffm.show_snackbar`. Para tablas de puntos (racha, desconvocatoria reciente) se muestran como lista de campos numéricos apilados.

## Target State

El entrenador abre «Reglas» desde la propuesta, edita/añade/elimina reglas, guarda y pulsa «Actualizar»; la propuesta se regenera con las reglas del equipo. Sin configuración guardada nada cambia respecto a hoy.

## Risks / Trade-offs

- **Regresión de puntuaciones por refactor del motor**: mitigado con tests de caracterización (defecto ⇒ mismas puntuaciones que las reglas actuales) escritos antes de refactorizar.
- **Configuración incoherente** (p. ej. quitar `injured` y dejar lesionados convocables): es una decisión explícita del entrenador (spec «Mandatory rules are editable»); la UI avisa al eliminar una regla obligatoria.
- **Defecto duplicado front/back**: el backend no conoce el defecto, solo valida forma; el catálogo de condiciones válidas sí se duplica (lista de claves) — se cubre con test de contrato en ambos lados.
- **Muchos parámetros por regla**: se acotan rangos y se agrupan en «Puntos» y «Pesos» para no abrumar.

## Migration Plan

Migración EF aditiva (tabla nueva `app.DeconvocationRulesSettings`), en commit separado del código. Sin backfill: sin fila ⇒ defecto. Rollback: eliminar la tabla/revertir migración; el front vuelve al defecto si el endpoint no responde con configuración.

## Validation Strategy

- Front (Vitest): tests de caracterización de cada regla con config por defecto; reglas con puntos/pesos/textos editados; regla ausente ⇒ sin factor y 0 puntos; `runRules` respeta el orden y `prev`; `ruleCatalog` (condiciones, defaults); servicio y hook; diálogo (editar, añadir solo condiciones libres, eliminar y restablecer con `ConfirmDialog`, tarjetas); botón Actualizar regenera la propuesta.
- Back (xUnit): validador (condición desconocida/repetida, texto vacío, rangos, >20 reglas); handlers GET/PUT/DELETE con BD real (ajustes aislados por equipo, 403 no coach, DELETE idempotente).
- Suite completa y `npm run build` / `dotnet build` una sola vez al final.

## ADR / DDR Evaluation

Ninguno: no hay decisión arquitectónica transversal nueva (reutiliza el patrón de ajustes por equipo y el motor de reglas existente). No hay guía de ADR/DDR del proyecto aplicable que obligue a registrarlo.

## Open Questions

None
