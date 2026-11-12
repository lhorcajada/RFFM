## Planning Status

Planificado a partir de `proposal.md`, `specs/deconvoke-proposal-rules-config/spec.md` y `design.md`. Nada implementado ni verificado todavía. TDD estricto (Red → Green → Refactor); durante el desarrollo se ejecutan solo los tests del área afectada, y la suite completa + builds una vez al final.

## Step 1: Catálogo y configuración por defecto (Front)

Cubre: Rule catalog, Default rule configuration.
- [x] 1.1 Test de caracterización: cada regla actual con sus constantes produce las puntuaciones de hoy (fija el comportamiento antes de refactorizar).
- [x] 1.2 Crear `rules/ruleCatalog.ts` (condiciones, claves de puntos/pesos, valores por defecto, rangos) y `rules/defaultRules.ts` con la configuración por defecto; tipos `DeconvocationRuleConfig`.
- [x] 1.3 Tests del catálogo: 12 condiciones únicas, defaults equivalentes a las constantes actuales.

## Step 2: Motor de reglas parametrizable (Front)

Cubre: Rule points and weights shown separately, Mandatory rules are editable, Proposal uses the current configuration.
- [x] 2.1 Tests Red por regla: puntos, pesos y texto editados cambian delta/factor; regla ausente ⇒ sin factor y 0 puntos; regla forzada presente sigue forzando.
- [x] 2.2 Refactor de `goals`, `streak`, `minimum`, `rivalResult`, `injured`, `weeklyTraining`, `recentRecovery`, `recentDeconvocation`, `technicalTotal` y `combined` (separado en `rating`, `necessity`, `weeklyTrainingAccum`) para recibir `cfg`.
- [x] 2.3 `runRules(ctx, rules)` itera la lista configurada; `BuildProposalInput.rules?` (defecto si falta); pesos por excusa de `attendanceWeights` desde la config.
- [x] 2.4 Confirmar que los tests de caracterización del paso 1 siguen en verde con la configuración por defecto.

## Step 3: Backend — persistencia por equipo

Cubre: Per-team persistence and authorization, Restore default.
- [x] 3.1 Tests xUnit Red: validador (condición desconocida/repetida, texto vacío, rangos, >20 reglas); GET sin fila ⇒ `isDefault`; PUT crea/actualiza; DELETE idempotente; 403 no coach; aislamiento entre equipos (BD real).
- [x] 3.2 Entidad `DeconvocationRulesSettings` + configuración EF + `DbSet` en `AppDbContext`.
- [x] 3.3 Features `GetDeconvocationRules`, `UpdateDeconvocationRules`, `ResetDeconvocationRules` (vertical slice, `ProblemDetails`, `RequireAuthorization`).
- [x] 3.4 Migración EF (commit separado). Subir `<Version>` minor en `Directory.Build.props`.

## Step 4: Servicio, hook y botón Actualizar (Front)

Cubre: Proposal uses the current configuration.
- [x] 4.1 Tests Red: `deconvocationRulesService` (get/save/reset), `useDeconvocationRules` (defecto mientras carga o si `isDefault`, `reload`), botón «Actualizar» regenera la propuesta con la config vigente.
- [x] 4.2 Crear `deconvocationRulesService.ts` y `useDeconvocationRules`; pasar `rules` a `useConvocationProposal` (dependencia del `useMemo`).
- [x] 4.3 Añadir botón «Actualizar» en la pantalla de la propuesta (`ConvocationTab`/`ConvocationMatchDetail`).

## Step 5: Diálogo de configuración de reglas (Front)

Cubre: Rule catalog (alta), Rule points and weights shown separately, Mandatory rules are editable, Restore default, Responsive configuration screen.
- [x] 5.1 Tests Red: editar texto/puntos/pesos; «Añadir regla» ofrece solo condiciones libres y se oculta si están todas; eliminar y restablecer pasan por `ConfirmDialog`; aviso al eliminar regla obligatoria; guardar llama al servicio.
- [x] 5.2 Implementar `DeconvocationRulesDialog` (+ `.module.css`): una tarjeta por regla, secciones «Puntos» y «Pesos» separadas, sin tablas, usable a 360 px; avisos con `rffm.show_snackbar`.
- [x] 5.3 Enlazar el diálogo desde la pantalla de la propuesta (solo rol coach).

## Step 6: Verificación final y versionado

- [x] 6.1 Subir versión minor en `Front/package.json`.
- [ ] 6.2 Ejecutar una vez la suite completa de Front y Back, `npm run build` y `dotnet build`. (Hecho: `npm run build`, `dotnet build` y los tests del área; pendiente la suite completa.)
- [ ] 6.3 Comprobación visual de la pantalla en móvil (~360 px) y escritorio (si no se puede hacer, dejar sin marcar y avisar).
- [x] 6.4 `openspec validate configurable-deconvocation-rules --strict`.
