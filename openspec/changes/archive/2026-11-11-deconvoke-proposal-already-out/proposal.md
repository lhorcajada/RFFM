## Why

La propuesta de desconvocados solo descuenta como "ya fuera" a los desconvocados con un motivo distinto de «decisión técnica» (lesión, sanción, no disponible). Los desconvocados por decisión técnica o sin motivo siguen contando como disponibles: los mínimos por posición se evalúan sobre una plantilla que no existe, el objetivo de desconvocatorias se calcula de más y esos jugadores pueden volver a proponerse. Además, la etiqueta «Protegido: mínimo de 3 medios centro» no indica cuántos quedan, y parece incoherente cuando hay más jugadores de la posición en la plantilla.

## What Changes

- Todo jugador de la plantilla que ya está desconvocado (`mgmtNotCalled`), sea cual sea el motivo (incluida la decisión técnica o la ausencia de motivo), se trata como «ya fuera».
- El conjunto de candidatos sigue siendo la plantilla; los «ya fuera» no se vuelven a proponer y no se cuentan como disponibles.
- Los mínimos por posición y las coberturas se evalúan solo sobre los disponibles (plantilla − ya fuera).
- El número objetivo de desconvocatorias es `max(forzados, disponibles − 18)`, sin contar los ya fuera.
- «Ya fuera» (conjunto de ids) se separa de `matchUnavailable` (mapa con motivo que fuerza la desconvocatoria con -120): los de decisión técnica o sin motivo entran en el primero y no en el segundo.
- El factor «Protegido» muestra el recuento real: «Protegido: quedan N de M medios centro disponibles» (`value` = N, los que quedarían disponibles).
- Los estados pendientes de respuesta no se usan: quien aún no ha contestado sigue disponible.
- Los mediocampistas ofensivos pasan a contar como medios centro (MC, MCD y ofensivo; mínimo 3). Desaparece el rol y el mínimo de mediapunta. Los mediocampistas izquierdo/derecho y los extremos siguen siendo banda; los delanteros siguen siendo Delantero centro y Segundo delantero.

## Capabilities

### New Capabilities

### Modified Capabilities
- `deconvoke-proposal-positions`: los mínimos por posición, el objetivo y la selección se calculan sobre los disponibles (plantilla − ya desconvocados por cualquier motivo); el texto de protección incluye el recuento real.

## Impact

- `Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts` (`buildDeconvokeProposal`, `selectDeconvocations`, entrada `BuildProposalInput`).
- `Front/src/apps/coach/pages/convocations/utils/positionRequirements.ts` (`protectionReason`, recuento restante).
- `Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts` (nueva entrada con los ya fuera).
- `Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx` (pasa `mgmtNotCalled`).
- Tests de `deconvokeProposal` y `positionRequirements`. Sin cambios de backend ni de API.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- Front/src/apps/coach/pages/convocations/utils/positionRequirements.ts
- Front/src/apps/coach/pages/convocations/utils/matchUnavailability.ts
- Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts
- Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx
- openspec/specs/deconvoke-proposal-positions/spec.md

**External URLs**:

## Additional Notes

- `squadIds` ya es la plantilla completa (`convocation.players`), por lo que el pool no cambia; cambia qué se considera ya fuera.
- `handleApplyProposal` ya omite a los que están en `mgmtNotCalled`, así que hoy una propuesta que los repite se queda corta al aplicarla.
- Un portero bloqueado (`locked`) sigue sin proponerse salvo lesión, sanción o no disponibilidad.
