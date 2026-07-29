# Reglas React Native — Mobile (Expo)

Reglas obligatorias para toda generación y modificación de código en `Mobile/`.

---

## 0. Antes de nada: Expo ha cambiado

`Mobile/AGENTS.md` avisa explícitamente:

> Expo HAS CHANGED. Read the exact versioned docs at
> https://docs.expo.dev/versions/v57.0.0/ before writing any code.

- No asumas comportamiento de versiones anteriores de Expo/React Navigation por
  entrenamiento previo. Si vas a usar una API de Expo (SecureStore, Constants, notificaciones,
  cámara, etc.) o cambiar configuración de navegación, consulta la documentación versionada
  exacta primero.

---

## 1. Stack

| Concern | Librería |
|---|---|
| Runtime | Expo (ver versión exacta en `Mobile/AGENTS.md` / `package.json`) |
| Navegación | `@react-navigation/native` + `bottom-tabs` + `native-stack` |
| Iconos | `@expo/vector-icons` (`Ionicons`) |
| HTTP | Axios — instancia única en `src/api/client.ts` |
| Auth storage | `expo-secure-store` vía `src/auth/secureStore.ts` |
| Tests | Jest + `@testing-library/react-native` |

---

## 2. Pantallas (`screens/`)

- Una pantalla por archivo: `PascalCase` + sufijo `Screen` (`CalendarScreen.tsx`,
  `PlayerSeasonCardsScreen.tsx`).
- Componentes usados solo por una o varias pantallas (no globales) van en
  `screens/components/`; hooks propios de pantallas en `screens/hooks/`.
- Componentes realmente transversales (usados fuera de `screens/`) van en
  `shared/components/`.
- El patrón de carga de datos habitual en una pantalla: `useState` para
  `loading`/`error`/datos, `useEffect` que dispara un `fetchXxx` async, `try/catch` que llama
  al servicio de `api/` y setea `error` con `e.response?.data?.detail || '<mensaje fallback en
  español>'`. Sigue este patrón salvo que la pantalla ya use otro distinto.

---

## 3. Navegación (`navigation/`)

- `RootNavigator.tsx` es el único punto de entrada; decide el stack según
  `useAuth().isAuthenticated`.
- Los grupos de pestañas (`Tab.Navigator`) se definen como componentes exportados
  (`CalendarTabs`) para poder testearlos de forma aislada.
- **El `name` interno de una `Tab.Screen`/`Stack.Screen` es distinto de lo que ve el
  usuario.** Cambiar `tabBarLabel` o `tabBarIcon` no debe tocar el `name` — otros lugares
  (tests, navegación programática, `initialParams`) dependen de ese identificador estable.
- Icono de cada tab: usar el nombre de `Ionicons` más literal para el concepto (p. ej.
  `stats-chart-outline` para estadísticas, no un icono genérico o metafórico) y mantener el
  sufijo `-outline` consistente con el resto de tabs.
- Los params de ruta (`teamId`, `teamPlayerId`…) se propagan explícitamente vía
  `initialParams`/`route.params` — no se leen de un store global.

---

## 4. API (`api/`)

- Único cliente Axios: `src/api/client.ts`. `baseURL` desde
  `Constants.expoConfig?.extra?.apiBaseUrl`. No crear otra instancia.
- El `tokenGetter` se inyecta desde `AuthContext` vía `setApiTokenGetter` — no leas el token
  directamente de `SecureStore` dentro de un componente de pantalla; usa `useAuth()`.
- Un archivo por recurso bajo `api/` (`team.ts`, `clubEmblem.ts`, `sportEventTypes.ts`) que
  exporta funciones tipadas — mismo patrón que los `*Service.ts` de `Front/` pero sin la
  clase/objeto contenedor.

---

## 5. Autenticación

- `AuthContext` (`src/auth/AuthContext.tsx`) es la única fuente de verdad de `token`,
  `isAuthenticated`, `roles`, `login`, `logout`. No leas ni escribas `SecureStore`
  directamente desde una pantalla — pasa siempre por `useAuth()`.
- `login()` hace `POST /api/mobile/login`, guarda el token con `SecureStore.saveToken` y
  deriva `roles` con `getRolesFromToken` (`src/auth/roles.ts`).
- Los errores de login/logout deben capturarse y exponerse vía el estado `error` del
  contexto, nunca dejar una excepción sin capturar que rompa la UI.

---

## 6. Estilos y UI

- `StyleSheet.create()` co-ubicado en el mismo archivo del componente/pantalla — no hay CSS
  Modules en RN, pero sigue el mismo principio de una sola responsabilidad por archivo.
- Colores desde `src/theme/colors.ts` (`coachColors`) — no hardcodear hex nuevos sin mirar
  primero si ya existe un token equivalente.
- Textos de usuario en español, igual que el resto de la app (`'Error al cargar las
  estadísticas'`, `'No hay información disponible'`…).

---

## 7. Patrones prohibidos

| ❌ No hacer | ✅ Hacer en su lugar |
|---|---|
| Asumir APIs de Expo por conocimiento previo del modelo | Consultar `https://docs.expo.dev/versions/v57.0.0/` primero |
| Cambiar el `name` de una `Screen` al renombrar su label/icono visible | Cambiar solo `tabBarLabel`/`tabBarIcon`, mantener `name` |
| Leer/escribir `SecureStore` desde un componente de pantalla | Pasar siempre por `useAuth()` |
| Crear una segunda instancia de Axios | Extender `src/api/client.ts` |
| Hardcodear un color hex nuevo | Usar `coachColors` (`src/theme/colors.ts`) |
| Dejar un `catch` vacío o sin mensaje de error en español | Setear `error` con fallback legible en español |
