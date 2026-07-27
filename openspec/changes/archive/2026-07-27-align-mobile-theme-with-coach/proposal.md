## Why

La app mobile (`Mobile/`, React Native + Expo, usada por jugadores y familiares) se creó recientemente (`feat(mobile): add React Native app for players and family members`) sin un theme propio: cada pantalla (`LoginScreen.tsx`, `TeamSwitcherScreen.tsx`, `CalendarScreen.tsx`, `EventDetailScreen.tsx`, `NewsScreen.tsx`) define sus colores inline en su propio `StyleSheet.create`, con una paleta genérica de iOS por defecto (`#007AFF` azul iOS, fondo `#fff`, textos `#666`/`#999`, borde `#ccc`/`#eee`, error `#d32f2f`, éxito `#4CAF50`). Esta paleta no tiene relación visual con ninguna de las dos apps web (Federation claro/neón, Coach oscuro/navy-azul-teal) y transmite una identidad de marca distinta a la que ven jugadores/familiares en el resto del ecosistema RFFM.

Queremos que la app mobile use los **mismos valores de color** que el tema Coach de la web (`Front/src/apps/coach/muiCoachTheme.ts`), para que jugadores y familiares perciban continuidad visual con la app que usan sus entrenadores. Nota importante para el `design.md`: el tema Coach actual (código, fuente de verdad) es un dark theme navy con azul acero (`#4d9de0`) y teal (`#4ec9b0`) como colores primario/secundario — no es "naranja" en sus tokens `palette.primary/secondary/background`; el naranja (`#ff9800` / `#ffa726` / `#ffcc80`) solo aparece como acento puntual en componentes concretos de asistencia (`AttendanceTabs.module.css`, `AttendanceSummary.module.css`). El alcance de este cambio es replicar los valores reales del código, no la descripción textual "oscuro/naranja".

## What Changes

- **Mobile**: crear una fuente única de valores de color (paleta) dentro de `Mobile/src/`, extraída 1:1 de los valores hexadecimales de `muiCoachTheme.ts` (fondo navy, superficie de tarjetas, azul primario, teal secundario, texto, borde, error, acento naranja de asistencia si se necesita en mobile), y sustituir los colores hardcodeados de las 5 pantallas existentes por referencias a esa paleta.
- **Mobile**: ajustar el `theme` de `NavigationContainer` (React Navigation) y los `headerStyle`/`tabBarStyle` en `RootNavigator.tsx` para que cabecera y barra de tabs usen la misma paleta (fondo navy, texto claro, acento azul en el tab activo).
- No se cambia ninguna librería nueva (sin `react-native-paper`, sin `styled-components`); se sigue usando `StyleSheet.create` por pantalla, solo que leyendo de una paleta compartida.

## Non-Goals

- No se toca `Front/src/apps/coach/muiCoachTheme.ts` ni ningún archivo de `Front/`.
- No se rediseña la disposición/UX de las pantallas mobile, solo los valores de color.
- No se introduce dark/light mode conmutable en mobile (el theme Coach ya es oscuro por defecto; mobile queda fijo en esa paleta).
- No se sincroniza automáticamente en build-time entre Front y Mobile (son repos/paquetes independientes sin dependencia compartida hoy); se documenta la decisión de duplicar valores vs. extraer paquete compartido en `design.md`.

## Impact

- **Mobile**: `Mobile/src/theme/colors.ts` (nuevo), `Mobile/src/screens/LoginScreen.tsx`, `Mobile/src/screens/TeamSwitcherScreen.tsx`, `Mobile/src/screens/CalendarScreen.tsx`, `Mobile/src/screens/EventDetailScreen.tsx`, `Mobile/src/screens/NewsScreen.tsx`, `Mobile/src/navigation/RootNavigator.tsx`.
- **Front**: ninguno (solo lectura de `muiCoachTheme.ts` como referencia de valores).
