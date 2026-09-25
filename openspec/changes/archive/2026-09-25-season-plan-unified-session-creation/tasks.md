## 1. Función `findMicrocicloByApiId` (TDD)

- [x] 1.1 Red: `season-plan/__tests__/findMicrociclo.test.ts` — encuentra el microciclo por
      `apiId` en un plan con varios macro/meso; devuelve `null` con plan `null` o id inexistente.
- [x] 1.2 Green: `season-plan/findMicrociclo.ts`.

## 2. Tablero de contenido con microciclo (TDD)

- [x] 2.1 Red: `season-plan/__tests__/ContentBoardPage.test.tsx` — con `?microcicloId=A`:
      - solo se renderizan las sesiones con `microcicloId` A;
      - "Nueva sesión" llama a `trainingService.createSession` con `microcicloId: "A"`, `date: null`;
      - la cabecera muestra `weekLabel` y fechas desde `location.state.microciclo`;
      - sin state, la cabecera muestra "Microciclo seleccionado" si no hay sesiones filtradas;
      - "Ver todas las sesiones" muestra todas las sesiones;
      - sin Modelo de Juego, "Crear sesión sin contenido" navega a `new-session` con `microcicloId=A`.
      Sin `microcicloId`: se muestran todas y la creación envía `microcicloId: null` (regresión).
- [x] 2.2 Green: `ContentBoardPage.tsx` (+ estilos en `ContentBoardPage.module.css`) según
      design.md D2–D5.

## 3. Acciones de `Trainings` (TDD)

- [x] 3.1 Red: test de `Trainings` (extender el existente o crear
      `pages/trainings/__tests__/Trainings.planningActions.test.tsx`):
      - la pestaña Planificación no muestra "Planificar contenido";
      - "Crear sesión" de un microciclo navega a `content-board` con `microcicloId`;
      - la pestaña Sesiones muestra "Tablero de contenido", que navega a `content-board` sin
        `microcicloId`.
- [x] 3.2 Green: `Trainings.tsx` según design.md D1 y D6.

## 4. Verificación

- [x] 4.1 `cd Front && npm run test` en verde (suite completa de `pages/trainings`).
- [x] 4.2 `cd Front && npm run build` en verde.
- [ ] 4.3 Revisión visual a ~375px y en escritorio: cabecera del tablero con microciclo y barra
      de acciones de Planificación/Sesiones.
- [x] 4.4 `openspec validate season-plan-unified-session-creation --strict` sin errores.
