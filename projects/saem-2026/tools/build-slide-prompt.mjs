#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { readDeckSpec, resolveDeckSlideEntry } from "../../../lib/repo/read-deck-spec.mjs";

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), "projects", "saem-2026");

const parseArgs = (argv) => {
  const args = {
    projectRoot: DEFAULT_PROJECT_ROOT,
    slide: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--project-root") {
      args.projectRoot = resolve(String(argv[index + 1]));
      index += 1;
    } else if (token === "--slide") {
      args.slide = String(argv[index + 1]);
      index += 1;
    }
  }

  if (!args.slide) {
    throw new Error("Usage: node build-slide-prompt.mjs --slide <slide-XX|N> [--project-root <path>]");
  }

  return args;
};

const quoteList = (values = []) => values.filter(Boolean).map((value) => `- ${value}`).join("\n");

const extractCitationAnchors = (proof = []) => {
  const seen = new Set();
  for (const line of proof) {
    const matches = String(line ?? "").match(/\[[0-9,\s]+\]/g) ?? [];
    for (const match of matches) {
      const cleaned = match.replace(/[\[\]\s]/g, "");
      for (const token of cleaned.split(",")) {
        if (token) {
          seen.add(`[${token}]`);
        }
      }
    }
  }
  return Array.from(seen);
};

const loadPacketText = async (projectRoot, packetPath) => {
  if (!packetPath) {
    return "";
  }
  const resolvedPath = resolve(projectRoot, "..", "..", packetPath.replace(/^projects\//, "projects/"));
  const fallbackPath = resolve(process.cwd(), packetPath);
  const finalPath = existsSync(fallbackPath) ? fallbackPath : resolvedPath;
  if (!existsSync(finalPath)) {
    return "";
  }
  return readFile(finalPath, "utf8");
};

export const buildSaemSlidePrompt = async ({
  projectRoot = DEFAULT_PROJECT_ROOT,
  slide,
}) => {
  const { deckSpec } = await readDeckSpec(projectRoot);
  const slideEntry = resolveDeckSlideEntry({ deckSpec, slide });
  const packetText = await loadPacketText(projectRoot, slideEntry?.paths?.packet ?? null);
  const citations = extractCitationAnchors(slideEntry?.proof ?? []);
  const notes = Array.isArray(slideEntry?.notes) ? slideEntry.notes : [];
  const subheaderLine = slideEntry?.subheader
    ? `- Subheader: \`${slideEntry.subheader}\``
    : "- Subheader: none";
  const citationLine =
    citations.length > 0
      ? `- Preferred citation anchors: ${citations.join(", ")}`
      : "- Preferred citation anchors: none required";

  return [
    "Create one finished 1920x1080 academic-conference slide as a self-contained HTML document.",
    "",
    "This slide belongs to a SAEM annual meeting talk on microlearning in emergency medicine.",
    "",
    "Hard requirements:",
    "",
    '- Use a full-slide background image layer with this exact element:',
    '  `<img class="shell" src="../../../../templates/saem-annual-meeting-template-v1/template.png" alt="" aria-hidden="true" />`',
    "- Put all real content above the branded footer region so the SAEM26 logo/date block and skyline stay readable.",
    "- Do not obscure the lower-left logo block or the lower skyline/footer band.",
    "- Use inline CSS only.",
    "- Use inline SVG if helpful for lines, frameworks, diagrams, or geometry.",
    "- Do not use external fonts, scripts, libraries, or remote assets.",
    "- Do not return markdown or explanation.",
    "",
    "Style continuity:",
    "",
    "- Match the existing deck family: clean academic keynote, white or near-white canvas, deep navy typography, restrained SAEM blue and red accents, modern but calm.",
    "- Do not make this look like a browser page, product UI, hospital dashboard, or poster session handout.",
    "- Avoid cheesy stock-photo logic, cartoon medical iconography, or AI-hype visuals.",
    "",
    "Locked text:",
    "",
    `- Header: \`${slideEntry.header}\``,
    subheaderLine,
    "",
    "Slide contract:",
    "",
    `- Slide title: ${slideEntry.title}`,
    `- Purpose: ${slideEntry.purpose}`,
    `- Takeaway: ${slideEntry.takeaway}`,
    `- Figure role: ${slideEntry.figureRole}`,
    `- Visual family: ${slideEntry.family}`,
    `- Selected direction: ${slideEntry.selectedDirection}`,
    ...notes.map((note) => `- Additional note: ${note}`),
    "",
    "Evidence and citations:",
    "",
    citationLine,
    ...quoteList(slideEntry?.proof ?? []).split("\n").filter(Boolean),
    "- Where citations fit, render them as subtle evidence chips or compact bracket references.",
    "- Keep citation styling quiet and professional; they should support the claim, not dominate the slide.",
    "",
    "Reference images:",
    "",
    "- If reference images are attached, use them for family continuity, composition discipline, text density, and citation styling.",
    "- Do not literally copy the reference slides.",
    "",
    "Slide packet:",
    "",
    packetText.trim() || "(No packet text found.)",
    "",
    "Output:",
    "",
    "- Return one complete HTML document only.",
  ].join("\n");
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const prompt = await buildSaemSlidePrompt(args);
  process.stdout.write(`${prompt}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
