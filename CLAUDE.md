# FutbolBase — Claude Code Quick Reference

Monorepo: React 19 SPA + ASP.NET Core Minimal API for football management.

---

## Project Structure

```
Front/                          # React SPA (Vite 7, TypeScript strict, MUI v5)
  src/
    apps/
      federation/               # Federation management (light/neon theme)
      coach/                    # Coach management (dark/orange theme)
    shared/                     # Cross-app components, contexts, hooks, pages
    core/api/client.ts          # Axios singleton

Back/ExtractionApi/             # ASP.NET Core 9 Minimal API
  src/
    RFFM.Api/
      Features/                 # Vertical slice features (1 feature = 1 .cs file)
      Domain/                   # Entities, domain events, value objects
      Infrastructure/           # EF Core contexts, configurations
    RFFM.Host/                  # Entry point

openspec/                       # OpenSpec change management
  changes/                      # Active changes
  specs/spec.md                 # Global specification
  config.yaml                   # OpenSpec configuration

.github/instructions/
  copilot-instructions.md       # SOURCE OF TRUTH for backend/frontend conventions
```

---

## Tech Stack (Minimal)

| Layer | Stack |
|-------|-------|
| **Frontend** | React 19, TypeScript 5.5 strict, Vite 7, MUI v5, Axios, CSS Modules |
| **Backend** | .NET 9, ASP.NET Core Minimal API, Mediator v3, EF Core 9, PostgreSQL |
| **Auth** | HS256 temp-token (frontend) → full JWT Bearer (backend) |
| **Caching** | EasyCaching.InMemory (1h default) |
| **Validation** | FluentValidation v12 (required per ICommand) |
| **Error Handling** | RFC 7807 ProblemDetails |
| **Patterns** | Vertical Slice (backend), CQRS (ICommand/IQueryApp), CSS Modules (frontend) |

---

## Frontend — Key Patterns

### Multi-App SPA
- Two apps (Federation + Coach) share one `BrowserRouter`
- Each app: lazy-loaded pages + per-app MUI theme (nested `ThemeProvider`)
- Event bus for cross-app messaging: `window.dispatchEvent(new CustomEvent('rffm.auth_expired'))`

### Styling (Strict)
- **CSS Modules** only: co-locate `ComponentName.module.css` alongside `ComponentName.tsx`
- No global styles except `src/index.css`
- MUI theme per app (never flatten), CSS custom properties at `:root`
- `sx` prop for one-offs; CSS Modules for reuse

### API & Auth
- Single Axios instance at `src/core/api/client.ts` (dev proxy: `/api` → `https://localhost:7287`)
- Auth flow: `useTempToken()` (HS256) → `POST /api/login` → store JWT in `localStorage` → `<RequireAuth>`
- `dev=1` query param bypasses auth in local dev only

### Build & Test
```bash
npm run dev          # Vite dev server
npm run build        # Verify build
npm run test         # Vitest + Testing Library
npx playwright test  # E2E tests
```

---

## Backend — Key Patterns

### Vertical Slice Feature
One feature = one `.cs` file holding endpoint + request + command/query + handler + validator + DTO.

```csharp
public class CreateClub : IFeatureModule
{
    public void AddRoutes(IEndpointRouteBuilder app) { ... }
    public record CreateClubRequest(string Name);
    public record CreateClubCommand(CreateClubRequest Request) : ICommand<ClubDto>;
    public class Handler : IRequestHandler<CreateClubCommand, ClubDto> { ... }
    public class Validator : AbstractValidator<CreateClubCommand> { ... }
}
```

**Auto-registered**: `AddFeatureModules.MapFeatures()` scans and calls `AddRoutes` on every `IFeatureModule`.

### CQRS
- `ICommand` / `ICommand<T>` → writes
- `IQueryApp<T>` → reads

### Pipeline Behaviors (in order)
1. Logging → Timing → **Validation** (FluentValidation) → **Caching** (1h default) → **Cache Invalidation**

### Database (3 DbContexts)
- `IdentityDbContext` (schema `identity`) — ASP.NET Core Identity
- `AppDbContext` (schema `app`) — Core app data
- `FederationDbContext` (schema `federation`) — Federation settings

EF configs discovered via reflection (`IEntityTypeConfiguration<T>`), not manual registration.

### Auth
1. Receive `POST /api/login` with HS256 temp-token
2. Validate with `jose-jwt` using `FrontendSecret`
3. Authenticate via ASP.NET Core Identity + BCrypt
4. Issue full JWT Bearer signed with `Jwt:Key`
5. Protect endpoints with `RequireAuthorization()` + role claims

### Error Handling
Return RFC 7807 `ProblemDetails` for **all** errors — never raw strings.

### Build & Test
```bash
dotnet build
dotnet run --project src/RFFM.Host
.\manage-migrations.ps1  # EF migrations
dotnet test              # xUnit + Moq
```

---

## OpenSpec Workflow

For non-trivial changes (backend features, frontend components, cross-stack work):

1. **Propose** (`proposal.md`) — What to build (rationale, scope)
2. **Design** (`design.md`) — How to build it (architecture, files, patterns)
3. **Tasks** (`tasks.md`) — Work breakdown (2-hour chunks, verification)
4. **Implement** (`implement.md`) — Script for `openspec-implementer` agent
5. **Verify** — Completeness, correctness, conventions
6. **Archive** — Move to `archive/YYYY-MM-DD-<name>/`

**Authority**: `.github/instructions/copilot-instructions.md` + `.claude/agents/*.md`

---

## Test-Driven Development (TDD) — Mandatory Methodology

**All implementations follow strict TDD: Red → Green → Refactor**

### Frontend TDD (React + Vitest + Testing Library)

**Red Phase**: Write tests first using Testing Library (user-centric assertions)
```typescript
// MyComponent.test.tsx — write first
describe('MyComponent', () => {
  it('renders button with correct text', () => {
    render(<MyComponent />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });
});
```

**Green Phase**: Write minimal implementation to pass
```typescript
// MyComponent.tsx — write after test
export const MyComponent = () => <button>Submit</button>;
```

**Refactor**: Clean up, extract logic, apply patterns (maintain green)

**Command**: `npm run test` (watch mode) — run before commit

### Backend TDD (xUnit + Moq)

**Red Phase**: Write tests first using Arrange-Act-Assert
```csharp
// CreateClubHandler.Tests.cs — write first
[Fact]
public async Task Handle_WithValidRequest_CreatesClub()
{
    // Arrange
    var handler = new CreateClubHandler(_mockRepo.Object, _mockCache.Object);
    var cmd = new CreateClubCommand(new CreateClubRequest("FC Barcelona"));
    
    // Act
    var result = await handler.Handle(cmd, CancellationToken.None);
    
    // Assert
    Assert.NotNull(result);
    Assert.Equal("FC Barcelona", result.Name);
}
```

**Green Phase**: Implement handler to pass (minimal, no over-engineering)
**Refactor**: Extract, optimize, apply DDD patterns (maintain green)

**Commands**:
```bash
dotnet test                              # Run all tests
dotnet test --filter Category=Feature    # Run feature tests only
dotnet test --no-build -v minimal        # Fast re-run (no rebuild)
```

### TDD Workflow for Features

1. **Create test file** in `*.Tests.cs` (adjacent to implementation)
2. **Write failing test** (Red) — assert behavior, not implementation
3. **Write minimal code** (Green) — just enough to pass
4. **Refactor** (Refactor) — clean code, move to proper layers
5. **Verify coverage** — aim for >80% on new code
6. **Commit with tests** — never commit code without passing tests

### Coverage Targets

| Layer | Coverage |
|-------|----------|
| **Domain/Business Logic** | >85% |
| **Handlers/Commands** | >80% |
| **Components** | >75% (UI testing is harder) |
| **Infrastructure** | >60% (mocked dependencies) |
| **API Contracts** (E2E) | >70% |

### Test Discipline

- ✅ **Unit tests** — Fast, isolated, test one concern
- ✅ **Integration tests** — Hit real DB (use test containers), real cache
- ✅ **E2E tests** — Playwright tests for critical user journeys
- ❌ **No skipped tests** — `[Fact(Skip = "...")]` is a code smell
- ❌ **No mocking the impossible** — If it's hard to test, refactor

### Before Commit Checklist

- [ ] All tests **pass locally** (`npm run test` or `dotnet test`)
- [ ] No skipped/xfailed tests
- [ ] New code has **corresponding tests**
- [ ] Tests are **focused** (one assertion per `it` / `[Fact]` where possible)
- [ ] Coverage **meets target** for modified code
- [ ] Integration tests use **real dependencies** (DB, cache)

---

## Agents

| Agent | Scope | Use When |
|-------|-------|----------|
| **back-specialist** | `Back/ExtractionApi/` | Backend features, debugging, refactoring (ASP.NET, Mediator, EF, validation) |
| **front-specialist** | `Front/` | Frontend features, debugging, refactoring (React, MUI, CSS Modules, auth) |
| **openspec-implementer** | N/A | (Subagent) Executes `implement.md` scripts precisely |

---

## Quick Checks Before Commit

### Frontend (TDD First)
- [ ] **Tests written first** (Red → Green → Refactor)
- [ ] `npm run test` passes — 100% pass rate
- [ ] Test coverage ≥75% for modified code
- [ ] TypeScript strict — no `any`
- [ ] CSS Modules co-located with components
- [ ] MUI theme per app (Federation or Coach)
- [ ] Single Axios instance used
- [ ] `npm run build` passes

### Backend (TDD First)
- [ ] **Tests written first** (Red → Green → Refactor)
- [ ] `dotnet test` passes — 100% pass rate
- [ ] Test coverage ≥80% for handlers/commands, ≥85% for domain logic
- [ ] Vertical slice: 1 feature = 1 `.cs` file
- [ ] Validator present for every `ICommand` (FluentValidation)
- [ ] All errors return `ProblemDetails`
- [ ] DbContext used correctly (Identity/App/Federation)
- [ ] `dotnet build` passes

### Both (TDD + Code Quality)
- [ ] **No skipped tests** — Remove `Skip` attributes
- [ ] Tests are **focused** — one concern per test
- [ ] Integration tests use **real dependencies** (not all mocks)
- [ ] Nearest sibling patterns followed
- [ ] Imports/paths correct
- [ ] No secrets committed
- [ ] Diffs minimal and focused

---

## Environment & Secrets

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

## Key Files

- **Authority**: `.github/instructions/copilot-instructions.md` (source of truth)
- **Backend spec**: `.claude/agents/back-specialist.md`
- **Frontend spec**: `.claude/agents/front-specialist.md`
- **Global spec**: `openspec/specs/spec.md`
- **OpenSpec config**: `openspec/config.yaml`
- **Permissions**: `.claude/settings.local.json`

---

## Common Commands

### Dev
```bash
# Frontend
cd Front && npm run dev

# Backend
cd Back/ExtractionApi && dotnet run --project src/RFFM.Host
```

### Build & Test
```bash
# Frontend
npm run build && npm run test

# Backend
dotnet build && dotnet test
```

### Migrations
```bash
cd Back/ExtractionApi
.\manage-migrations.ps1
```

---

**Last Updated**: July 10, 2026  
**Maintainers**: Backend (back-specialist), Frontend (front-specialist)
