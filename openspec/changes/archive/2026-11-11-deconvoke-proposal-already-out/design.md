## Context

Hechos verificados en el código:

- `ConvocationMatchDetail.tsx` pasa `squadIds = convocation.players.map(p => p.id)` como `calledIds` a `buildDeconvokeProposal`: el pool ya es la plantilla completa.
- `buildMatchUnavailability` (`matchUnavailability.ts`) solo incluye a los de `mgmtNotCalled` con un motivo que no sea «decisión técnica». Los de decisión técnica o sin motivo no entran en ningún sitio y siguen como candidatos disponibles.
- `buildDeconvokeProposal` calcula `targetCount = max(forzados, plantilla − 18)`; solo los forzados (incluidos los no disponibles con motivo) cuentan como ya fuera.
- `selectDeconvocations` evalúa `evaluateRequirements` sobre el pool menos los ya seleccionados; no sabe nada de los ya desconvocados salvo que sean forzados.
- `handleApplyProposal` ya omite a los de `mgmtNotCalled`, por lo que una propuesta que los repite queda corta al aplicarla.
- `protectionReason` muestra el mínimo (`mínimo de 3 medios centro`) y `positionProtection.value` es `requiredCount`, no los que quedan.

Decisiones tomadas con el usuario: la decisión técnica ya cuenta como desconvocado; los pendientes de respuesta no se usan (el universo es la plantilla y quien no puede ir figura como desconvocado).

## Goals / Non-Goals

Goals:
- Los mínimos por posición, el objetivo y la selección se calculan sobre los disponibles (plantilla − ya fuera por cualquier motivo).
- Los ya fuera no se proponen de nuevo.
- «Protegido» muestra el recuento real de disponibles de esa posición.

Non-goals:
- Cambiar los pesos, reglas de puntuación o el límite de 18 convocados.
- Cambios de backend o de API.
- Tratar a los pendientes de respuesta como no disponibles.
- Cambiar la lógica de cobertura por demarcaciones posibles.

## Decisions

### D1. Entrada nueva `alreadyOutIds`, separada de `matchUnavailable`

`BuildProposalInput` recibe `alreadyOutIds: Set<string>` (todos los de `mgmtNotCalled`). `matchUnavailable` se mantiene tal cual (mapa con motivo que fuerza con -120). Alternativa descartada: ampliar `matchUnavailable` con los de decisión técnica; mezclaría «quién está fuera» con «por qué», y forzaría un -120 y un motivo que no existen. Consecuencia: el hook y `ConvocationMatchDetail` pasan un conjunto nuevo derivado de `convocation.mgmtNotCalled`.

### D2. Los ya fuera se excluyen de los candidatos y de los recuentos

En `buildDeconvokeProposal` se filtra `calledIds` por `alreadyOutIds` antes de construir `positionPlayers` y `proposals`. Todo lo que depende de ese conjunto (mínimos, coberturas, `calledCount`, `targetCount`, `maxTechnicalTotal`) pasa a ser sobre los disponibles. `targetCount = max(forzados disponibles, disponibles − maxCalledPlayers, 0)`. Alternativa descartada: pasar el conjunto a `selectDeconvocations` y mantener a los ya fuera en `proposals`; obligaría a filtrarlos en cada bucle y dejaría `calledCount` incoherente.

Efecto en la UI: los ya fuera dejan de aparecer en la lista de la propuesta (ni como seleccionados ni como atenuados). Ya figuran como desconvocados en el resto de la pestaña, y `handleApplyProposal` ya los omitía.

### D3. Texto «Protegido» con recuento real

`selectDeconvocations` devuelve, junto a la exigencia que protege, cuántos disponibles de esa posición hay en el momento de evaluar al candidato. `protectionReason(requirement, remaining)` produce «Protegido: quedan N de M <posición> disponibles» (`wideCover`/`forwardCover` mantienen «cobertura de banda/delantero»). El factor `positionProtection` usa `value = remaining`. `formatProposalFactorValue` no cambia (ya formatea `positionProtection` como entero).

`remaining` sale de `evaluateRequirements`: se añade a `PositionShortfall`-like un mapa de recuentos por exigencia (`counts`), de modo que no se recalcula en el consumidor.

## Target State

La propuesta opera sobre `plantilla − ya fuera`. Con 6 medios centro y 3 ya desconvocados, los 3 restantes quedan protegidos con «quedan 3 de 3 medios centro disponibles» y el objetivo se calcula sin contar a los 3 ya fuera.

## Risks / Trade-offs

- Cambio de contrato de `BuildProposalInput` (campo nuevo): los tests y llamadas existentes deben actualizarse. Mitigación: el campo es opcional con valor por defecto vacío, de modo que el comportamiento anterior se conserva sin él.
- Los forzados ya desconvocados dejan de aparecer como «OBLIGATORIO» en la propuesta. Mitigación: ya están desconvocados; se comprueba que `ConvocatoriaPrint.tsx` (usa `proposal.players`) no depende de ellos.
- Un `remaining` mal calculado daría un texto engañoso. Mitigación: tests sobre el recuento con cobertura y con ya fuera.

## Migration Plan

Not applicable: cambio solo de frontend, sin datos persistidos ni API.

## Validation Strategy

- Unit (`deconvokeProposal`): plantilla de 25 con 3 ya fuera por decisión técnica → objetivo 4 y ninguno propuesto; ya fuera sin motivo; 6 medios centro con 3 ya fuera → los 3 restantes protegidos y no propuestos; pendientes siguen disponibles; los forzados disponibles siguen primero.
- Unit (`positionRequirements`): `protectionReason` con recuento; recuento para cobertura de banda/delantero.
- Unit (hook / `ConvocationMatchDetail`): el conjunto de ya fuera se deriva de `mgmtNotCalled`.
- Se ejecutan solo los tests del área; la suite completa y `npm run build` una vez al final.

## ADR / DDR Evaluation

Ninguno: es un ajuste de una regla de negocio existente dentro de una función de utilidad, sin decisión arquitectónica ni de dominio nueva.

## Open Questions

None
