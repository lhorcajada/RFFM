const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("http://localhost:5173/");
    // Ensure logged in state by setting storage if necessary
    // clear first
    await page.evaluate(() => localStorage.clear());
    // simulate login by setting rffm_user and coachAuthToken
    await page.evaluate(() => {
      localStorage.setItem(
        "rffm_user",
        JSON.stringify({ id: "1", username: "tester" })
      );
      localStorage.setItem("coachAuthToken", "fake.token.signature");
      localStorage.setItem("coachUserId", "1");
    });
    await page.reload({ waitUntil: "load" });
    // open avatar menu - click the first IconButton that contains an Avatar
    await page.click("header button");
    // wait for menu to appear and click logout
    await page.waitForSelector("text=Cerrar sesión", { timeout: 5000 });
    await page.click("text=Cerrar sesión");
    // wait a bit
    await page.waitForTimeout(500);
    const token = await page.evaluate(() =>
      localStorage.getItem("coachAuthToken")
    );
    const user = await page.evaluate(() => localStorage.getItem("rffm_user"));
    console.log("token after logout:", token);
    console.log("rffm_user after logout:", user);
  } catch (e) {
    console.error(e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
