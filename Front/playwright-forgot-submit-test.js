const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("http://localhost:5173/coach/forgot-password");
    // Fill email
    await page.fill('input[type="email"]', "test@example.com");
    // Click submit
    await page.click("text=Enviar Enlace de Reseteo");
    // Immediately check that button shows 'Enviando...' or spinner
    const sending = await page.locator("text=Enviando...").count();
    console.log("Enviando visible count:", sending);
    // Check for CircularProgress presence
    const spinner = await page.locator("svg").filter({ hasText: "" }).count();
    console.log("SVG elements count (spinner presence heuristic):", spinner);
    // Wait a short while and ensure button returns to normal (since no network, it should after form code completes)
    await page.waitForTimeout(1500);
    const after = await page.locator("text=Enviar Enlace de Reseteo").count();
    console.log("Enviar visible after wait count:", after);
  } catch (e) {
    console.error(e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
