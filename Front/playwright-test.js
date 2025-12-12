const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("http://localhost:5173/");
    // Click the '¿Olvidaste tu contraseña?' link on login if present
    const forgot = await page.$('a[href="/coach/forgot-password"]');
    if (forgot) {
      await forgot.click();
      await page.waitForLoadState("networkidle");
      console.log("After click, URL:", page.url());
      // Check if we are on forgot-password
      if (page.url().includes("/coach/forgot-password")) {
        console.log("Forgot-password opened correctly");
      } else {
        console.log("Forgot-password did NOT open, current URL:", page.url());
      }
    } else {
      console.log("Forgot link not found on login page");
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
