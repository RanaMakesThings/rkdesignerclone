import { pathToFileURL } from "node:url";

import { importPlaywright } from "./html-screenshot-lib.mjs";

const createLimiter = (concurrency) => {
  const maxConcurrency = Math.max(1, Number(concurrency) || 1);
  let activeCount = 0;
  const queue = [];

  const pump = () => {
    if (activeCount >= maxConcurrency) {
      return;
    }
    const next = queue.shift();
    if (!next) {
      return;
    }
    activeCount += 1;
    Promise.resolve()
      .then(next.task)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeCount -= 1;
        pump();
      });
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      pump();
    });
};

export const createHtmlScreenshotPool = async ({
  concurrency = 2,
  importPlaywrightImpl = importPlaywright,
} = {}) => {
  const { chromium } = await importPlaywrightImpl();
  const browser = await chromium.launch({ headless: true });
  const limit = createLimiter(concurrency);
  const idlePages = [];
  const pages = new Set();

  const acquirePage = async ({ width, height }) => {
    const page = idlePages.pop();
    if (page) {
      await page.setViewportSize({
        width: Number(width),
        height: Number(height),
      });
      return page;
    }

    const nextPage = await browser.newPage({
      viewport: { width: Number(width), height: Number(height) },
      deviceScaleFactor: 1,
    });
    pages.add(nextPage);
    return nextPage;
  };

  const releasePage = async (page) => {
    if (page.isClosed()) {
      pages.delete(page);
      return;
    }
    idlePages.push(page);
  };

  return {
    capture: ({ inputPath, outputPath, width = 1920, height = 1080, fullPage = false }) =>
      limit(async () => {
        const page = await acquirePage({ width, height });
        try {
          await page.goto(pathToFileURL(inputPath).href, {
            waitUntil: "networkidle",
          });
          await page.screenshot({
            path: outputPath,
            fullPage: Boolean(fullPage),
          });
          return outputPath;
        } finally {
          await releasePage(page);
        }
      }),
    close: async () => {
      for (const page of pages) {
        if (!page.isClosed()) {
          await page.close();
        }
      }
      await browser.close();
    },
  };
};
