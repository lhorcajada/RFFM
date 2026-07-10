# FutbolBase — Main Specification

Global architecture, stacks, conventions, and patterns for all OpenSpec changes.

---

## 1. Project Overview

**FutbolBase** is a football management platform built as a monorepo:
- **Frontend**: React 19 SPA (`Front/`)
- **Backend**: ASP.NET Core Minimal API (`Back/ExtractionApi/`)
- **Deployment**: Netlify (frontend) + Azure App Service (backend)

This specification defines how all changes should be designed and implemented to maintain consistency, quality, and traceability.

---

## 2. Frontend Stack & Architecture

### Technology
| Concern | Library |
|---------|---------|
| Framework | React 19 |
| Language | TypeScript 5.5 — strict mode (`ES2020` target, `any` forbidden) |
| Bundler | Vite 7 + `@vitejs/plugin-react` |
| Routing | react-router-dom v6 (declarative `<Routes>`) |
| UI Components | MUI v5 + Emotion |
| HTTP Client | Axios (single instance at `src/core/api/client.ts`) |
| Auth Tokens | `jose` (HS256 temp-token signing) |
| Date utilities | date-fns |
| Testing | Vitest 4 + Testing Library + Playwright |

### Multi-App SPA Architecture
Two apps share one Vite build and one BrowserRouter:

```
AppRouter.tsx
├── /login, /register, /forgot-password, /reset-password  → src/shared/pages/auth/
├── /                                                      → AppSelector
├── /federation/* (React.lazy)                           → src/apps/federation/routes.tsx
└── /coach/*     (React.lazy)                           → src/apps/coach/routes.tsx
```

Each app owns:
- `routes.tsx` — lazy-loaded pages with nested Routes
- `muiGameTheme.ts` / `muiCoachTheme.ts` — per-app MUI theme via nested ThemeProvider
- `services/` — domain API service files
- `context/` — app-specific React contexts

**Theme Strategy**: Federation = light/neon theme; Coach = dark/orange theme. CSS custom properties swap on app mount/unmount via useLayoutEffect.

### Styling Rules (Strict)
- **CSS Modules** for every component/page: co-locate `ComponentName.module.css` alongside `ComponentName.tsx`
- No global styles except `src/index.css`
- CSS custom properties (--rffm-gradient-bg, --rffm-card-bg, ...) at :root
- MUI theme override per app via nested ThemeProvider — never flatten
- Use `sx` prop for one-offs; CSS Modules for reuse
- Avoid inline styles and emotion's `styled()`
- Wrap MUI components in custom components when consistent styling is needed
- Test shared styles in **both** apps (Federation + Coach)

### API Communication
- All requests through single Axios instance in `src/core/api/client.ts`
- baseURL from `VITE_API_BASE_URL` env var; dev proxy maps `/api` to `https://localhost:7287`
- Response interceptor: `401` → dispatches `rffm.auth_expired`; `500` → navigates to `/error-500`
- **Do not** create new Axios instances

### Authentication Flow (Frontend)
1. On login, `useTempToken()` signs a 5-min HS256 JWT using `VITE_APP_FRONTEND_SECRET`
2. Send temp-token to `POST /api/login`
3. Store returned full JWT in `localStorage` (keys: `coachAuthToken`, `coachUserId`, `coach_roles`)
4. Protect routes with `<RequireAuth>` (3-second grace window for role hydration)
5. `dev=1` query param bypasses auth **only in local development**

### Custom Event Bus
Inter-component messaging via browser event bus (not props or global store):

```ts
window.dispatchEvent(new CustomEvent('rffm.auth_expired'));
window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message, severity } }));
window.dispatchEvent(new CustomEvent('rffm.coach_token_updated', { detail: token }));
```

### Contexts
| Context | Location | Holds |
|---------|----------|-------|
| UserContext | src/shared/context/ | User (id, username, email, avatar) — persisted to localStorage |
| CoachAuthContext | src/apps/coach/context/ | Login/logout logic, auth events listener |

### Frontend Conventions
- Lazy-load all top-level pages with `React.lazy()`
- **No barrel index.ts re-exports** — import from direct file path
- Custom hooks in `hooks/` alongside the app or in `src/shared/hooks/`
- Shared UI components in `src/shared/components/`
- Every React component gets co-located `.module.css`
- Update import paths when moving files

---

## 3. Backend Stack & Architecture

### Technology
| Concern | Library |
|---------|---------|
| Runtime | .NET 9 (`net9.0`) |
| API Style | ASP.NET Core **Minimal API** (no MVC controllers) |
| CQRS/Mediator | `Mediator` v3 + `Mediator.SourceGenerator` (source-generated, zero reflection) |
| Validation | `FluentValidation` v12 — **required** per ICommand |
| Caching | `EasyCaching.InMemory` (1h default) |
| Error Responses | `Hellang.Middleware.ProblemDetails` (RFC 7807) |
| Identity | `Microsoft.AspNetCore.Identity.EntityFrameworkCore` |
| Auth | `Microsoft.AspNetCore.Authentication.JwtBearer` v9 + `jose-jwt` v5 |
| ORM | EF Core 9 + `Npgsql.EntityFrameworkCore.PostgreSQL` v9 |
| Domain Enums | `Ardalis.SmartEnum` + `SmartEnum.EFCore` (no raw int enums) |
| Passwords | `BCrypt.Net-Next` |
| Email | `MailKit` |
| Storage | Supabase (togglable via `Storage:UseLocal` in appsettings) |

### Architecture — Vertical Slice + Feature Modules

Each feature is a **single `.cs` file** with the full vertical slice:

```csharp
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

**No manual registration**: `AddFeatureModules.MapFeatures()` scans the assembly and calls `AddRoutes` on every `IFeatureModule` automatically.

### CQRS Interfaces
- `ICommand` / `ICommand<T>` — write operations
- `IQueryApp<T>` — read operations

### Pipeline Behaviors (execution order)
1. `LoggingBehavior` — logs request/response types
2. `TimeLogBehavior` — measures duration
3. `ValidationBehavior` — runs validators from DI; throws on failure
4. `CachingBehavior` — caches `IQueryApp` responses implementing `ICacheRequest` (default 1h)
5. `InvalidateCachingBehavior` — clears cache by prefix for `ICommand` implementing `IInvalidateCacheRequest`

### Database Layer

Three separate EF Core `DbContext` instances, all PostgreSQL:

| Context | Connection Key | Schema | Purpose |
|---------|------------------|--------|---------|
| IdentityDbContext | IdentityConnection | identity | ASP.NET Core Identity |
| AppDbContext | CatalogConnection | app | Core app data |
| FederationDbContext | FederationConnection | federation | Federation settings |

**Startup throws** if `CatalogConnection` is missing.

Entity type configurations are discovered via reflection (`IEntityTypeConfiguration<T>`) — do not register manually. Configure Npgsql with 5 retries and 60s command timeout.

### Domain Layer
- `BaseEntity` — provides `string Id = Guid.NewGuid()` and domain events list
- `IAggregateRoot` — marker interface; only aggregate roots are queried directly
- Use `Ardalis.SmartEnum` for enumerated types (never raw `int` enums)
- Rich domain model: validate invariants inside entity methods, not in handlers
- Localized validation messages via `ValidationMessages.resx`

### Authentication Flow (Backend)
1. Receive `POST /api/login` with HS256 temp-token
2. Validate temp-token with `jose-jwt` using `FrontendSecret`
3. Authenticate user via ASP.NET Core Identity + BCrypt password check
4. Issue full JWT Bearer token signed with `Jwt:Key`
5. Use `RequireAuthorization()` + role claims on Minimal API endpoints

### Backend Conventions
- **One feature = one file**. Never split handler from endpoint.
- No controllers; all endpoints registered via `IFeatureModule`
- `Nullable` and `ImplicitUsings` enabled project-wide
- Return RFC 7807 `ProblemDetails` for **all** errors — never raw strings
- Env-specific config: `appsettings.Development.json` / `appsettings.Production.json`
- Mirror the nearest sibling feature file for patterns

---

## 4. OpenSpec Change Workflow

### Phase 1: Propose
- **Artifact**: `proposal.md`
- **Goal**: Describe what to build
- **Content**: Rationale, scope (in/out), key decisions
- **Length**: 200-300 words, specific and focused
- **Ownership**: Reference backend or frontend (Back/ExtractionApi or Front)

### Phase 2: Design
- **Artifact**: `design.md`
- **Goal**: How to build it
- **Content**:
  - Architectural decisions (vertical slice, CQRS, MUI themes, auth flows)
  - New files and modifications
  - Code snippets showing patterns
  - References to backend/frontend conventions in copilot-instructions.md

### Phase 3: Tasks
- **Artifact**: `tasks.md`
- **Goal**: Actionable work breakdown
- **Content**:
  - Break into 2-hour chunks
  - Specific file paths
  - Verification commands (dotnet build, npm run build, etc.)
  - Checkboxes for progress tracking

### Phase 4: Implement
- **Artifact**: `implement.md`
- **Goal**: Step-by-step technical script for openspec-implementer agent
- **Content**:
  - Exact file paths and code patterns
  - Migration steps if needed
  - Verification commands with expected output
  - Conventions reference (Backend/Frontend sections in copilot-instructions.md)

### Phase 5: Verify
- **Goal**: Ensure completeness, correctness, coherence
- **Checklist**:
  - All tasks in tasks.md marked complete
  - Verification commands pass (dotnet build, npm run build, tests)
  - Conventions followed (vertical slice, CQRS, MUI, CSS Modules, auth, etc.)
  - Code patterns match nearest siblings

### Phase 6: Archive
- Move completed change to `archive/YYYY-MM-DD-<name>/`
- Keep all artifacts for future reference

---

## 5. Authority References

All changes must align with:

1. **`.github/instructions/copilot-instructions.md`** — Source of truth for backend/frontend conventions
2. **`.claude/agents/back-specialist.md`** — Backend patterns, IFeatureModule, validators, DbContexts
3. **`.claude/agents/front-specialist.md`** — Frontend patterns, MUI themes, CSS Modules, auth flow, event bus
4. **Nearest sibling files** — Always mirror existing code in the same directory before creating new patterns

---

## 6. Code Quality Standards

### TypeScript (Frontend)
- Strict mode is non-negotiable; `any` is forbidden
- All new React components must have co-located `.module.css`
- Follow existing folder/file conventions exactly

### C# (Backend)
- FluentValidation validators required for every `ICommand` accepting user input
- Follow vertical slice pattern: 1 feature = 1 `.cs` file
- Return `ProblemDetails` for all errors
- No controllers

### Both
- Scope changes to task at hand; keep diffs minimal
- Check nearest sibling before creating new patterns
- No half-finished implementations
- Prioritize clarity over cleverness

---

## 7. Environment & Secrets

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

**Never commit secrets** — use user secrets or environment variables.

---

## 8. Development Commands

### Frontend
```bash
cd Front
npm install
npm run dev          # Vite dev server
npm run build        # Production build
npm run test         # Vitest unit tests
npx playwright test  # E2E tests
```

### Backend
```bash
cd Back/ExtractionApi
dotnet restore
dotnet build
dotnet run --project src/RFFM.Host
.\manage-migrations.ps1  # Manage EF migrations
```

---

## Last Updated
July 10, 2026
