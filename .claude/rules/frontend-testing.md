# Reglas de Testing — Frontend (Front + Mobile)

Reglas obligatorias para la creación y modificación de tests en `Front/` (Vitest + Testing
Library) y `Mobile/` (Jest + Testing Library for React Native).
Basadas en TDD (Test-Driven Development) — ver también la metodología en `CLAUDE.md`.

---

## 1. Filosofía TDD

### 1.1 Ciclo Red-Green-Refactor
- **Red**: escribe el test que define el comportamiento deseado y verifica que falla.
- **Green**: escribe el código de producción mínimo que lo hace pasar.
- **Refactor**: mejora el código manteniendo los tests en verde.
- **Nunca** escribir código de producción sin un test que lo justifique.
- **Nunca** saltar el paso Red — si no viste el test fallar, no es TDD.

### 1.2 Orden de trabajo
1. Escribir el test (o los tests) que cubren el comportamiento nuevo o corregido.
2. Ejecutar y confirmar que falla (Red).
3. Implementar el código mínimo para que pase (Green).
4. Ejecutar toda la suite afectada y confirmar que pasa.
5. Refactorizar si hace falta, manteniendo todo en verde.
6. Añadir edge cases si el happy path ya está cubierto.

---

## 2. Front (`Front/`) — Vitest + Testing Library

### 2.1 Ubicación
- Co-ubicados en `__tests__/` junto al componente/hook que testean:
  `pages/Dashboard/components/__tests__/DashboardCards.clubCard.test.tsx`.
- Un archivo de test puede cubrir un aspecto concreto de un componente
  (`DashboardCards.clubCard.test.tsx`, `DashboardCards.permissions.test.tsx`) en vez de un
  único archivo gigante por componente — sigue ese patrón cuando el componente tiene varias
  facetas de comportamiento independientes.

### 2.2 Mocking
- `vi.mock(...)` para servicios y hooks externos, declarado **antes** del `import` del
  componente bajo test (hoisting de Vitest).
- Mockear servicios de API (`*Service.ts`) y hooks de datos (`useUserTeams`,
  `usePermissions`…) — nunca dejar que un test golpee la red real.
- `vi.clearAllMocks()` en `beforeEach` para evitar fugas de estado entre tests.

### 2.3 Aserciones
- Usar queries de Testing Library orientadas a usuario: `getByRole`, `getByText`,
  `queryByRole` — evitar `getByTestId` salvo que no haya otra forma accesible de localizar el
  elemento.
- Envolver componentes que usan routing en `<MemoryRouter>`.
- Nombres de test descriptivos en español, como frase completa:
  `it("nunca renderiza la tarjeta Club para un entrenador", ...)`.

### 2.4 Qué testear
- Comportamiento observable por el usuario (qué se renderiza, qué pasa al hacer click) — no
  detalles de implementación interna.
- Reglas de negocio de UI: visibilidad condicional, permisos, estados de carga/error/vacío.
- **No** testear estilos CSS Modules ni el marcado exacto de MUI.

### 2.5 Comandos
```bash
cd Front
npm run test              # Vitest
npx playwright test       # E2E (flujos críticos de usuario)
```

---

## 3. Mobile (`Mobile/`) — Jest + Testing Library for React Native

### 3.1 Ubicación
- Co-ubicados en `__tests__/` junto al archivo que testean, mismo patrón que Front:
  `screens/__tests__/PlayerSeasonCardsScreen.test.tsx`,
  `navigation/__tests__/CalendarTabs.test.tsx`.

### 3.2 Mocking de navegación
- Al testear un `Tab.Navigator`/`Stack.Navigator`, mockear
  `@react-navigation/bottom-tabs` (o el paquete equivalente) para renderizar `Screen` como
  `View`/`Text` con `testID` predecibles (`tab-screen-<name>`, `tab-label-<name>`) — así se
  puede aserta sobre `tabBarLabel` y el resultado de `tabBarIcon` sin montar navegación real.
- Mockear las pantallas hijas con `jest.mock('../../screens/XScreen', () => 'XScreen')`
  cuando el test es sobre la estructura de navegación, no sobre el contenido de la pantalla.

### 3.3 Mocking de API y contexto
- Mockear el módulo `api` (`src/api/client.ts`) con `jest.Mock` para las llamadas HTTP —
  nunca red real en tests.
- Los mensajes de error esperados siguen el patrón
  `e.response?.data?.detail || '<fallback en español>'`: testear **ambos** casos — cuando el
  backend manda `detail` y cuando no (fallback).

### 3.4 Aserciones
- `findByTestId`/`getByTestId` son aceptables en Mobile (no hay roles de accesibilidad DOM
  equivalentes a web en todos los componentes) pero, si el elemento expone `role`/`label`
  accesible, prefiérelo.
- `waitFor` para esperar efectos asíncronos (llamadas a `api.get` tras `useEffect`).
- Nombres de test descriptivos en inglés o español según el archivo existente — mantener
  consistencia con los tests ya presentes en el mismo archivo, no mezclar idiomas dentro del
  mismo `describe`.

### 3.5 Qué testear
- Comportamiento de pantalla: loading → data / loading → error → retry / empty state.
- Estructura de navegación: labels e iconos de tabs, rutas registradas.
- Contextos (`AuthContext`, `ToastContext`): transiciones de estado, no implementación interna.

### 3.6 Comandos
```bash
cd Mobile
npm test                              # toda la suite Jest
npm test -- <archivo o patrón>        # subconjunto
```

---

## 4. Reglas generales (ambos)

### 4.1 Evitar tests triviales
- No testear getters/setters, mapeos directos de props a JSX sin lógica, ni el propio
  framework (React, MUI, React Navigation).

### 4.2 Un test, un comportamiento
- Cada `it`/`test` verifica un único comportamiento. Si necesita varias aserciones, deben
  pertenecer todas al mismo comportamiento observado.

### 4.3 Determinismo e independencia
- Sin dependencias de `Date.now()`/`Math.random()` sin control; usar fechas fijas.
- Cada test es independiente — no asumir estado dejado por el test anterior.
- Limpiar mocks (`vi.clearAllMocks()` / `jest.clearAllMocks()`) entre tests cuando el archivo
  comparte mocks a nivel de módulo.

### 4.4 No testear implementación
- Testear comportamiento observable (lo que ve/hace el usuario), no detalles internos que
  puedan cambiar en un refactor sin alterar el comportamiento.
- Al refactorizar, los tests existentes deben seguir pasando sin cambios; si un test se rompe
  por un refactor sin cambio de comportamiento, probablemente testeaba implementación.

### 4.5 Tests ignorados
- `it.skip` / `test.skip` / `xit` son un code smell — no dejarlos sin que el usuario lo
  apruebe explícitamente con una razón documentada.

### 4.6 Cobertura objetivo
- Componentes/pantallas: ≥75% del código modificado.
- Priorizar cobertura de ramas de error y estados vacíos sobre cobertura de líneas triviales.

---

## 5. Flujo TDD por tipo de cambio

### 5.1 Componente/pantalla nuevo
1. Escribir el test del happy path (renderiza con datos) — Red.
2. Implementar el componente mínimo — Green.
3. Añadir tests de loading/error/empty — Red → Green por cada uno.
4. Refactorizar manteniendo todo en verde.

### 5.2 Cambio visual o de copy (label, icono, texto)
1. Actualizar el test que asserta el valor anterior al nuevo valor esperado — debe fallar
   (Red) contra el código actual.
2. Cambiar el código de producción — Green.
3. Ejecutar toda la suite del archivo/directorio afectado para descartar regresiones.

### 5.3 Bug fix
1. Escribir un test que reproduzca el bug — debe fallar.
2. Corregir el código de producción.
3. Verificar que el test pasa y que no hay regresiones en la suite completa del área.
