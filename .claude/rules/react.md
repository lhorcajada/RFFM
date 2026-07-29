# Reglas React — Front (SPA)

Reglas obligatorias para toda generación y modificación de código en `Front/`.
Complementan `.github/instructions/copilot-instructions.md` (fuente de la verdad) y
`.claude/agents/front-specialist.md`.

---

## 1. Stack

| Concern | Librería |
|---|---|
| Framework | React 19 |
| Lenguaje | TypeScript 5.5 — strict, target `ES2020` |
| Bundler | Vite 7 + `@vitejs/plugin-react` |
| Routing | `react-router-dom` v6 (`<Routes>` declarativas) |
| UI | MUI v5 (`@mui/material`) + Emotion |
| HTTP | Axios — instancia única en `src/core/api/client.ts` |
| Fechas | `date-fns` |
| Export PDF | `html2canvas` + `jspdf` |
| Tests unitarios | Vitest 4 + Testing Library |
| Tests E2E | Playwright |

---

## 2. TypeScript

- Strict mode no negociable. **Nunca** usar `any`; si el tipo es incierto, usar `unknown` y
  hacer narrowing.
- Tipar explícitamente props, retorno de hooks y respuestas de servicios (`type XxxResponse`
  co-ubicado en el `*Service.ts` correspondiente, como en `teamplayerService.ts`).
- Los tipos de respuesta de API son `type`, no `interface`, siguiendo el patrón existente en
  `services/`.

---

## 3. Componentes

### 3.1 Estructura de archivo
- Un componente por archivo, `PascalCase.tsx`, con su `PascalCase.module.css` co-ubicado.
- Páginas de nivel superior de cada app se cargan con `React.lazy()` desde `routes.tsx`.
- Sin barrel `index.ts` de re-exportación — importar siempre desde el archivo directo
  (excepción: los pocos `index.tsx` ya existentes como wrapper de un solo componente, que
  siguen su propio patrón — no generalizar la excepción a componentes nuevos).

### 3.2 Dónde vive un componente nuevo
- Específico de una página → junto a la página (`pages/<Page>/components/`).
- Reutilizable dentro de una sola app → `apps/<app>/components/`.
- Reutilizable entre Federación y Coach → `src/shared/components/ui/`.
- Antes de crear uno nuevo, comprobar si ya existe algo similar en `shared/components/ui/`.

### 3.3 Single responsibility
- Cada componente/página tiene una única responsabilidad. Si un componente crece y mezcla
  presentación con lógica de datos, extraer la lógica a un hook.

---

## 4. Estilos (estricto)

- **CSS Modules** para todo componente/página — nunca estilos globales fuera de
  `src/index.css`.
- `sx` prop de MUI para ajustes puntuales; CSS Modules para cualquier cosa reutilizable o
  compleja.
- **Prohibido**: `styled()` de Emotion y estilos inline (`style={{}}`) salvo que ya exista ese
  patrón exacto en el archivo que se está tocando.
- Variables de diseño (color, tipografía, espaciado) vienen del tema MUI de la app
  (`muiGameTheme.ts` / `muiCoachTheme.ts`) o de las CSS custom properties en `:root`
  (`--rffm-gradient-bg`, `--rffm-card-bg`…) — nunca hardcodear valores nuevos sin que el
  usuario los apruebe.
- Un `ThemeProvider` anidado por app; nunca aplanar los temas de Federación y Coach en uno solo.
- Si un estilo se comparte entre ambas apps, probarlo visualmente en ambos temas
  (claro/neón de Federación, oscuro/naranja de Coach) antes de darlo por bueno.

---

## 5. Estado y datos

### 5.1 Servicios
- Toda llamada a la API vive en un `*Service.ts` bajo `apps/<app>/services/` o
  `shared/services/` — nunca `axios`/`api.get` directamente dentro de un componente de UI,
  salvo que se esté extendiendo un archivo que ya sigue ese patrón.
- Un servicio agrupa las operaciones de un mismo recurso de dominio (`playerService.ts`,
  `clubService.ts`…) y exporta los tipos de request/response que consume.

### 5.2 Contextos
- `UserContext` (`src/shared/context/`) y `CoachAuthContext`
  (`src/apps/coach/context/`) son las fuentes de verdad de usuario/auth — no dupliques su
  estado en otro sitio.
- Contextos nuevos solo cuando el estado realmente cruza más de 2-3 componentes no
  relacionados por props; si no, `useState`/`props` local es suficiente.

### 5.3 Bus de eventos cross-app
- La comunicación entre Federación y Coach usa el bus de eventos del navegador, no props ni
  un store global:
  ```ts
  window.dispatchEvent(new CustomEvent('rffm.auth_expired'));
  window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message, severity } }));
  ```
- No introducir Redux/Zustand/Context global nuevo para reemplazar este bus sin acuerdo
  explícito del usuario.

### 5.4 Hooks personalizados
- Viven en `hooks/` junto a la app o en `src/shared/hooks/` si son realmente transversales.
- Un hook = una responsabilidad (`useTeamAndClub`, `usePermissions`…); no crear "hooks
  contenedor" que mezclen varias fuentes de datos sin relación.

---

## 6. API y Auth

- Única instancia Axios: `src/core/api/client.ts`. Añadir headers/interceptores ahí, nunca
  crear `axios.create()` adicional.
- El interceptor de respuesta ya gestiona `401` (evento `rffm.auth_expired`) y `500`
  (navegación a `/error-500`) — no dupliques ese manejo en el componente que hace la llamada.
- Flujo de login: `useTempToken()` → `POST /api/login` → JWT completo en `localStorage`
  (`coachAuthToken`, `coachUserId`, `coach_roles`) → rutas protegidas con `<RequireAuth>`.
- `dev=1` en la query string solo para bypass de auth en desarrollo local — nunca depender de
  él en código que llegue a producción.

---

## 7. Convenciones generales de código

- Seguir siempre el patrón del archivo hermano más cercano antes de inventar uno nuevo.
- Al mover/renombrar archivos, actualizar todos los imports afectados.
- No añadir comentarios que expliquen qué hace el código (los nombres ya lo dicen); solo
  comentar el porqué cuando no sea obvio.
- No introducir librerías de estilos, fetching o estado nuevas sin justificación y sin que el
  usuario lo apruebe explícitamente — mantener el stack existente.
- Responsive por defecto: usar las herramientas responsive de MUI (`Grid`, `useMediaQuery`,
  breakpoints del tema) en vez de media queries manuales en CSS Modules salvo que ya sea el
  patrón del archivo.

---

## 8. Build y verificación

```bash
cd Front
npm run dev          # servidor de desarrollo Vite
npm run build        # build de producción — debe pasar siempre
npm run test         # Vitest (ver frontend-testing.md)
npx playwright test  # E2E
```

- Tras cualquier cambio, ejecutar `npm run build` y `npm run test` antes de dar el trabajo por
  terminado. Un cambio que rompe el build o los tipos strict no está completo.

---

## 9. Patrones prohibidos

| ❌ No hacer | ✅ Hacer en su lugar |
|---|---|
| `any` en TypeScript | Tipo explícito o `unknown` + narrowing |
| `styled()` de Emotion / `style={{}}` inline | CSS Modules + tema MUI |
| Crear una segunda instancia de Axios | Extender `src/core/api/client.ts` |
| Llamar a `axios`/`api` directamente desde un componente nuevo | Crear/extender un `*Service.ts` |
| Barrel `index.ts` de re-exportación | Import directo al archivo |
| Aplanar los temas de Federación y Coach | `ThemeProvider` anidado por app |
| Store global nuevo para mensajería cross-app | Bus de eventos `window.dispatchEvent` existente |
| Hardcodear colores/espaciados nuevos | Tema MUI o CSS custom properties de `:root` |
