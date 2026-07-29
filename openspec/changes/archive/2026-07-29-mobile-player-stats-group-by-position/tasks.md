## 1. Helper puro `groupPlayersByPosition.ts` (TDD Red → Green → Refactor)

> **Ya implementado y verificado en verde** (ver `implement.md` Step 1). Se deja el desglose
> aquí por trazabilidad; no repetir este trabajo. Las secciones 3 y 4 son las nuevas, a partir de
> este punto de partida ya existente.

Archivos: `Mobile/src/screens/hooks/__tests__/groupPlayersByPosition.test.ts` (nuevo),
`Mobile/src/screens/hooks/groupPlayersByPosition.ts` (nuevo).

- [x] 1.1 **[Red]** Escribir `groupPlayersByPosition.test.ts` con fixtures de `PlayerSeasonCard`
  (mínimas: `teamPlayerId`, `dorsal`, `activeDemarcation`) y los siguientes casos, todos deben
  fallar porque el módulo `groupPlayersByPosition.ts` aún no existe:
  - Devuelve una sección por cada grupo con al menos un jugador, con `title` exactamente
    `Porteros` / `Defensas` / `Medio centros` / `Bandas` / `Delanteros` / `Sin posición`, en ese
    orden fijo (dado un fixture con al menos un jugador por grupo).
  - Un grupo intermedio sin jugadores (p. ej. sin ningún `Delanteros`) está **ausente** del
    array resultado (no aparece con `data: []`).
  - El grupo `Sin posición` está ausente cuando ningún jugador tiene `activeDemarcation: null`.
  - Jugadores con `activeDemarcation: null` van todos a `Sin posición`, y esa sección es
    siempre la última cuando existe.
  - Dentro de `Defensas`, dado un input con codes en orden `LD, DFC, LI, LIB`, el resultado
    ordena `DFC, LIB, LI, LD` (orden de subposición, no orden de entrada).
  - Dentro de la misma subposición, dos jugadores con dorsales `9` y `3` se devuelven en orden
    `3, 9`.
  - Un jugador con `dorsal: null` en una subposición que también tiene dorsales numéricos
    aparece después de todos ellos, dentro de esa misma subposición.
  - El matching usa `activeDemarcation.code`, no `activeDemarcation.name` (fixture con `name`
    inesperado pero `code` conocido agrupa igual de correcto) — guarda contra una regresión a
    matching por nombre.
  - Ejecutar `npm test -- groupPlayersByPosition` y confirmar que **todos** los tests fallan
    (módulo no encontrado) antes de escribir ninguna implementación.
- [x] 1.2 **[Green]** Implementar `groupPlayersByPosition.ts`: constante `GROUPS` (5 grupos con
  `key`, `title`, `codes` en el orden documentado en `design.md`), bucketing por
  `activeDemarcation?.code` (null → `Sin posición`, code no reconocido → también `Sin
  posición`, sin caso especial adicional), comparador de orden `(subPositionIndex, dorsal ??
  Infinity)`, omisión de grupos sin jugadores del array devuelto. Ejecutar `npm test --
  groupPlayersByPosition` hasta que todos los tests de 1.1 pasen.
- [x] 1.3 **[Refactor]** Revisar el helper: nombres descriptivos, sin duplicación entre la
  lógica de bucketing y la de sort, tipado explícito de `PlayerPositionSection` exportado
  (sin `any`). Re-ejecutar `npm test -- groupPlayersByPosition` y confirmar que sigue en verde
  tras cualquier ajuste.

**Hecho cuando**: `npm test -- groupPlayersByPosition` pasa al 100%, sin tests saltados, y el
archivo `groupPlayersByPosition.ts` no importa nada de React Native ni de `api/` (función pura).

---

## 2. Refactor de `PlayerSeasonCardsScreen.tsx` a `SectionList` (TDD Red → Green → Refactor)

> **Ya implementado y verificado en verde** (ver `implement.md` Step 2). No repetir. La sección 3
> siguiente construye sobre este `SectionList` ya existente.

Archivos: `Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx` (existente, extendido),
`Mobile/src/screens/PlayerSeasonCardsScreen.tsx` (existente, modificado).

- [x] 2.1 **[Red]** Antes de tocar el componente, añadir a `PlayerSeasonCardsScreen.test.tsx`
  los nuevos tests (deben fallar contra la implementación actual basada en `ScrollView`/`.map()`,
  que no renderiza ninguna cabecera de sección):
  - Dado un set de cards que cubre varios grupos (uno `POR`, uno `DFC`, uno `DC`, uno con
    `activeDemarcation: null`), se encuentran las cabeceras esperadas vía
    `findByTestId('position-section-header-<key>')` para cada grupo presente
    (`porteros`, `defensas`, `delanteros`, `sin-posicion`), en el orden fijo (asserted
    comparando el índice de renderizado de cada cabecera, p. ej. vía el orden de aparición en
    `getAllByTestId(/position-section-header-/)` o comprobando el orden relativo con
    `UNSAFE_getAllByType`/queries de Testing Library).
  - Dado un set de cards donde ningún jugador tiene `activeDemarcation: null`, el testID
    `position-section-header-sin-posicion` **no** se renderiza (`queryByTestId` devuelve
    `null`).
  - Re-ejecutar los tests existentes de `player-season-card-{id}`, `player-alias-{id}`,
    `player-dorsal-{id}`, `player-photo(-placeholder)-{id}`, `player-demarcation-{id}`,
    `player-possible-demarcation-{id}-{demarcationId}`, `stat-{key}-{id}` — deben seguir
    presentes (compilan/pasan si no cambia el componente todavía, o siguen siendo las
    aserciones de referencia contra las que se validará el refactor).
  - Ejecutar `npm test -- PlayerSeasonCardsScreen` y confirmar que los tests **nuevos** de
    cabeceras fallan (no hay cabeceras en la implementación actual) antes de tocar el
    componente.
- [x] 2.2 **[Green]** Refactorizar `PlayerSeasonCardsScreen.tsx`:
  - Importar `SectionList` de `react-native` y `groupPlayersByPosition` del nuevo helper.
  - Extraer el cuerpo actual del `.map()` a una función `renderPlayerCard(card:
    PlayerSeasonCard)` con la misma JSX/`testID`s, sin cambios de marcado.
  - Calcular `const sections = useMemo(() => groupPlayersByPosition(cards), [cards]);`.
  - Sustituir el bloque `<ScrollView>...</ScrollView>` de la vista de datos por `<SectionList
    sections={sections} keyExtractor={...} renderSectionHeader={...} renderItem={({ item })
    => renderPlayerCard(item)} .../>`, con `renderSectionHeader` mostrando
    `testID="position-section-header-{section.key}"` y el `section.title`.
  - Añadir el estilo `sectionHeader` en el `StyleSheet.create` existente, reutilizando
    `coachColors.textSecondary` (sin hex nuevos).
  - Mantener sin cambios los `return` tempranos de loading/error/empty.
  - Ejecutar `npm test -- PlayerSeasonCardsScreen` hasta que todos los tests (existentes +
    nuevos de 2.1) pasen.
- [x] 2.3 **[Refactor]** Revisar el componente: eliminar cualquier import no usado
  (`ScrollView` si ya no se usa en ningún otro punto del archivo), confirmar que
  `renderPlayerCard` no quedó con lógica duplicada respecto al `StyleSheet`, y que
  `groupPlayersByPosition` se llama una sola vez por render relevante (memoizado). Re-ejecutar
  `npm test -- PlayerSeasonCardsScreen` y confirmar que sigue en verde.

**Hecho cuando**: `npm test -- PlayerSeasonCardsScreen` pasa al 100%, ningún test preexistente
del archivo fue modificado sin justificación (solo los nuevos tests de cabeceras se añaden), y
los tres estados existentes (loading/error/data) siguen funcionando exactamente igual que antes,
ahora con los datos agrupados en el estado "data".

---

## 3. Cabeceras plegables/desplegables, acordeón exclusivo y contador (TDD Red → Green → Refactor)

**Nuevo requisito, incremental sobre el trabajo ya hecho en 1 y 2** (`SectionList` +
`groupPlayersByPosition` ya existen y están en verde). No repetir tests/implementación de las
secciones 1 y 2 — esta sección solo añade: estado de expansión, estilo de cabecera acentuado,
contador de jugadores, icono chevron y comportamiento de acordeón exclusivo. Ver `design.md`
decisiones 4 y 6 para el detalle técnico completo (estilos exactos, nombre de icono confirmado
contra el glyph map instalado de `@expo/vector-icons`, y la estrategia de `visibleSections`
derivada).

Archivos: `Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx` (existente, extendido
de nuevo), `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` (existente, modificado de nuevo).

- [ ] 3.1 **[Red]** Actualizar primero los tests que ya existen y que hoy asumen que las cards
  se renderizan sin necesidad de expandir nada (comportamiento que cambia con este requisito).
  Para cada test preexistente que haga `findByTestId`/`getByTestId` sobre un `player-*`/`stat-*`
  testID (los del trabajo original, más los 3 añadidos en la sección 2 de este mismo
  `tasks.md`), añadir **una línea** de `fireEvent.press` sobre la cabecera de sección
  correspondiente (`position-section-header-porteros` para fixtures con `cardOne`,
  `position-section-header-sin-posicion` para fixtures con `cardTwo`, etc.) inmediatamente antes
  de la aserción existente sobre la card. **No cambiar el valor esperado de ninguna aserción** —
  solo añadir el paso de "expandir primero". Documentar en el propio diff/PR que este cambio es
  intencional y viene de "todo empieza plegado" (ver `design.md` → Testing Strategy → "Required
  update to the tests above..."). Ejecutar `npm test -- PlayerSeasonCardsScreen` y confirmar que
  estos tests ahora **fallan** contra la implementación actual (que no tiene collapse, así que
  el `fireEvent.press` sobre una cabecera no hace nada todavía — pero el objetivo es preparar el
  arreglo, no que fallen por eso; en la práctica, como hoy las cards siempre están visibles,
  estos tests seguirán pasando hasta que 3.2 introduzca el colapso por defecto. Confirmar
  explícitamente, tras escribir 3.2, que sin el `fireEvent.press` añadido estos tests SÍ fallan
  contra la nueva implementación colapsada — esa es la comprobación roja real de este paso).
- [ ] 3.2 **[Red]** Añadir los tests nuevos del comportamiento de colapso/expansión/acordeón a
  `PlayerSeasonCardsScreen.test.tsx` (deben fallar contra la implementación actual, que no tiene
  estado de expansión ni cabeceras pulsables):
  - Estado inicial: tras resolver la carga, con cards en 2+ grupos, ningún `player-season-card-*`
    testID está presente (`queryByTestId` → `null`) aunque las cabeceras de sección sí lo están.
  - Tap para expandir: `fireEvent.press` sobre `position-section-header-porteros` hace que las
    cards de ese grupo aparezcan, mientras las de otros grupos siguen ausentes.
  - Tap de nuevo para colapsar: pulsar la misma cabecera ya expandida oculta sus cards de nuevo.
  - Acordeón exclusivo: con fixtures en 2 grupos distintos, expandir el primero (su card
    aparece), luego expandir el segundo → la card del segundo aparece **y** la del primero vuelve
    a estar ausente, en el mismo test.
  - Icono chevron: `position-section-chevron-porteros` tiene `name` `'chevron-forward-outline'`
    antes de pulsar y `'chevron-down-outline'` después (nombres confirmados contra el glyph map
    instalado de Ionicons — no asumidos).
  - Contador visible en ambos estados: con un grupo de tamaño conocido (p. ej. 2 cards en
    `defensas`), el texto de la cabecera incluye `Defensas (2)` tanto en estado colapsado
    (inicial) como tras expandir (sigue `Defensas (2)`, sin cambiar).
  - Ejecutar `npm test -- PlayerSeasonCardsScreen` y confirmar que todos estos tests nuevos
    fallan antes de tocar el componente.
- [ ] 3.3 **[Green]** Implementar en `PlayerSeasonCardsScreen.tsx`:
  - `const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(null);` (inicio
    siempre colapsado, sin persistencia).
  - `toggleSection(key)` con el patrón "si ya es la expandida, vuelve a `null`; si no, pasa a ser
    la nueva expandida" (acordeón exclusivo por construcción, un solo slot de estado).
  - `const visibleSections = useMemo(() => sections.map(s => ({ ...s, data: s.key ===
    expandedSectionKey ? s.data : [] })), [sections, expandedSectionKey]);` — pasar
    `visibleSections` (no `sections`) a `<SectionList sections={...} />`.
  - `renderSectionHeader` pasa de `Text` a `Pressable` con `onPress={() =>
    toggleSection(section.key)}`; el texto del título usa el conteo leído de `sections` (la
    fuente sin colapsar), **no** de `section.data.length` del argumento (que puede estar vacío
    por el colapso) — ver `design.md` decisión 6 para el porqué exacto.
  - Añadir `<Ionicons testID={...} name={isExpanded ? 'chevron-down-outline' :
    'chevron-forward-outline'} size={18} color={coachColors.primaryLight} />` dentro de la
    cabecera, e importar `Ionicons` de `@expo/vector-icons` (mismo paquete ya usado en
    `RootNavigator.tsx`).
  - Actualizar el estilo `sectionHeader` existente (fondo `coachColors.surfaceAlt`, borde
    `coachColors.border`, `flexDirection: 'row'`, `justifyContent: 'space-between'`) y añadir
    `sectionHeaderTitle` (`coachColors.primaryLight`, `fontWeight: '800'`) — exactamente como en
    `design.md` decisión 4. Sin hex nuevos.
  - Ejecutar `npm test -- PlayerSeasonCardsScreen` hasta que **todos** los tests pasen: los
    preexistentes (ahora con el `fireEvent.press` añadido en 3.1) y los nuevos de 3.2.
- [ ] 3.4 **[Refactor]** Revisar: que `toggleSection`/`visibleSections` no dupliquen lógica de
  `groupPlayersByPosition` (que sigue sin saber nada de colapso, por diseño), que no quede ningún
  `console.log`/comentario de depuración, y que los nombres de icono/testID coincidan
  exactamente con `design.md`. Re-ejecutar `npm test -- PlayerSeasonCardsScreen` y confirmar que
  sigue en verde.

**Hecho cuando**: `npm test -- PlayerSeasonCardsScreen` pasa al 100%; los únicos cambios a
aserciones preexistentes son la línea añadida de `fireEvent.press` antes de cada aserción de
card (documentada como intencional, no como "arreglo" de un test roto); todos los grupos
arrancan colapsados; solo una sección puede estar expandida a la vez; el contador se ve en
ambos estados; el chevron refleja el estado.

---

## 4. Verificación final

- [ ] 4.1 Ejecutar `npm test` completo en `Mobile/` (no solo los archivos tocados) y confirmar
  100% de tests en verde, sin ningún `it.skip`/`test.skip`/`xit` nuevo ni preexistente.
- [ ] 4.2 Diff-review de `PlayerSeasonCardsScreen.test.tsx`: confirmar que la única alteración a
  aserciones preexistentes (fuera de las 3 añadidas en la sección 2) es la línea de
  `fireEvent.press` sobre la cabecera correspondiente, añadida en la sección 3.1 con
  justificación explícita ("todo empieza plegado") — ningún valor esperado de una aserción
  existente cambió.
- [ ] 4.3 Revisar cobertura del código nuevo/modificado (`groupPlayersByPosition.ts` +
  las líneas de `PlayerSeasonCardsScreen.tsx` correspondientes a agrupación, `SectionList`,
  estado de expansión y acordeón) con `npm test -- --coverage` (o el flag equivalente
  configurado en `Mobile/`) y confirmar ≥75%, priorizando ramas de "grupo vacío omitido",
  "dorsal null al final", "colapsado por defecto", "toggle" y "exclusividad del acordeón" sobre
  líneas triviales.
- [ ] 4.4 Ejecutar `npm run start`/type-check si el proyecto lo tiene configurado (o `tsc
  --noEmit` si aplica) para confirmar que no hay errores de tipos introducidos por el uso de
  `SectionList<PlayerSeasonCard, PlayerPositionSection>`, el nuevo helper, o los props de
  `Ionicons`/`Pressable` añadidos a la cabecera.
- [ ] 4.5 Confirmar visualmente (o vía snapshot/test) que la cabecera usa únicamente tokens de
  `coachColors` ya existentes (`surfaceAlt`, `border`, `primaryLight`) — sin ningún valor hex
  nuevo introducido en `PlayerSeasonCardsScreen.tsx`.

**Hecho cuando**: `npm test` en `Mobile/` pasa completo, sin tests saltados, sin regresiones no
justificadas en `PlayerSeasonCardsScreen.test.tsx`, la cobertura del código nuevo/modificado
cumple el objetivo ≥75% de `.claude/rules/frontend-testing.md` §4.6, y el comportamiento de
colapso/expansión/acordeón/contador/chevron descrito en `design.md` está completamente
implementado y testeado.
