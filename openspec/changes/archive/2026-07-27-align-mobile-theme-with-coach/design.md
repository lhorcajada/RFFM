## Architecture Decisions

### 1. ¿Extraer un paquete compartido de colores entre `Front/` y `Mobile/`, o duplicar los valores?

**Decisión: duplicar los valores** en `Mobile/src/theme/colors.ts`, no extraer un paquete npm compartido (`@rffm/theme-tokens` o similar).

Motivos:
- `Front/` (Vite/npm workspace propio) y `Mobile/` (Expo, `package.json` independiente, sin lockfile/workspace común — confirmado: no hay `pnpm-workspace.yaml` ni `workspaces` en la raíz del repo) no comparten hoy ningún mecanismo de paquete interno. Introducir uno (monorepo tooling, publicar un paquete privado, o un `file:` dependency cruzando carpetas) es una decisión de arquitectura transversal mayor, fuera del alcance de "alinear colores" y no lo pidió el usuario.
- Los valores de `muiCoachTheme.ts` son un `createTheme()` de MUI (objeto con `palette`, `components.styleOverrides`, CSS vars) — no es un JSON/const de colores planos; consumirlo tal cual desde React Native no tiene sentido (RN no usa MUI). Lo único portable son los **valores hex/rgba**, no la estructura.
- El coste de mantener 6-8 constantes hex duplicadas entre dos proyectos es bajo comparado con el coste de acoplar builds. Si en el futuro se detecta drift (alguien cambia el azul en Coach y se olvida de Mobile), se puede añadir un test de "snapshot" (ver Tests) que falle si los valores divergen, sin necesitar un paquete compartido.
- Se documenta explícitamente en el propio archivo de qué theme viene cada valor (comentario con la línea de origen en `muiCoachTheme.ts`) para facilitar mantenerlos sincronizados a mano.

### 2. Mapeo de valores: `muiCoachTheme.ts` → `Mobile/src/theme/colors.ts`

Extracción literal de los hex de `Front/src/apps/coach/muiCoachTheme.ts` (líneas citadas del archivo actual):

| Token semántico mobile | Valor | Origen en `muiCoachTheme.ts` |
|---|---|---|
| `background` | `#07071a` | `palette.background.default` (línea 17) / `--bg` |
| `surface` (tarjetas, headers) | `#1c1c30` | `palette.background.paper` (línea 18) / `--rffm-card-bg` |
| `surfaceAlt` (appbar/header medio) | `#252545` | `MuiAppBar.styleOverrides.root.backgroundColor` (línea 55) |
| `primary` | `#4d9de0` | `palette.primary.main` (línea 8) |
| `primaryLight` | `#7ab8f5` | `palette.primary.light` (línea 9) |
| `secondary` (teal) | `#4ec9b0` | `palette.secondary.main` (línea 13) |
| `textPrimary` | `#e8e8e8` | `palette.text.primary` (línea 21) |
| `textSecondary` | `rgba(255,255,255,0.55)` | `palette.text.secondary` (línea 22) |
| `divider`/`border` | `rgba(255,255,255,0.08)` | `palette.divider` (línea 24) |
| `error` | `#ff9b9b` | `AttendanceSummary.module.css` línea 216 (único rojo/error definido en el ecosistema Coach; se reutiliza porque Coach no define `palette.error` explícito) |
| `accentOrange` (uso puntual, ej. estados de asistencia si mobile los necesita) | `#ff9800` | `AttendanceTabs.module.css` línea 214/223/321 |
| `contrastText` | `#0d0d1f` | `palette.primary.contrastText` (línea 10) |

No se inventan colores nuevos: todo valor en `colors.ts` debe poder señalarse a una línea concreta de un archivo existente bajo `Front/src/apps/coach/`.

### 3. Nuevo archivo `Mobile/src/theme/colors.ts`

```ts
// Paleta extraída 1:1 de Front/src/apps/coach/muiCoachTheme.ts (tema Coach, web).
// Mantener sincronizado a mano si se retocan los valores del theme Coach.
export const coachColors = {
  background: '#07071a',      // palette.background.default
  surface: '#1c1c30',         // palette.background.paper / --rffm-card-bg
  surfaceAlt: '#252545',      // MuiAppBar backgroundColor
  primary: '#4d9de0',         // palette.primary.main
  primaryLight: '#7ab8f5',    // palette.primary.light
  secondary: '#4ec9b0',       // palette.secondary.main (teal)
  textPrimary: '#e8e8e8',     // palette.text.primary
  textSecondary: 'rgba(255,255,255,0.55)', // palette.text.secondary
  border: 'rgba(255,255,255,0.08)',        // palette.divider
  error: '#ff9b9b',           // AttendanceSummary.module.css
  accentOrange: '#ff9800',    // AttendanceTabs.module.css
  contrastText: '#0d0d1f',    // palette.primary.contrastText
} as const;

export type CoachColorToken = keyof typeof coachColors;
```

Se exporta un objeto plano (no un `ThemeProvider` de RN, ya que el proyecto no usa `react-native-paper` ni ninguna librería de theming) para minimizar el diff: cada pantalla sigue usando `StyleSheet.create`, solo que referenciando `coachColors.xxx` en vez de literales hex.

### 4. Sustitución en pantallas existentes

Mapeo directo de los literales actuales (ver inventario en `proposal.md`) a tokens:

- `#007AFF` (azul iOS, botones/loading/links) → `coachColors.primary`
- `#fff` (fondos de pantalla) → `coachColors.background` (nota: esto invierte fondo blanco→navy oscuro, es el objetivo del cambio)
- `#666` (texto secundario) → `coachColors.textSecondary`
- `#999` (texto terciario/placeholder) → `coachColors.textSecondary` (se reutiliza; no hay dos niveles de gris distintos en el theme Coach)
- `#ccc`, `#eee` (bordes) → `coachColors.border`
- `#d32f2f` (error) → `coachColors.error`
- `#4CAF50` (éxito, `EventDetailScreen.tsx` línea 170, botón de confirmar asistencia) → `coachColors.secondary` (teal, el theme Coach no tiene un verde de éxito propio; el teal es el color secundario más cercano en la paleta real)
- `#f5f5f5` (fondo alternativo, `EventDetailScreen.tsx` línea 173) → `coachColors.surface`
- `#333` (texto sobre fondo claro, línea 183) → `coachColors.textPrimary` (deja de tener sentido "texto oscuro sobre fondo claro" una vez el fondo pasa a navy; se homogeneiza a texto claro)

Ejemplo concreto (`Mobile/src/screens/LoginScreen.tsx`, bloque `StyleSheet.create` actual en líneas 85-130):

```ts
import { coachColors } from '../theme/colors';

const styles = StyleSheet.create({
  container: {
    backgroundColor: coachColors.background, // era '#fff'
  },
  subtitle: {
    color: coachColors.textSecondary, // era '#666'
  },
  input: {
    borderColor: coachColors.border, // era '#ccc'
  },
  button: {
    backgroundColor: coachColors.primary, // era '#007AFF'
  },
  buttonText: {
    color: coachColors.contrastText, // era '#fff' — sobre fondo azul primario ahora se usa el contrastText del theme Coach
  },
  error: {
    color: coachColors.error, // era '#d32f2f'
  },
});
```

Mismo patrón para `TeamSwitcherScreen.tsx`, `CalendarScreen.tsx`, `EventDetailScreen.tsx`, `NewsScreen.tsx` y el `color="#007AFF"` inline de los `<ActivityIndicator>` (pasa a `color={coachColors.primary}`).

### 5. `RootNavigator.tsx` — cabecera y tabs

React Navigation soporta un `theme` en `NavigationContainer` y `screenOptions.headerStyle`/`headerTintColor`. Cambios:

```tsx
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { coachColors } from '../theme/colors';

const rffmCoachNavTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: coachColors.background,
    card: coachColors.surfaceAlt,
    text: coachColors.textPrimary,
    primary: coachColors.primary,
    border: coachColors.border,
  },
};
```

y en `<NavigationContainer theme={rffmCoachNavTheme}>`. El `Stack.Navigator` (`screenOptions.headerShown`) y el `Tab.Navigator` heredan automáticamente `card`/`text`/`primary` del theme para cabecera y barra de tabs (comportamiento estándar de `@react-navigation/native` — no hace falta repetir `headerStyle` manualmente salvo que se quiera un tono distinto para el header vs el body, en cuyo caso se añade `headerStyle: { backgroundColor: coachColors.surfaceAlt }` explícito en `screenOptions` del `Stack.Navigator`).

## Files

**Mobile** (nuevo):
- `Mobile/src/theme/colors.ts`
- `Mobile/src/theme/__tests__/colors.test.ts` (test de que los valores coinciden con los documentados, ver Tests)

**Mobile** (modificados):
- `Mobile/src/screens/LoginScreen.tsx`
- `Mobile/src/screens/TeamSwitcherScreen.tsx`
- `Mobile/src/screens/CalendarScreen.tsx`
- `Mobile/src/screens/EventDetailScreen.tsx`
- `Mobile/src/screens/NewsScreen.tsx`
- `Mobile/src/navigation/RootNavigator.tsx`

**Front**: ninguno.

## Tests (TDD — Red → Green → Refactor)

Mobile usa Jest (`jest.config.js`, `jest.setup.js` ya presentes) + `@testing-library/react-native` (verificar en `package.json` durante implementación; si no está, se testea el módulo `colors.ts` con Jest puro y los screens existentes con los tests ya presentes en `src/screens/__tests__`).

- `Mobile/src/theme/__tests__/colors.test.ts`: test unitario puro que fija los valores esperados (`expect(coachColors.primary).toBe('#4d9de0')`, etc.) para las 12 claves — actúa como "contrato" que debe actualizarse a mano si el theme Coach cambia (documenta el acoplamiento manual descrito en la decisión §1).
- Tests existentes en `Mobile/src/screens/__tests__/*`: revisar si alguno hace snapshot o asserts sobre colores/estilos inline; si es así, actualizar expectativas para usar `coachColors.*` en vez de los hex antiguos (Red: el test debe fallar primero si se cambia el color sin actualizar el test, confirmando que el test realmente cubre el estilo).
- No se requiere test de integración adicional para `RootNavigator.tsx` (no hay tests de navegación hoy); se verifica manualmente con `npx expo start` que cabecera/tabs usan la paleta navy/azul.

Coverage objetivo: ≥75% para `colors.ts` y los cambios en screens (según CLAUDE.md, "Components ≥75%").
