# 🎮 FutbolBase Hooks Configuration

**Status:** ✅ **ACTIVE** | **Version:** 1.0 | **Date:** 2026-07-10

---

## 🚀 Quick Start

```bash
# 1. Start session
claude
# → SessionStart hook: shows status ✅

# 2. Implement with TDD (RED → GREEN → REFACTOR)
# Vitest + Testing Library (frontend) or xUnit + Moq (backend)

# 3. Commit
git commit -m "feat(scope): description"
# → PreToolUse hook: tests ✅ + build ✅
# → If pass: commit created
# → PostToolUse hook: code review? (yes/no)

# 4. Push
git push origin dev
# → PreToolUse hook: final validation ✅
```

---

## 📦 What's Installed

### Specialized Review Agents (2)
- `code-reviewer-front.md` - React, TypeScript, MUI, CSS Modules, Vitest
- `code-reviewer-back.md` - ASP.NET Core, CQRS, validation, xUnit

### Automation Scripts (4)
- `test-coverage.ps1` - Run tests with coverage validation
- `build-all.ps1` - Compile frontend + backend
- `conventional-commit.ps1` - Validate commit format
- `git-commit-conventional.ps1` - Interactive commit builder

### Active Hooks (4)
- **SessionStart** - Display configuration status
- **UserPromptSubmit** - TDD reminder (implement|feature|fix|refactor|bug)
- **PreToolUse** - Tests + build before commit/push (BLOCKS if fail)
- **PostToolUse** - Code review offer after commit

### Documentation (5)
- `QUICKSTART.md` - 5-minute quick start
- `HOOKS_README.md` - Complete documentation
- `HOOKS_SETUP.md` - Quick reference
- `VERIFICATION_CHECKLIST.md` - Validation checklist
- `SETUP_COMPLETE.md` - Setup summary

---

## 📝 Conventional Commits

**Format:** `type(scope)?: description`

**Valid types:**
```
feat   - New feature          ✅ feat(auth): add JWT refresh
fix    - Bug fix              ✅ fix(api): resolve N+1 query
docs   - Documentation        ✅ docs(readme): update install
style  - Code formatting      ✅ style(colors): update palette
refactor - Code refactor      ✅ refactor(cache): simplify logic
perf   - Performance          ✅ perf(api): optimize response
test   - Add/fix tests        ✅ test(login): add comprehensive tests
chore  - Dependencies         ✅ chore(deps): upgrade MUI
ci     - CI/CD changes        ✅ ci(workflow): add E2E tests
build  - Build system         ✅ build(dotnet): upgrade to 9.0
```

---

## 🎯 Coverage Targets

| Layer | Target | Tool |
|-------|--------|------|
| Frontend Components | ≥75% | Vitest |
| Backend Handlers | ≥80% | xUnit |
| Backend Domain Logic | ≥85% | xUnit |

---

## 🔍 Code Review Severity

**Frontend & Backend Reviews:**
- 🔴 **CRITICAL** - Security, auth, type errors, test failures
- 🟠 **MAJOR** - Coverage below target, missing tests
- 🟡 **MINOR** - Code style, documentation
- 🟢 **SUGGESTION** - Non-blocking improvements

---

## 🆘 Troubleshooting

### Scripts don't run
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Tests fail
```bash
npm run test          # frontend
dotnet test           # backend
```

### Build fails
```bash
npm run build         # frontend
dotnet build          # backend
```

### Invalid commit message
```bash
powershell -File .claude\hooks\git-commit-conventional.ps1
```

---

## 📚 Documentation Map

| Need | Read |
|------|------|
| 5-min intro | `QUICKSTART.md` |
| Full guide | `HOOKS_README.md` |
| Quick ref | `HOOKS_SETUP.md` |
| Verification | `VERIFICATION_CHECKLIST.md` |
| Summary | `SETUP_COMPLETE.md` |

---

## 📂 File Structure

```
.claude/
├── agents/
│   ├── code-reviewer-front.md
│   └── code-reviewer-back.md
├── hooks/
│   ├── test-coverage.ps1
│   ├── build-all.ps1
│   ├── conventional-commit.ps1
│   └── git-commit-conventional.ps1
├── settings.json              (hooks configured)
├── README.md                  (this file)
├── QUICKSTART.md
├── HOOKS_README.md
├── HOOKS_SETUP.md
├── VERIFICATION_CHECKLIST.md
└── SETUP_COMPLETE.md
```

---

## ⚡ TDD Methodology

**Always:** RED → GREEN → REFACTOR

1. **RED** - Write failing test first
   - Frontend: Vitest + Testing Library
   - Backend: xUnit + Moq

2. **GREEN** - Write minimal code to pass test

3. **REFACTOR** - Clean code while tests stay green

---

## 💡 Key Points

✅ **Tests first** - Never start with implementation  
✅ **Small commits** - Frequent, focused changes  
✅ **Coverage matters** - 75-85% by layer  
✅ **Conventional commits** - Consistent history  
✅ **Code review** - Learn from specialized agents  
✅ **Green builds** - No broken commits  

---

## 🎓 Workflow Example

```
Day 1: Feature Development
├─ claude                          (SessionStart)
├─ Implement: auth token refresh   (TDD)
│  ├─ Write tests (RED)
│  ├─ Implement code (GREEN)
│  └─ Refactor (REFACTOR)
├─ git commit -m "feat(auth): add JWT refresh"
│  ├─ PreToolUse: Tests pass ✅
│  ├─ PreToolUse: Build passes ✅
│  └─ PostToolUse: Code review accepted ✅
└─ git push origin dev
   └─ PreToolUse: Final validation ✅

Day 2: Bug Fix
├─ claude
├─ Implement: fix N+1 query
│  ├─ Write tests (RED)
│  ├─ Implement fix (GREEN)
│  └─ Refactor (REFACTOR)
├─ git commit -m "fix(api): resolve N+1 in teams"
└─ git push origin dev
```

---

## 🚀 Next Steps

1. **Read** `QUICKSTART.md` (5 min)
2. **Try** your first commit with hooks active (10 min)
3. **Explore** agents in `.claude/agents/` (5 min)
4. **Use** standard workflow with automated validation (ongoing)

---

## 📞 Quick Commands

```bash
# Validate tests manually
powershell -File .claude\hooks\test-coverage.ps1 -Layer all

# Build manually
powershell -File .claude\hooks\build-all.ps1 -Layer all

# Interactive commit helper
powershell -File .claude\hooks\git-commit-conventional.ps1

# View docs
code .claude/QUICKSTART.md
```

---

**Status:** ✅ Fully Configured  
**Ready to use:** Immediately  
**Team ready:** Yes  

---

*See `.claude/QUICKSTART.md` to get started →*
