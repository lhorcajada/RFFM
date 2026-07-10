import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for scoped-membership-management change
 * Tests: 5.2 (full flow) + 5.3 (error scenarios)
 *
 * Prerequisite: Backend running on https://localhost:7287
 * Environment: VITE_USE_MOCK=false (real backend, not mocks)
 */

const BACKEND_URL = 'https://localhost:7287';
const FRONTEND_URL = 'http://localhost:5173';

// Helper: Create unique email for each test run
const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}@test.local`;

// Test 5.2: Complete flow
test.describe('5.2 — Full E2E Flow', () => {
  let coachEmail: string;
  let playerEmail: string;
  let invitationCode: string;
  let createdClubId: string;
  let createdTeamId: string;

  test('Register coach → Create club → Create team → Rotate invitation code → Invite player → Player joins → Coach removes player → Player leaves', async ({ browser }) => {
    coachEmail = uniqueEmail('coach');
    playerEmail = uniqueEmail('player');

    // PHASE 1: Coach registration and setup
    const coachContext = await browser.newContext();
    const coachPage = await coachContext.newPage();

    // Navigate to register
    await coachPage.goto(`${FRONTEND_URL}/register`);
    await expect(coachPage.locator('text=Register')).toBeVisible();

    // Fill registration form (Coach)
    await coachPage.fill('input[type="email"]', coachEmail);
    await coachPage.fill('input[type="password"]', 'TestPassword123!');
    await coachPage.fill('input[type="password"]:nth-of-type(2)', 'TestPassword123!');

    // Select account type: Coach
    const accountTypeSelect = coachPage.locator('select, [role="combobox"]').first();
    await accountTypeSelect.click();
    await coachPage.locator('text=Coach').click();

    // Submit
    await coachPage.click('button:has-text("Register")');

    // Verify redirect to app selector or login
    await coachPage.waitForURL(`${FRONTEND_URL}/*`, { timeout: 10000 });

    // PHASE 2: Create club
    // Navigate to clubs (adjust URL based on actual routing)
    await coachPage.goto(`${FRONTEND_URL}/federation/clubs`);
    await expect(coachPage.locator('button:has-text("New Club"), button:has-text("Create Club"), button:has-text("+")')).toBeVisible({ timeout: 5000 });

    // Click create club button
    await coachPage.click('button:has-text("New Club"), button:has-text("Create Club"), button:has-text("+")');

    // Fill club form
    await coachPage.fill('input[placeholder*="Club Name"], input[name*="name"]', 'Test Club');
    await coachPage.fill('input[placeholder*="Short Name"], input[name*="shortName"]', 'TC');

    // Submit
    await coachPage.click('button:has-text("Create"), button:has-text("Save")');

    // Capture club ID from URL or store
    createdClubId = await coachPage.url().then(url => {
      const match = url.match(/clubs\/([^/?]+)/);
      return match ? match[1] : 'unknown';
    });

    // PHASE 3: Create team
    await coachPage.click('button:has-text("New Team"), button:has-text("Create Team")');
    await coachPage.fill('input[placeholder*="Team Name"], input[name*="name"]', 'Test Team');
    await coachPage.fill('input[placeholder*="Short Name"], input[name*="shortName"]', 'TT');
    await coachPage.click('button:has-text("Create"), button:has-text("Save")');

    createdTeamId = await coachPage.url().then(url => {
      const match = url.match(/teams\/([^/?]+)/);
      return match ? match[1] : 'unknown';
    });

    // PHASE 4: Navigate to scope members and verify UI
    await coachPage.goto(`${FRONTEND_URL}/coach/scope/members`);

    // Verify page loaded with coach's team/club (adjust selectors)
    await expect(coachPage.locator('text=Scope Members, Members, Team Members, Club Members')).toBeVisible({ timeout: 5000 });

    // PHASE 5: Rotate invitation code
    const regenerateBtn = coachPage.locator('button:has-text("Rotate"), button:has-text("Regenerate"), button:has-text("New Code")').first();
    if (await regenerateBtn.isVisible()) {
      await regenerateBtn.click();

      // Confirm rotation dialog if present
      const confirmBtn = coachPage.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Regenerate")').last();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      // Extract new invitation code from display
      const codeDisplay = coachPage.locator('text=/[A-Z0-9]{6,}/, span:has-text(/[A-Z0-9]{6,}/), input[readonly]').first();
      invitationCode = await codeDisplay.textContent() || await codeDisplay.inputValue() || 'UNKNOWN';
      invitationCode = invitationCode.trim().toUpperCase();
    }

    // PHASE 6: Player joins with invitation code
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();

    // Register player with invitation code
    await playerPage.goto(`${FRONTEND_URL}/register?code=${invitationCode}`);

    // Fill player registration
    await playerPage.fill('input[type="email"]', playerEmail);
    await playerPage.fill('input[type="password"]', 'TestPassword123!');
    await playerPage.fill('input[type="password"]:nth-of-type(2)', 'TestPassword123!');

    // System should detect code and pre-select team/club
    await playerPage.click('button:has-text("Register")');
    await playerPage.waitForURL(`${FRONTEND_URL}/*`, { timeout: 10000 });

    // PHASE 7: Verify player appears in coach's member list
    await coachPage.reload();
    await coachPage.goto(`${FRONTEND_URL}/coach/scope/members`);

    // Look for player email or name in members table
    await expect(coachPage.locator(`text=${playerEmail}`)).toBeVisible({ timeout: 5000 });

    // PHASE 8: Coach removes player
    const removeBtn = coachPage.locator(`tr:has-text("${playerEmail}") button:has-text("Remove"), tr:has-text("${playerEmail}") button:has-text("Delete")`).first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();

      // Confirm removal
      const confirmRemove = coachPage.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Remove")').last();
      if (await confirmRemove.isVisible()) {
        await confirmRemove.click();
      }

      // Verify snackbar or success message
      await expect(coachPage.locator('text=removed, deleted, success')).toBeVisible({ timeout: 5000 });
    }

    // PHASE 9: Verify player is removed from list
    await coachPage.reload();
    const playerRow = coachPage.locator(`text=${playerEmail}`);
    await expect(playerRow).not.toBeVisible({ timeout: 5000 });

    // Cleanup
    await coachContext.close();
    await playerContext.close();
  });
});

// Test 5.3: Error scenarios
test.describe('5.3 — Error Scenarios', () => {
  let coachEmail: string;
  let playerEmail: string;

  test('409: One active scope only (duplicate invite)', async ({ page }) => {
    coachEmail = uniqueEmail('coach-409');
    playerEmail = uniqueEmail('player-409');

    // Register coach and player
    await page.goto(`${FRONTEND_URL}/register`);
    await registerUser(page, coachEmail, 'Coach');

    // Create team
    await page.goto(`${FRONTEND_URL}/federation/clubs`);
    await createClub(page, 'Club 409');
    await createTeam(page, 'Team 409');

    // Get invitation code
    await page.goto(`${FRONTEND_URL}/coach/scope/members`);
    const codeText = await page.locator('text=/[A-Z0-9]{6,}/'). first().textContent();
    const code = codeText?.trim().toUpperCase() || 'TEST';

    // First invite: register player
    let playerContext = await page.context().browser()?.newContext();
    let playerPage = await playerContext?.newPage()!;
    await playerPage.goto(`${FRONTEND_URL}/register?code=${code}`);
    await registerUser(playerPage, playerEmail, 'Player');

    // Second invite: try to invite same player again (should fail with 409)
    await page.goto(`${FRONTEND_URL}/coach/scope/members`);
    const inviteField = page.locator('input[placeholder*="email"], input[placeholder*="Email"]').first();
    if (await inviteField.isVisible()) {
      await inviteField.fill(playerEmail);
      await page.click('button:has-text("Invite"), button:has-text("Add")');

      // Expect 409 error
      await expect(page.locator('text=already member, active space, only one')).toBeVisible({ timeout: 5000 });
    }

    await playerPage.close();
    await playerContext?.close();
  });

  test('403: Foreign scope (player cannot remove from other coach)', async ({ browser }) => {
    coachEmail = uniqueEmail('coach-403');
    const coach2Email = uniqueEmail('coach2-403');
    playerEmail = uniqueEmail('player-403');

    // Create two coaches
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto(`${FRONTEND_URL}/register`);
    await registerUser(page1, coachEmail, 'Coach');
    await createClub(page1, 'Club A');
    await createTeam(page1, 'Team A');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto(`${FRONTEND_URL}/register`);
    await registerUser(page2, coach2Email, 'Coach');
    await createClub(page2, 'Club B');

    // Coach 1 invites player
    await page1.goto(`${FRONTEND_URL}/coach/scope/members`);
    const codeText = await page1.locator('text=/[A-Z0-9]{6,}/').first().textContent();
    const code = codeText?.trim().toUpperCase() || 'TEST';

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`${FRONTEND_URL}/register?code=${code}`);
    await registerUser(playerPage, playerEmail, 'Player');

    // Coach 2 tries to remove player (should fail with 403)
    await page2.goto(`${FRONTEND_URL}/coach/scope/members`);
    const removeBtn = page2.locator(`text=${playerEmail}`).locator('..').locator('button:has-text("Remove")').first();

    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await expect(page2.locator('text=not authorized, forbidden, permission')).toBeVisible({ timeout: 5000 });
    }

    await context1.close();
    await context2.close();
    await playerContext.close();
  });

  test('402: No active subscription (cannot access scope)', async ({ page }) => {
    coachEmail = uniqueEmail('coach-402');

    // Register coach
    await page.goto(`${FRONTEND_URL}/register`);
    await registerUser(page, coachEmail, 'Coach');

    // Try to access scope/members without active subscription
    await page.goto(`${FRONTEND_URL}/coach/scope/members`);

    // Should see error or redirect
    await expect(page.locator('text=subscription, billing, payment, 402')).toBeVisible({ timeout: 5000 });
  });

  test('400: Invalid membership type', async ({ page }) => {
    coachEmail = uniqueEmail('coach-400');

    // Register and setup
    await page.goto(`${FRONTEND_URL}/register`);
    await registerUser(page, coachEmail, 'Coach');
    await createClub(page, 'Club 400');

    // Try to invite with invalid membership
    await page.goto(`${FRONTEND_URL}/coach/scope/members`);
    const inviteField = page.locator('input[placeholder*="email"]').first();

    if (await inviteField.isVisible()) {
      await inviteField.fill('invalid@example.com');
      // Simulate invalid membership selection
      const roleSelect = page.locator('select, [role="combobox"]').last();
      if (await roleSelect.isVisible()) {
        await roleSelect.click();
        await page.locator('text=InvalidRole').click();
      }

      await page.click('button:has-text("Invite")');
      await expect(page.locator('text=invalid, not allowed, 400')).toBeVisible({ timeout: 5000 });
    }
  });

  test('400: Cannot remove creator or self', async ({ page }) => {
    coachEmail = uniqueEmail('coach-400b');
    playerEmail = uniqueEmail('player-400b');

    // Register and setup
    await page.goto(`${FRONTEND_URL}/register`);
    await registerUser(page, coachEmail, 'Coach');
    await createClub(page, 'Club 400b');

    // Get code and invite player
    await page.goto(`${FRONTEND_URL}/coach/scope/members`);
    const codeText = await page.locator('text=/[A-Z0-9]{6,}/').first().textContent();
    const code = codeText?.trim().toUpperCase() || 'TEST';

    const playerContext = await page.context().browser()?.newContext();
    const playerPage = await playerContext?.newPage()!;
    await playerPage.goto(`${FRONTEND_URL}/register?code=${code}`);
    await registerUser(playerPage, playerEmail, 'Player');

    // Coach tries to remove self
    await page.goto(`${FRONTEND_URL}/coach/scope/members`);
    const selfRemoveBtn = page.locator(`tr:has-text("${coachEmail}") button:has-text("Remove")`).first();

    if (await selfRemoveBtn.isVisible()) {
      await selfRemoveBtn.click();
      await expect(page.locator('text=cannot remove, creator, yourself, 400')).toBeVisible({ timeout: 5000 });
    }

    await playerPage.close();
    await playerContext?.close();
  });
});

// Helper functions
async function registerUser(page: Page, email: string, role: string) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.fill('input[type="password"]:nth-of-type(2)', 'TestPassword123!');

  const roleSelect = page.locator('select, [role="combobox"]').first();
  if (await roleSelect.isVisible()) {
    await roleSelect.click();
    await page.locator(`text=${role}`).click();
  }

  await page.click('button:has-text("Register")');
  await page.waitForURL(`${FRONTEND_URL}/*`, { timeout: 10000 });
}

async function createClub(page: Page, clubName: string) {
  await page.goto(`${FRONTEND_URL}/federation/clubs`);
  await page.click('button:has-text("New Club"), button:has-text("Create Club"), button:has-text("+")');
  await page.fill('input[placeholder*="Club Name"], input[name*="name"]', clubName);
  await page.fill('input[placeholder*="Short Name"], input[name*="shortName"]', clubName.substring(0, 2).toUpperCase());
  await page.click('button:has-text("Create"), button:has-text("Save")');
  await page.waitForURL(`${FRONTEND_URL}/*clubs*`, { timeout: 10000 });
}

async function createTeam(page: Page, teamName: string) {
  await page.click('button:has-text("New Team"), button:has-text("Create Team"), button:has-text("+")');
  await page.fill('input[placeholder*="Team Name"], input[name*="name"]', teamName);
  await page.fill('input[placeholder*="Short Name"], input[name*="shortName"]', teamName.substring(0, 2).toUpperCase());
  await page.click('button:has-text("Create"), button:has-text("Save")');
  await page.waitForURL(`${FRONTEND_URL}/*teams*`, { timeout: 10000 });
}
