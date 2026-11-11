## Planning Status

Plan basado en `proposal.md`, `specs/deconvoke-proposal-positions/spec.md` y `design.md`. Ninguna tarea está implementada ni verificada todavía. TDD: cada paso empieza con el test en rojo.

## Step 1: Recuento real y texto de protección

Cubre «Proposal shows roles and position warnings» (escenarios de tarjeta protegida).

- [x] 1.1 Test en `positionRequirements`: `protectionReason` devuelve «Protegido: quedan N de M medios centro disponibles» y mantiene «cobertura de banda/delantero».
- [x] 1.2 Exponer en `evaluateRequirements` el recuento disponible por exigencia y adaptar `protectionReason(requirement, remaining)`.

## Step 2: Ya fuera en la selección y el objetivo

Cubre «Already deconvoked players are out of the proposal» y «Minimum squad structure».

- [x] 2.1 Tests en `deconvokeProposal`: 25 en plantilla con 3 ya fuera por decisión técnica → objetivo 4 y ninguno propuesto; ya fuera sin motivo; 6 medios centro con 3 ya fuera → los 3 restantes protegidos y no propuestos; pendientes de respuesta siguen disponibles; 4 centrales con 2 ya fuera → «Centrales: quedan 2 de 3».
- [x] 2.2 Añadir `alreadyOutIds` (opcional, vacío por defecto) a `BuildProposalInput` y filtrar a los ya fuera antes de `positionPlayers`, `proposals`, `calledCount` y `maxTechnicalTotal`.
- [x] 2.3 Calcular `targetCount = max(forzados disponibles, disponibles − maxCalledPlayers, 0)`.
- [x] 2.4 Pasar el recuento de `selectDeconvocations` al factor `positionProtection` (`value = remaining`).

## Step 3: Conectar la plantilla desde la pantalla

Cubre «Already deconvoked players are out of the proposal».

- [x] 3.1 Test del hook `useConvocationProposal`: el conjunto de ya fuera llega a `buildDeconvokeProposal`.
- [x] 3.2 Añadir `alreadyOutIds` a `useConvocationProposal` y pasarlo desde `ConvocationMatchDetail.tsx` a partir de `convocation.mgmtNotCalled`.
- [x] 3.3 Comprobar que `ConvocationTab.tsx` y `ConvocatoriaPrint.tsx` no dependen de que los ya fuera aparezcan en `proposal.players`.

## Step 4: Mediocampista ofensivo cuenta como medio centro

Cubre «Position roles» y «Minimum squad structure».

- [x] 4.1 Tests: la demarcación 8 y «Mediocampista ofensivo»/«Mediapunta» son medio centro; el mediocampista derecho es banda; la plantilla completa no exige mediapunta.
- [x] 4.2 Eliminar el rol `attackingMid` (tipo, mínimo, etiquetas y orden) y mapear la demarcación 8 y los nombres ofensivo/mediapunta/enganche a `centralMid`.

## Step 5: Verificación final

- [x] 5.1 Ejecutar los tests del área (`utils` y `hooks` de convocatorias).
- [ ] 5.2 Una sola vez al final: suite completa (`npx vitest run --maxWorkers=4`) y `npm run build`.
- [x] 5.3 Subir la versión patch de `Front/package.json` (el cambio se commitea como `fix(front)`).
- [ ] 5.4 Revisar el texto en la pantalla del partido con un viewport estrecho (~360px).
