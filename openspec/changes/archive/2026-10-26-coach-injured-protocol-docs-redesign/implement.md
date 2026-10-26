# Implement: coach-injured-protocol-docs-redesign

Solo `Front/`. Convenciones: CSS Modules co-ubicado, tema MUI/CSS vars existentes (sin colores
nuevos), sin `style={{}}`, sin `any`, sin tablas, textos en español, TDD (Red antes de Green).
Rutas relativas a `Front/src/apps/coach/pages/injured/`.

## 1. Tests (Red)
1. Ampliar `__tests__/Injured.tabs.test.tsx`, `components/__tests__/InjuryProtocolPanel.test.tsx` y
   `components/__tests__/InjuryProtocolDocuments.test.tsx` según design.md. Confirmar que fallan.

## 2. Implementación (Green)
1. `Injured.tsx`: sustituir `Tabs` por `div role="tablist"` con 3 `button role="tab"` (D2).
2. `InjuryProtocolPanel.tsx`: título, chip, acciones «Guardar protocolo»/«Eliminar» (D3). No tocar
   carga/guardado/borrado ni textos de `notify`.
3. `InjuryProtocolDocuments.tsx`: zona de subida, tarjetas con botones de texto (D4). No tocar
   validaciones.
4. Estilos en los `.module.css` correspondientes.

## 3. Versión y verificación
1. `cd Front && npm version 1.71.0 --no-git-tag-version`.
2. `npx vitest run src/apps/coach/pages/injured` y `npm run build`.
3. Marcar en `tasks.md` solo lo realmente hecho. No hacer commit ni push.
