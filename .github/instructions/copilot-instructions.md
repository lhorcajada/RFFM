# RFFM — Copilot Instructions

Monorepo with a React SPA (`Front/`) and an ASP.NET Core Minimal API (`Back/ExtractionApi/`).
Deploy target: **Netlify** (front) + **Azure App Service** (back).

---

## Repository Layout

```
Front/                   # React SPA
  src/
    apps/
      federation/        # Federation management app (light/neon theme)
      coach/             # Coach management app (dark/orange theme)
    core/
      api/client.ts      # Axios singleton
      router/            # AppRouter + RequireAuth
    shared/              # Cross-app components, contexts, hooks, pages, services
  vite.config.ts
  package.json

Back/ExtractionApi/
  src/
    RFFM.Api/            # Main ASP.NET Core project
      App.cs             # Application bootstrap
      Features/          # Vertical-slice feature files
      FeatureModules/    # IFeatureModule registrations
      Domain/            # Entities, value objects, domain events
      Infrastructure/    # EF Core contexts, configurations, services
      DependencyInjection/
      Common/
    RFFM.Host/           # Entry point / hosting project
```

---

## Frontend

### Stack
| Concern | Library |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.5 — strict mode, `ES2020` target |
| Bundler | Vite 7 + `@vitejs/plugin-react` |
| Routing | `react-router-dom` v6 (declarative `<Routes>`) |
| UI Components | MUI v5 (`@mui/material`) + Emotion |
| HTTP Client | Axios (`src/core/api/client.ts`) |
| Auth token signing | `jose` — HS256 temp-token generation |
| Date utilities | `date-fns` |
| PDF export | `html2canvas` + `jspdf` |
| Unit tests | Vitest 4 + Testing Library (React/DOM/user-event) |
| E2E tests | Playwright |

### Architecture — Multi-App SPA

Two logically separate applications share one Vite build and one `BrowserRouter`:

```
AppRouter.tsx
├── /login, /register, /forgot-password, /reset-password  → src/shared/pages/auth/
├── /                                                      → AppSelector (app picker)
├── /federation/*  (React.lazy)                           → src/apps/federation/routes.tsx
└── /coach/*       (React.lazy)                           → src/apps/coach/routes.tsx
```

Each app owns:
- `routes.tsx` — nested `<Routes>` with lazy-loaded pages
- `muiGameTheme.ts` / `muiCoachTheme.ts` — per-app MUI theme applied via a nested `<ThemeProvider>`
- `services/` — domain API service files (`clubService.ts`, `playerService.ts`, …)
- `context/` — app-specific React contexts

### Styling Rules
- **CSS Modules** for every component/page: co-locate `ComponentName.module.css` alongside `ComponentName.tsx`.
- **No global styles** except `src/index.css`.
- CSS custom properties (`--rffm-gradient-bg`, `--rffm-card-bg`, …) are defined at `:root` and swapped on Coach app mount/unmount via `useLayoutEffect`.
- MUI theme override is added per app via a nested `<ThemeProvider>`; never flatten themes.
- Use MUI's `sx` prop for one-off styles, but prefer CSS Modules for anything more complex or reusable.
- Avoid inline styles and emotion's `styled()` API to prevent style duplication and maintain separation of concerns.
- Use MUI components where possible, but wrap them in custom components in `src/shared/components/` if you need to apply consistent styling or behavior across the app.
- For truly custom UI, create new components with their own CSS Modules.
- Follow existing patterns and conventions for file/folder structure, naming, and styling.
- When in doubt, check the nearest sibling file before creating something new.
- Always prioritize consistency and maintainability over cleverness or novelty in styling decisions.
- Avoid introducing new styling approaches or libraries without a compelling reason and team consensus.
- When modifying existing styles, ensure that you understand the original intent and test across both apps to prevent unintended side effects.
- For shared styles that are used across both apps, consider defining CSS custom properties at the `:root` level and using them in your CSS Modules to maintain a single source of truth for colors, spacing, and other design tokens.
- When working on the Coach app, be mindful of the dark/orange theme and ensure that any new styles or components fit cohesively within that aesthetic.
- When working on the Federation app, ensure that new styles or components align with the light/neon theme and maintain a consistent look and feel.
- Always test your styles in both apps if they are shared to ensure that they work well in both themes and do not introduce any visual inconsistencies or accessibility issues.
- Use MUI's theming capabilities to manage colors, typography, and spacing consistently across the app, and avoid hardcoding values in your CSS Modules or inline styles.
- When creating new components, consider whether they should be shared across both apps or if they are specific to one app, and place them accordingly in `src/shared/components/` or within the respective app's folder structure.
- The app must be responsive and work well across a range of devices and screen sizes. Use MUI’s responsive design tools and CSS to ensure an optimal user experience across all platforms.
- Adhere to the principle of single responsibility in your pages, components and styles. Each component and page should have a single responsibility, and each CSS module should be associated with a single component to facilitate code maintenance and scalability.
### API Communication
- All requests go through the single Axios instance in `src/core/api/client.ts`.
- `baseURL` comes from `VITE_API_BASE_URL` env var; Vite dev proxy maps `/api` → `https://localhost:7287`.
- The response interceptor handles:
  - `401` → dispatches `rffm.auth_expired` custom event
  - `500` → navigates to `/error-500`
- Do **not** create new Axios instances; add headers / interceptors to the shared client.

### Authentication Flow (Frontend)
1. On login, call `useTempToken()` to sign a 5-min HS256 JWT using the shared `VITE_APP_FRONTEND_SECRET`.
2. Send the temp-token to `POST /api/login`.
3. Store the returned full JWT in `localStorage` (`coachAuthToken`, `coachUserId`, `coach_roles`).
4. Protect routes with `<RequireAuth>`, which allows a 3-second grace window for role hydration.
5. Use `dev=1` query param **only in local development** to bypass auth.

### Custom Event Bus
Inter-component messaging across app boundaries is done via the browser event bus — **not** props or a global store:

```ts
window.dispatchEvent(new CustomEvent('rffm.auth_expired'));
window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message, severity } }));
window.dispatchEvent(new CustomEvent('rffm.coach_token_updated', { detail: token }));
```

### Contexts
| Context | Location | Holds |
|---|---|---|
| `UserContext` | `src/shared/context/` | `User { id, username, email, avatar }` — persisted to `localStorage` |
| `CoachAuthContext` | `src/apps/coach/context/` | Login/logout logic, listens to auth events |

### Conventions
- Lazy-load all top-level pages with `React.lazy()`.
- No barrel `index.ts` re-exports; import from the direct file path.
- Custom hooks live in `hooks/` alongside the app or in `src/shared/hooks/`.
- Shared, reusable UI components go in `src/shared/components/`.

---

## Backend

### Stack
| Concern | Library |
|---|---|
| Runtime | .NET 9 (`net9.0`) |
| API style | ASP.NET Core **Minimal API** — no MVC controllers |
| Mediator / CQRS | `Mediator` v3 + `Mediator.SourceGenerator` (source-generated, zero reflection at runtime) |
| Validation | `FluentValidation` v12 |
| Caching | `EasyCaching.InMemory` |
| Error responses | `Hellang.Middleware.ProblemDetails` (RFC 7807) |
| Identity | `Microsoft.AspNetCore.Identity.EntityFrameworkCore` |
| Auth | `Microsoft.AspNetCore.Authentication.JwtBearer` v9 + `jose-jwt` v5 |
| ORM | EF Core 9 + `Npgsql.EntityFrameworkCore.PostgreSQL` v9 |
| Domain enums | `Ardalis.SmartEnum` + `SmartEnum.EFCore` |
| Password hashing | `BCrypt.Net-Next` |
| Email | `MailKit` |
| Storage | `Supabase` (togglable) |
| HTML parsing | `HtmlAgilityPack` |
| PDF generation | `DinkToPdf` (wkhtmltopdf wrapper) |
| Logging | `Serilog` (console + Seq) |
| Testing | xUnit + `Moq` |
| API documentation | XML comments + Swagger (Swashbuckle) |
| User secrets | `Microsoft.Extensions.Configuration.UserSecrets` |

### Architecture — Vertical Slice + Feature Modules

Each feature is a **single `.cs` file** with the full vertical slice:

```csharp
// Features/Clubs/CreateClub.cs
public class CreateClub : IFeatureModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/clubs", async (CreateClubRequest req, IMediator mediator) =>
        {
            var result = await mediator.Send(new CreateClubCommand(req));
            return Results.Created($"/api/clubs/{result.Id}", result);
        }).RequireAuthorization();
    }

    public record CreateClubRequest(string Name, string ShortName);

    public record CreateClubCommand(CreateClubRequest Request) : ICommand<ClubDto>;

    public class Handler : IRequestHandler<CreateClubCommand, ClubDto>
    {
        // implementation
    }

    public class Validator : AbstractValidator<CreateClubCommand>
    {
        // FluentValidation rules
    }
}
```

`AddFeatureModules.MapFeatures()` scans the assembly via reflection at startup and calls `AddRoutes` on every `IFeatureModule` — no manual registration needed.

### CQRS Interfaces

```csharp
// Use for write operations
ICommand          // → IRequest (no return value)
ICommand<T>       // → IRequest<T>

// Use for read operations
IQueryApp<T>      // → IRequest<T>
```

### Pipeline Behaviors (execution order)
1. `LoggingBehavior` — logs request/response type names
2. `TimeLogBehavior` — measures duration
3. `ValidationBehavior` — runs all `IValidator<TRequest>` from DI; throws `ValidationException` on failure
4. `CachingBehavior` — caches `IQueryApp` responses that implement `ICacheRequest` (default 1 h, EasyCaching in-memory)
5. `InvalidateCachingBehavior` — removes cache entries by prefix for `ICommand` implementations of `IInvalidateCacheRequest`

### Domain Layer
- `BaseEntity` — provides `string Id = Guid.NewGuid()` and a domain events list (`INotification`).
- `IAggregateRoot` — marker interface; only aggregate roots are queried directly.
- Use `Ardalis.SmartEnum` for domain enumerated types (never raw `int` enums).
- Rich domain model: validate invariants inside entity methods, not in handlers.
- Localized validation messages via `ValidationMessages.resx`.

### Database
Three separate EF Core `DbContext` instances, all PostgreSQL:

| Context | Connection String Key | Schema | Purpose |
|---|---|---|---|
| `IdentityDbContext` | `IdentityConnection` | `identity` | ASP.NET Core Identity |
| `AppDbContext` | `CatalogConnection` | `app` | Core app data |
| `FederationDbContext` | `FederationConnection` | `federation` | Federation settings |

- EF entity type configurations are discovered via reflection (`IEntityTypeConfiguration<T>` scanning) — do not register them manually.
- Configure Npgsql with 5 retries and a 60 s command timeout.
- Startup throws if `CatalogConnection` is missing.

### Authentication Flow (Backend)
1. Receive `POST /api/login` with a HS256 temp-token.
2. Validate temp-token with `jose-jwt` using the shared `FrontendSecret`.
3. Authenticate user via ASP.NET Core Identity + `BCrypt` password check.
4. Issue a full JWT Bearer token signed with `Jwt:Key` (`System.IdentityModel.Tokens.Jwt`).
5. Use `RequireAuthorization()` + role claims on Minimal API endpoints.

### Storage
- Toggle between Supabase Storage (`Storage:UseLocal: false`) and local filesystem (`Storage:UseLocal: true`) in `appsettings.{env}.json`.

### Conventions
- One feature = one file. Never split a handler from its endpoint.
- No controllers; every HTTP endpoint is registered through `IFeatureModule`.
- `Nullable` and `ImplicitUsings` are enabled project-wide.
- Return RFC 7807 `ProblemDetails` for all errors (do not return raw strings).
- Env-specific config via `appsettings.Development.json` / `appsettings.Production.json`.

---

## Development Commands

### Frontend
```bash
cd Front
npm install
npm run dev          # Vite dev server (proxy → https://localhost:7287)
npm run build        # Production build → dist/
npm run test         # Vitest unit tests
npx playwright test  # E2E tests
```

### Backend
```bash
cd Back/ExtractionApi
dotnet restore
dotnet build
dotnet run --project src/RFFM.Host
```

### Migrations
```powershell
# From Back/ExtractionApi
.\manage-migrations.ps1
```

---

## Environment Variables

### Frontend (`.env.local`)
```
VITE_API_BASE_URL=https://localhost:7287
VITE_APP_FRONTEND_SECRET=<shared-secret>
VITE_API_RETRIES=3
VITE_API_TIMEOUT=30000
```

### Backend (`appsettings.Development.json`)
```json
{
  "ConnectionStrings": {
    "IdentityConnection": "...",
    "CatalogConnection": "...",
    "FederationConnection": "..."
  },
  "Jwt": { "Key": "...", "Issuer": "rffm" },
  "FrontendSecret": "<shared-secret>",
  "Storage": { "UseLocal": true }
}
```

---

## Code Quality
- TypeScript strict mode is non-negotiable; avoid `any`.
- FluentValidation validators are required for every `ICommand` that accepts user input.
- All new React components must have a co-located `.module.css` file.
- Follow existing file/folder conventions — check the nearest sibling file before creating a new one.
