import { pathToFileURL } from "node:url";

export const importPlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Playwright is required for HTML screenshots but is unavailable.",
        `Details: ${message}`,
        "Remediation:",
        "1) Install dependencies with `npm install`.",
        "2) Install Chromium if needed with `npx playwright install chromium`.",
      ].join("\n")
    );
  }
};

export const captureHtmlScreenshot = async ({
  inputPath,
  outputPath,
  width = 1920,
  height = 1080,
  fullPage = false,
  importPlaywrightImpl = importPlaywright,
}) => {
  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: Number(width), height: Number(height) },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(inputPath).href, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: outputPath,
      fullPage: Boolean(fullPage),
    });
    await page.close();
  } finally {
    await browser.close();
  }

  return outputPath;
};
