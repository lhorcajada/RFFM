## 1. Paleta compartida `Mobile/src/theme/colors.ts` (≈1h)

- [x] Crear `Mobile/src/theme/colors.ts` con el objeto `coachColors` (12 tokens, ver `design.md` §2-3), cada valor con comentario apuntando a la línea de origen en `Front/src/apps/coach/muiCoachTheme.ts` o el `.module.css` de asistencia correspondiente.
- [x] Test primero (Red): `Mobile/src/theme/__tests__/colors.test.ts` fijando los 12 valores hex/rgba esperados.
- Verificar: `cd Mobile && npx jest src/theme/__tests__/colors.test.ts`

## 2. `LoginScreen.tsx` y `TeamSwitcherScreen.tsx` (≈1.5h)

- [x] Revisar/actualizar tests existentes en `Mobile/src/screens/__tests__/` para estas dos pantallas si aserta sobre estilos/colores (Red primero si aplica). (No aserta sobre colores; sin cambios necesarios.)
- [x] Sustituir literales hex por `coachColors.*` en `Mobile/src/screens/LoginScreen.tsx` (fondo, texto, borde, botón, error) y `Mobile/src/screens/TeamSwitcherScreen.tsx` (fondo, borde inferior, texto, error, `ActivityIndicator` color).
- Verificar: `cd Mobile && npx jest src/screens/__tests__/LoginScreen* src/screens/__tests__/TeamSwitcherScreen*`

## 3. `CalendarScreen.tsx` y `NewsScreen.tsx` (≈1h)

- [x] Sustituir literales hex por `coachColors.*` (fondo, borde, texto, botón, error, `ActivityIndicator`).
- [x] Actualizar tests existentes si aplica (Red primero). (Sin cambios necesarios, no aserta colores.)
- Verificar: `cd Mobile && npx jest src/screens/__tests__/CalendarScreen* src/screens/__tests__/NewsScreen*`

## 4. `EventDetailScreen.tsx` (≈1h)

- [x] Sustituir literales hex por `coachColors.*`, incluyendo el caso especial `#4CAF50` (éxito) → `coachColors.secondary` y `#f5f5f5`/`#333` → `coachColors.surface`/`coachColors.textPrimary` (ver justificación en `design.md` §4).
- [x] Actualizar tests existentes si aplica (Red primero). (Sin cambios necesarios, no aserta colores.)
- Verificar: `cd Mobile && npx jest src/screens/__tests__/EventDetailScreen*`

## 5. `RootNavigator.tsx` — theme de navegación (≈1h)

- [x] Definir `rffmCoachNavTheme` (basado en `DarkTheme` de `@react-navigation/native`) con los colores de `coachColors` y pasarlo a `<NavigationContainer theme={...}>` (ver `design.md` §5).
- [ ] Verificación manual: `cd Mobile && npx expo start`, comprobar visualmente que header y tab bar usan fondo navy/azul acero en vez de los colores por defecto de React Navigation. (No ejecutado en este entorno — requiere Expo Go/simulador interactivo; pendiente de verificación manual por el usuario.)
- Verificar: `cd Mobile && npx tsc --noEmit` (o el comando de type-check configurado en `package.json`)

## 6. Verificación final (≈30min)

- [x] `cd Mobile && npx jest` completo — 100% pass, sin tests skipped. (28/28 tests, 7 suites.)
- [x] `cd Mobile && npx tsc --noEmit` sin errores (TypeScript strict, sin `any` nuevo). (Los errores de `tsc` restantes son preexistentes — faltan `@types/jest`, afectan a todos los `*.test.tsx` por igual y ya existían antes de este cambio, verificado con `git stash`; ningún archivo de producción bajo `src/screens`, `src/theme` o `src/navigation` produce error.)
- [ ] Revisión visual manual (Expo Go o simulador) de las 5 pantallas + navegación, comparando con capturas del tema Coach web para confirmar coherencia de paleta. (Pendiente — no ejecutable en este entorno.)
- [x] Confirmar que no se tocó ningún archivo bajo `Front/` ni `Back/` en el diff final. (`git diff --stat -- Mobile` confirma que solo cambian los 6 archivos de `Mobile/src/` esperados.)
