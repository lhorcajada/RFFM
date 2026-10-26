# Implement: coach-injured-redesign

Solo `Front/`. Convenciones: CSS Modules co-ubicado, tema MUI/CSS vars existentes (sin colores
nuevos), sin `style={{}}`, sin `any`, sin tablas, textos en español, TDD (Red antes de Green).
Rutas relativas a `Front/src/apps/coach/pages/injured/`.

## 1. `injuryRecovery.ts` (Red -> Green)
1. Crear `__tests__/injuryRecovery.test.ts` con los casos de design.md D3.
2. Crear `injuryRecovery.ts` con `parseRecoveryDays` y `recoveryProgress` (puras, sin `any`).

## 2. `components/InjuredPlayersList.tsx` + `.module.css` (Red -> Green)
1. Actualizar `components/__tests__/InjuredPlayersList.test.tsx` (Red): «Actualizar», contadores,
   filtros, estados vacíos, barra solo con estimación interpretable, permisos, alta con
   confirmación, resaltado.
2. Implementar según design.md D1, D2, D4, D5. No tocar la carga de datos, `InjuryDialog`, el
   diálogo «Registrar lesión», el `ConfirmDialog` ni el efecto de `highlightedId`.

## 3. Versión y verificación
1. `cd Front && npm version 1.70.0 --no-git-tag-version`.
2. `npx vitest run src/apps/coach/pages/injured` y `npm run build`.
3. Marcar en `tasks.md` solo lo realmente hecho. No hacer commit ni push.
