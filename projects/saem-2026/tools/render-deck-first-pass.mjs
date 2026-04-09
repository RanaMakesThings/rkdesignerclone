#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { getActiveDeckSlides, readDeckSpec } from "../../../lib/repo/read-deck-spec.mjs";
import { generateGeminiHtml, writeGeminiHtmlOutputArtifacts } from "../../../scripts/llm/gemini-html-lib.mjs";
import { prepareMachinaSlideCreate } from "../../../scripts/machina/slide-create-prep-lib.mjs";
import { captureHtmlScreenshot } from "../../../scripts/utils/html-screenshot-lib.mjs";
import { buildSaemSlidePrompt } from "./build-slide-prompt.mjs";

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), "projects", "saem-2026");

const parseArgs = (argv) => {
  const args = {
    projectRoot: DEFAULT_PROJECT_ROOT,
    slides: [],
    force: false,
    model: "gemini-3.1-pro-preview",
    thinkingLevel: "medium",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--project-root") {
      args.projectRoot = resolve(String(argv[index + 1]));
      index += 1;
    } else if (token === "--slides") {
      args.slides = String(argv[index + 1])
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    } else if (token === "--force") {
      args.force = true;
    } else if (token === "--model") {
      args.model = String(argv[index + 1]);
      index += 1;
    } else if (token === "--thinking-level") {
      args.thinkingLevel = String(argv[index + 1]);
      index += 1;
    }
  }

  return args;
};

const resolveSlideList = async ({ projectRoot, slides }) => {
  if (slides.length > 0) {
    return slides;
  }
  const { deckSpec } = await readDeckSpec(projectRoot);
  return getActiveDeckSlides(deckSpec).map((entry) => entry.id);
};

const fileExists = (path) => existsSync(resolve(path));

const maybeReferenceImages = (projectRoot, slideId) => {
  if (slideId === "slide-01" || slideId === "slide-02") {
    return [];
  }
  const candidates = [
    resolve(
      projectRoot,
      "slide-figures",
      "slide-01",
      "versions",
      "version-000001--slide-01-create-draft",
      "preview.png"
    ),
    resolve(
      projectRoot,
      "slide-figures",
      "slide-02",
      "versions",
      "version-000001--slide-02-create-draft",
      "preview.png"
    ),
  ];
  return candidates.filter(fileExists);
};

const isAlreadyRendered = (versionDir) =>
  ["generated.html", "preview.png", "prompt.txt", "response.txt"].every((name) =>
    fileExists(resolve(versionDir, name))
  );

const renderSlide = async ({
  projectRoot,
  slideId,
  force,
  model,
  thinkingLevel,
}) => {
  const prep = await prepareMachinaSlideCreate({
    slide: slideId,
    projectRoot,
    force: false,
  });

  if (!force && isAlreadyRendered(prep.draftVersionDir)) {
    return {
      slideId,
      status: "skipped",
      versionDir: prep.draftVersionDir,
      previewPath: resolve(prep.draftVersionDir, "preview.png"),
    };
  }

  const prompt = await buildSaemSlidePrompt({
    projectRoot,
    slide: slideId,
  });

  const referenceImages = maybeReferenceImages(projectRoot, slideId);
  const startedAt = Date.now();
  const result = await generateGeminiHtml({
    prompt,
    imagePaths: referenceImages,
    model,
    thinkingLevel,
  });
  const elapsedMs = Date.now() - startedAt;

  const artifacts = await writeGeminiHtmlOutputArtifacts({
    dir: prep.draftVersionDir,
    prompt,
    model,
    temperature: 0.4,
    thinkingLevel,
    imagePaths: referenceImages,
    result,
    elapsedMs,
  });

  const previewPath = resolve(prep.draftVersionDir, "preview.png");
  await captureHtmlScreenshot({
    inputPath: artifacts.htmlPath,
    outputPath: previewPath,
  });

  return {
    slideId,
    status: "rendered",
    versionDir: prep.draftVersionDir,
    previewPath,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const slides = await resolveSlideList(args);
  for (const slideId of slides) {
    const result = await renderSlide({
      projectRoot: args.projectRoot,
      slideId,
      force: args.force,
      model: args.model,
      thinkingLevel: args.thinkingLevel,
    });
    process.stdout.write(
      `${result.slideId}: ${result.status} -> ${result.previewPath}\n`
    );
  }
};

await main();
