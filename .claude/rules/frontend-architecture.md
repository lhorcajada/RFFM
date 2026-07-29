# Reglas de Arquitectura — Frontend (FutbolBase)

Reglas que rigen cómo se organiza el código en `Front/` (SPA) y `Mobile/` (Expo/React Native),
y cómo interactúan entre sí y con el backend (`Back/ExtractionApi/`).

---

## 1 · Dos frontends, un backend

```
Front/                          # React 19 SPA — Federación + Coach (navegador)
Mobile/                         # Expo / React Native — Coach/Familia (app móvil)
Back/ExtractionApi/             # ASP.NET Core Minimal API (fuente única de datos)
```

- `Front/` y `Mobile/` **nunca** se importan entre sí. Cualquier lógica compartida de verdad
  (tipos de dominio, formato de fechas, reglas de negocio) se duplica de forma consciente o se
  documenta como divergencia — no se crea un paquete compartido sin que el usuario lo pida.
- Ambos consumen el mismo backend; los contratos de API (`GetXxx`, DTOs) son la interfaz común.
- Antes de crear algo nuevo en cualquiera de los dos, mirar el archivo hermano más cercano
  (mismo directorio o feature análoga en el otro sub-árbol) y seguir su patrón.

---

## 2 · `Front/` — Arquitectura Multi-App SPA

```
Front/
  src/
    apps/
      federation/      → App de Federación (tema claro/neón)
        components/
        pages/
        routes.tsx      → <Routes> anidadas, páginas lazy
        services/       → *Service.ts por dominio
        context/        → contexts propios de la app
        muiGameTheme.ts
      coach/            → App de Entrenador (tema oscuro/naranja)
        components/
        pages/
        routes.tsx
        services/
        context/
        hooks/
        muiCoachTheme.ts
    core/
      api/client.ts     → instancia Axios única
      router/           → AppRouter, RequireAuth
    shared/
      components/ui/    → componentes reutilizables entre ambas apps
      context/           → UserContext, etc.
      hooks/
      pages/auth/         → login/register/forgot-password/reset-password
      services/           → imageService, pdfService, excelService…
```

- Dos apps lógicas (`federation`, `coach`) comparten un único `BrowserRouter` y build de Vite.
- Cada app posee: `routes.tsx` (páginas lazy), tema MUI propio (`muiGameTheme.ts` /
  `muiCoachTheme.ts` vía `<ThemeProvider>` anidado), `services/`, `context/`.
- `src/shared/` es para lo genuinamente compartido entre ambas apps — no para "por si acaso".
- **No** hay barrel `index.ts` de re-exportación: importar siempre desde el archivo directo.
- Toda página de nivel superior se carga con `React.lazy()`.

---

## 3 · `Mobile/` — Arquitectura Expo / React Native

```
Mobile/
  src/
    api/               → client.ts (Axios), y un archivo por recurso (team.ts, clubEmblem.ts…)
    auth/              → AuthContext.tsx, secureStore.ts, roles.ts
    navigation/        → RootNavigator.tsx, *Tabs, AppHeaderTitle, UserAvatarMenu
    screens/           → una pantalla por archivo (PascalCase + Screen.tsx)
      components/      → componentes usados solo por screens (EventCard, EventFiltersModal…)
      hooks/            → hooks propios de screens (useEventFilters…)
    shared/
      components/       → Toast, etc. reutilizables fuera de screens/
      context/          → ToastContext…
    theme/              → colors.ts (coachColors)
    i18n/
    utils/
  __tests__/ (co-ubicados en cada carpeta, ver `frontend-testing.md`)
```

- Una sola app (rol Coach/Familia); no hay separación multi-app como en `Front/`.
- Navegación con `@react-navigation/native` + `bottom-tabs` + `native-stack`.
  `RootNavigator.tsx` es el punto de entrada; los grupos de pestañas (`CalendarTabs`) son
  componentes exportados desde el mismo archivo o uno adyacente en `navigation/`.
- El nombre interno de una ruta/pantalla (`name="PlayersTab"`) es distinto de su
  `tabBarLabel` visible — cambiar el label/icono no debe tocar el nombre de ruta ni los
  `params` que dependen de él.
- Iconografía con `@expo/vector-icons` (`Ionicons`); elegir el nombre de icono más literal
  para el concepto que representa la pestaña/pantalla.
- **Antes de escribir código que toque APIs de Expo**, leer `Mobile/AGENTS.md`: Expo ha
  cambiado de versión y hay que consultar la documentación versionada exacta
  (`https://docs.expo.dev/versions/v57.0.0/`) en vez de asumir comportamiento de versiones
  anteriores.

---

## 4 · Comunicación con la API

- **Un único cliente Axios por frontend**: `Front/src/core/api/client.ts` y
  `Mobile/src/api/client.ts`. No crear instancias adicionales — añadir headers/interceptores
  al cliente existente.
- `Front`: `baseURL` viene de `VITE_API_BASE_URL`; proxy de dev `/api` → `https://localhost:7287`.
- `Mobile`: `baseURL` viene de `Constants.expoConfig?.extra?.apiBaseUrl`.
- Interceptor de respuesta gestiona `401` (evento/redirect a login) de forma centralizada —
  nunca gestionar el `401` ad-hoc en un componente.
- Los servicios de dominio (`Front/src/apps/*/services/*Service.ts`,
  `Mobile/src/api/*.ts`) son la única capa que llama a `api.get/post/...`; los componentes no
  llaman a Axios directamente salvo en pantallas simples ya existentes que siguen ese patrón
  (p. ej. `PlayerSeasonCardsScreen.tsx`) — en ese caso, replicar el patrón existente, no
  introducir uno nuevo sin necesidad.

---

## 5 · Autenticación

| | Front (`Front/`) | Mobile (`Mobile/`) |
|---|---|---|
| Paso 1 | `useTempToken()` firma JWT HS256 de 5 min con `VITE_APP_FRONTEND_SECRET` | login directo a `POST /api/mobile/login` |
| Almacenamiento | `localStorage` (`coachAuthToken`, `coachUserId`, `coach_roles`) | `expo-secure-store` vía `src/auth/secureStore.ts` |
| Guard | `<RequireAuth>` (gracia de 3 s para hidratar roles) | `RootNavigator` condiciona el stack según `useAuth().isAuthenticated` |
| Roles | claims en el JWT | `getRolesFromToken(token)` (`src/auth/roles.ts`) |

- No dupliques lógica de auth fuera de `AuthContext`/`CoachAuthContext` — es la única fuente
  de verdad sobre `isAuthenticated`, `token` y `roles`.

---

## 6 · Mensajería cross-cutting

- **Front**: bus de eventos del navegador para mensajería entre apps —
  `window.dispatchEvent(new CustomEvent('rffm.auth_expired'))`,
  `rffm.show_snackbar`, `rffm.coach_token_updated`. No usar props ni un store global para esto.
- **Mobile**: `ToastContext` (`src/shared/context/ToastContext.tsx`) para notificaciones
  transitorias; no hay bus de eventos del navegador (no aplica en RN).

---

## 7 · Patrones prohibidos

| ❌ No hacer | ✅ Hacer en su lugar |
|---|---|
| Crear una segunda instancia de Axios | Extender el cliente único (`client.ts`) con interceptores |
| Importar código de `Front/` desde `Mobile/` o viceversa | Duplicar conscientemente o extraer solo si el usuario lo pide |
| Barrel `index.ts` de re-exportación en `Front/` | Importar desde el archivo directo |
| Cambiar el `name` de una ruta/pantalla en Mobile al renombrar su label visible | Cambiar solo `tabBarLabel` / `tabBarIcon`, mantener el `name` interno |
| Usar `any` en TypeScript | Tipar explícitamente; `unknown` + narrowing si el tipo es incierto |
| Mezclar el tema Federación y Coach en un mismo `ThemeProvider` | Un `ThemeProvider` anidado por app, nunca aplanar temas |
| Añadir lógica de negocio a un componente de pantalla/página | Extraerla a `services/`, hooks o al backend si corresponde |
