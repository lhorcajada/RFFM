## 1. Rotación del campo en móvil (SimulationField + SimulationPlayerSlot)

- [x] 1.1 Escribir tests que fallen primero (Red) sobre `SimulationField.module.css`/
      `SimulationPlayerSlot.module.css`: existencia de reglas `@media (max-width: 780px)` con
      `container-type: size` en `.fieldWrapper` y `rotate(90deg)`/`rotate(-90deg)` en
      `.field`/`.slot` respectivamente (verificación de fuente CSS, ya que jsdom no calcula
      layout real — ver design.md Riesgos). Archivo:
      `Front/src/apps/coach/pages/convocations/components/simulation/__tests__/
      SimulationField.mobileRotation.test.tsx`.
- [x] 1.2 Implementar en `SimulationField.module.css` el bloque `@media (max-width: 780px)` para
      `.fieldWrapper` (`container-type: size`, `width: min(92vw, 420px)`, `max-width: 420px`,
      `aspect-ratio: 68 / 105`, `margin: 0 auto`) y `.field` (`position: absolute`, `top/left:
      50%`, `width: 100cqh`, `height: 100cqw`, `transform: translate(-50%, -50%) rotate(90deg)`,
      `transform-origin: center center`).
- [x] 1.3 Implementar en `SimulationPlayerSlot.module.css` el bloque `@media (max-width: 780px)`
      para `.slot` (`transform: translate(-50%, -50%) rotate(-90deg)`).
- [x] 1.4 Verificar (Green) que los tests de 1.1 pasan. No modificar `SimulationField.tsx` ni
      `SimulationPlayerSlot.tsx` (JSX/props) — cambio puramente CSS.
- [x] 1.5 Verificación manual (no automatizable en jsdom, documentar en el resumen final): abrir
      `SimulacionTab`/`PartidoEnDirectoTab` en un viewport ≤780px (DevTools), confirmar que el
      campo se ve en vertical con porterías arriba/abajo, las tarjetas se leen en pie, y arrastrar
      un jugador del banquillo a un slot vacío del campo funciona con el destino visual esperado.
      Confirmar también que a >780px el campo sigue apaisado, sin cambios.

## 2. Tamaño de tarjeta reducido en móvil (campo + banquillo compacto)

- [x] 2.1 Tests (Red) sobre `SimulationPlayerSlot.module.css`/`CompactBenchCard.module.css`:
      existencia de overrides `@media (max-width: 780px)` para `.playerCard`/`.dropTarget`/
      `.playerCardInner` (tamaño reducido, p. ej. 44px) y `.wrapper` de `CompactBenchCard` (ancho
      acorde). Mismo archivo de test que 1.1 o uno nuevo
      `CompactBenchCard.mobileSize.test.tsx` según convenga.
- [x] 2.2 Implementar los overrides en ambos módulos CSS. Reducir también el `gap` de
      `.compactBenchItems` en `SimulacionTab.module.css` dentro de la media query móvil ya
      existente (`@media (max-width: 780px) { .main { flex-direction: column; } ... }`).
- [x] 2.3 Verde: tests de 2.1 pasan.
- [x] 2.4 Verificación manual: con un banquillo de 9 jugadores simulado en un viewport de 375px
      de ancho, confirmar que todas las tarjetas caben sin scroll interno en `.sidePanel`; si no
      caben, bajar el tamaño (ver Open Questions de design.md) y repetir.

## 3. Marcador compacto en móvil (LiveMatchScoreboard)

- [x] 3.1 Tests (Red) sobre `LiveMatchScoreboard.module.css`: existencia de
      `@media (max-width: 780px)` reduciendo `.root` (padding), `.score`/`.scoreSep`
      (font-size), `.teamName` (font-size/max-width), `.shield` (width/height). Archivo:
      `Front/src/apps/coach/pages/convocations/components/simulation/__tests__/
      LiveMatchScoreboard.mobile.test.tsx`.
- [x] 3.2 Implementar los overrides. No tocar `LiveMatchScoreboard.tsx` (solo CSS) salvo que un
      test de comportamiento (no solo de estilo) lo requiera.
- [x] 3.3 Verde: tests de 3.1 pasan; ejecutar también `LiveMatchScoreboard.test.tsx` existente
      para confirmar que no hay regresión funcional (goles/tarjetas siguen operativos).

## 4. Regresión de tablet/desktop

- [x] 4.1 Revisar (y, si faltan, añadir) tests que confirmen que ninguna de las reglas nuevas de
      `@media (max-width: 780px)` afecta el layout en 781–1200px ni >1200px — reutilizar el
      patrón de los tests ya existentes de `coach-simulation-bench-tablet-layout`
      (`SimulacionTab.benchDraggable.test.tsx`, `PartidoEnDirectoTab.benchInfoPanel.test.tsx`,
      etc.) ejecutándolos sin cambios para confirmar que siguen en verde.
- [x] 4.2 Ejecutar `npm run test` completo en `Front/` y confirmar 0 regresiones.

## 5. Verificación final

- [x] 5.1 `npm run build` en `Front/` sin errores de TypeScript/build.
- [x] 5.2 `npm run test` en `Front/` — 100% verde, sin tests saltados.
- [x] 5.3 `openspec validate coach-simulation-mobile-layout --strict` sin errores.
- [x] 5.4 Resumen final al usuario: decisiones de diseño clave (técnica de rotación CSS,
      preservación del drag & drop), archivos tocados, resultado real de tests/build, y las
      Open Questions de design.md (dirección de rotación, tamaño final de tarjeta) para que el
      usuario confirme o ajuste tras ver el resultado.
