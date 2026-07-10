# E2E Tests — scoped-membership-management

Automated end-to-end tests for the scoped membership management feature (OpenSpec change).

## Tests

### 5.2 — Full E2E Flow
Complete workflow testing:
1. Coach registration
2. Create club and team
3. Rotate invitation code
4. Player joins with code
5. Coach lists members
6. Coach removes player
7. Player is no longer in list

### 5.3 — Error Scenarios
Validates error handling:
- **409**: One active scope only (duplicate invitations)
- **403**: Foreign scope (cannot remove from other coach)
- **402**: No active subscription (cannot access scope features)
- **400**: Invalid membership type
- **400**: Cannot remove creator or self

## Prerequisites

### Backend
- ASP.NET Core API running on `https://localhost:7287`
- Database populated with test data
- Mock mode **disabled** (`VITE_USE_MOCK=false`)

### Frontend
- Node dependencies installed: `npm install`
- Playwright installed: `npm install --save-dev @playwright/test` (already done)

### Environment
- Frontend dev server ready: `npm run dev` (runs on `http://localhost:5173`)
- Ports 5173 (frontend) and 7287 (backend) available
- No HTTPS certificate issues (self-signed OK for localhost)

## Running Tests

### All tests
```bash
npm run e2e
```

### UI mode (interactive)
```bash
npm run e2e:ui
```

### Debug mode
```bash
npm run e2e:debug
```

### Specific test
```bash
npx playwright test scoped-membership.spec.ts --grep "5.2"
npx playwright test scoped-membership.spec.ts --grep "409"
```

## Output

Tests generate:
- `playwright-report/` — detailed HTML report
- Screenshots on failure
- Traces for debugging

View report:
```bash
npx playwright show-report
```

## Troubleshooting

### Tests timeout
- Verify backend is running and accessible
- Check frontend is accessible on `http://localhost:5173`
- Increase timeout in `playwright.config.ts` if network is slow

### Authentication fails
- Verify registration endpoint works
- Check email validation rules (must be `@test.local` or similar)
- Ensure temp-token and JWT flows are working

### Selectors not found
- Tests use flexible selectors (text content, role attributes)
- If selectors fail, inspect actual HTML with `npm run e2e:debug`
- Update selectors in `scoped-membership.spec.ts` if UI changed

### 403/402/409 not triggered
- Ensure data setup is correct (subscriptions, roles, existing members)
- May require backend adjustments to trigger specific error codes
- Check API response in browser DevTools Network tab

## Notes

- Tests run **sequentially** (not parallel) to avoid race conditions
- Each test creates unique users with `Date.now()` to avoid conflicts
- Tests are **not idempotent** — they create data that persists in DB
- To rerun, manually delete test data or add cleanup logic
- Error message selectors are flexible (regex patterns) to match various UI text

## Next Steps

1. **Run tests**: `npm run e2e`
2. **Review output**: Check `playwright-report/index.html`
3. **Mark tasks complete**: If all pass, mark tasks 5.2 and 5.3 as `[x]` in archived change
4. **Document results**: Add pass/fail status to OpenSpec change record
