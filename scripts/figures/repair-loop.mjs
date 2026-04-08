#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import { createRequire } from "node:module";
import { readDeckSpec, resolveDeckSlideEntry } from "../../lib/repo/read-deck-spec.mjs";
import {
  readSlideManifest,
  resolveSlideVersionContext,
} from "./lib/slide-versioning.mjs";

const require = createRequire(import.meta.url);

const requireDep = (name, hint) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(name);
  } catch (_error) {
    console.error(`\nMissing dependency: ${name}`);
    if (hint) {
      console.error(hint);
    }
    console.error("Run: npm install\n");
    process.exit(1);
  }
};

const yargs = requireDep("yargs/yargs", "Needed for CLI argument parsing.");
const { hideBin } = requireDep("yargs/helpers", "Needed for CLI argument parsing.");

const findRepairPrompt = async (promptsDir, slideSlug) => {
  if (!existsSync(promptsDir)) {
    return null;
  }
  const entries = await readdir(promptsDir, { withFileTypes: true });
  const matches = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(slideSlug) &&
        entry.name.endsWith("-repair.txt")
    )
    .map((entry) => resolve(promptsDir, entry.name))
    .sort();
  return matches.at(-1) ?? null;
};

const findRepairPromptFromPrefixes = async (promptsDir, prefixes) => {
  for (const prefix of [...new Set((prefixes ?? []).filter(Boolean))]) {
    const matched = await findRepairPrompt(promptsDir, prefix);
    if (matched) {
      return matched;
    }
  }
  return null;
};

const extractSection = (text, headingNumber, headingTitle, nextNumber) => {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return "";
  }

  const patterns = [
    new RegExp(
      `(?:^|\\n)#+\\s*${headingNumber}\\.\\s*${headingTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+([\\s\\S]*?)(?=\\n#+\\s*${nextNumber}\\.|\n\\*\\*${nextNumber}\\.|$)`,
      "i"
    ),
    new RegExp(
      `(?:^|\\n)\\*\\*${headingNumber}\\.\\s*${headingTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*\\s*\\n+([\\s\\S]*?)(?=\\n\\*\\*${nextNumber}\\.|\n#+\\s*${nextNumber}\\.|\n$)`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  const fallbackPatterns = [
    new RegExp(
      `(?:^|\\n)#+\\s*${headingNumber}\\.\\s*${headingTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+([\\s\\S]*)$`,
      "i"
    ),
    new RegExp(
      `(?:^|\\n)\\*\\*${headingNumber}\\.\\s*${headingTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*\\s*\\n+([\\s\\S]*)$`,
      "i"
    ),
  ];

  for (const pattern of fallbackPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
};

const wrapParagraph = (value, width = 76) => {
  const words = String(value ?? "").replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 0 || !words[0]) {
    return "";
  }

  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.join("\n");
};

const normalizeBulletBlock = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return [];
  }

  const prepared = raw
    .replace(/\r\n/g, "\n")
    .replace(/[•*]\s+/g, "- ")
    .replace(/\s+-\s+/g, "\n- ");

  const lines = prepared
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2).trim());
      continue;
    }
    if (bullets.length === 0) {
      bullets.push(line);
      continue;
    }
    bullets[bullets.length - 1] = `${bullets.at(-1)} ${line}`.trim();
  }

  return bullets;
};

const formatBullets = (value) => {
  const bullets = normalizeBulletBlock(value);
  if (bullets.length === 0) {
    return "_fill in_";
  }

  return bullets
    .map((bullet) => {
      const wrapped = wrapParagraph(bullet, 72).split("\n");
      return wrapped
        .map((line, index) => `${index === 0 ? "- " : "  "}${line}`)
        .join("\n");
    })
    .join("\n");
};

const formatParagraphBlock = (value) => wrapParagraph(value, 76) || "_fill in_";

const summarizeRepair = (text) => ({
  failureClass: formatParagraphBlock(
    extractSection(text, 1, "Failure class", 2)
  ),
  stayFamily: formatParagraphBlock(
    extractSection(text, 2, "Stay in current family?", 3)
  ),
  nextMove: formatParagraphBlock(extractSection(text, 3, "Exact next move", 4)),
  mustChange: formatBullets(
    extractSection(text, 4, "What the next render must change", 5)
  ),
  avoid: formatBullets(extractSection(text, 5, "What not to do", 6)),
});

const runNodeCommand = async (args) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`Command failed with exit code ${code}: node ${args.join(" ")}`));
    });
  });

const main = async () => {
  await yargs(hideBin(process.argv))
    .scriptName("figures:repair-loop")
    .usage(
      "Usage: npm run figures:repair-loop -- --project-root <path> --slide <slide-XX> [options]"
    )
    .option("project-root", {
      type: "string",
      demandOption: true,
      describe: "Project root, e.g. projects/designer-health",
    })
    .option("slide", {
      type: "string",
      demandOption: true,
      describe:
        "Slide id or current public display number, e.g. slide-06, slide-6, or 6",
    })
    .option("prompt-file", {
      type: "string",
      describe: "Explicit repair prompt file; defaults to the slide-matched repair prompt",
    })
    .option("image", {
      type: "string",
      describe:
        "Explicit image path; defaults to the current version bundle figure.png when the slide is manifest-backed",
    })
    .option("codex-file", {
      type: "string",
      describe: "Codex/GPT-5.4 repair note; defaults to slide-figures/<slide>/codex-repair.md",
    })
    .option("gemini-out", {
      type: "string",
      describe: "Gemini repair output dir; defaults to slide-figures/<slide>/gemini-repair",
    })
    .option("anthropic-out", {
      type: "string",
      describe: "Anthropic repair output dir; defaults to slide-figures/<slide>/anthropic-repair",
    })
    .option("synthesis-out", {
      type: "string",
      describe:
        "Output path for the generated repair synthesis scaffold; defaults to slide-figures/<slide>/repair-synthesis.generated.md",
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const projectRoot = resolve(String(argv.projectRoot));
      const { deckSpec } = await readDeckSpec(projectRoot);
      const slideEntry = resolveDeckSlideEntry({ deckSpec, slide: argv.slide });
      const context = await resolveSlideVersionContext({
        projectRoot,
        slideId: slideEntry.id,
      });
      const slideSlug = context.slideId;
      const slideDir = context.slideDir;
      const manifestPath = resolve(slideDir, "manifest.json");
      const manifest = existsSync(manifestPath)
        ? await readSlideManifest({
            projectRoot,
            slideId: context.slideId,
            slideDir,
          })
        : null;
      const currentVersionEntry = manifest?.currentVersionId
        ? manifest.versions.find((entry) => entry.id === manifest.currentVersionId) ?? null
        : null;
      const artifactRoot = currentVersionEntry?.dir
        ? resolve(projectRoot, "..", "..", currentVersionEntry.dir)
        : slideDir;
      const promptsDir = resolve(projectRoot, "prompts");
      const promptPrefixes = [slideSlug, context.slideDirName];

      const promptFile = argv.promptFile
        ? resolve(String(argv.promptFile))
        : await findRepairPromptFromPrefixes(promptsDir, promptPrefixes);
      if (!promptFile || !existsSync(promptFile)) {
        throw new Error(
          `Could not find a repair prompt for ${slideSlug}. Pass --prompt-file explicitly.`
        );
      }

      const imagePath = argv.image
        ? resolve(String(argv.image))
        : resolve(artifactRoot, "figure.png");
      if (!existsSync(imagePath)) {
        throw new Error(`Repair loop image not found: ${imagePath}`);
      }

      const codexFile = argv.codexFile
        ? resolve(String(argv.codexFile))
        : resolve(artifactRoot, "codex-repair.md");
      if (!existsSync(codexFile)) {
        throw new Error(
          `Missing Codex/GPT-5.4 repair note: ${codexFile}. Write that first, then rerun the repair loop.`
        );
      }

      const geminiOut = argv.geminiOut
        ? resolve(String(argv.geminiOut))
        : resolve(artifactRoot, "gemini-repair");
      const anthropicOut = argv.anthropicOut
        ? resolve(String(argv.anthropicOut))
        : resolve(artifactRoot, "anthropic-repair");
      const synthesisOut = argv.synthesisOut
        ? resolve(String(argv.synthesisOut))
        : resolve(artifactRoot, "repair-synthesis.generated.md");

      await mkdir(geminiOut, { recursive: true });
      await mkdir(anthropicOut, { recursive: true });
      await mkdir(resolve(synthesisOut, ".."), { recursive: true });

      await runNodeCommand([
        "scripts/doppler/run.mjs",
        "--",
        "node",
        "scripts/llm/gemini-review-cli.mjs",
        "--image",
        imagePath,
        "--prompt-file",
        promptFile,
        "--out",
        geminiOut,
      ]);

      await runNodeCommand([
        "scripts/doppler/run.mjs",
        "--",
        "node",
        "scripts/llm/anthropic-cli.mjs",
        "review",
        "--image",
        imagePath,
        "--prompt-file",
        promptFile,
        "--out",
        anthropicOut,
      ]);

      const codexText = await readFile(codexFile, "utf8");
      const geminiText = await readFile(resolve(geminiOut, "response.txt"), "utf8");
      const anthropicText = await readFile(resolve(anthropicOut, "response.txt"), "utf8");

      const codexSummary = summarizeRepair(codexText);
      const geminiSummary = summarizeRepair(geminiText);
      const anthropicSummary = summarizeRepair(anthropicText);

      const output = `# ${slideSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Repair Synthesis (Generated Skeleton)

Generated by \`npm run figures:repair-loop\`.

This is a scaffold assembled from:

- Codex / GPT-5.4: \`${codexFile}\`
- Gemini repair: \`${resolve(geminiOut, "response.txt")}\`
- Anthropic repair: \`${resolve(anthropicOut, "response.txt")}\`

Finalize this into \`repair-synthesis.md\` after reviewing the three inputs.

## Repair question

_Summarize the repair question in one short paragraph._

## Tool-by-tool answer

### Codex

- failure class:
  ${codexSummary.failureClass}
- family decision:
  ${codexSummary.stayFamily}
- exact next move:
  ${codexSummary.nextMove}

### Gemini

- failure class:
  ${geminiSummary.failureClass}
- family decision:
  ${geminiSummary.stayFamily}
- exact next move:
  ${geminiSummary.nextMove}

### Anthropic

- failure class:
  ${anthropicSummary.failureClass}
- family decision:
  ${anthropicSummary.stayFamily}
- exact next move:
  ${anthropicSummary.nextMove}

## Synthesis across the four axes

- failure class:
  _fill in_
- family choice:
  _fill in_
- fix scope:
  _fill in_
- next render change:
  _fill in_

## Shared required changes

- Codex:
${codexSummary.mustChange}
- Gemini:
${geminiSummary.mustChange}
- Anthropic:
${anthropicSummary.mustChange}

## Shared prohibitions

- Codex:
${codexSummary.avoid}
- Gemini:
${geminiSummary.avoid}
- Anthropic:
${anthropicSummary.avoid}

## Final operator decision

_Fill in the chosen next move after reviewing the three repair consults._
`;

      await writeFile(synthesisOut, output, "utf8");

      process.stdout.write(
        [
          "Repair loop complete.",
          `Prompt: ${promptFile}`,
          `Codex: ${codexFile}`,
          `Gemini: ${resolve(geminiOut, "response.txt")}`,
          `Anthropic: ${resolve(anthropicOut, "response.txt")}`,
          `Synthesis scaffold: ${synthesisOut}`,
        ].join("\n")
      );
      process.stdout.write("\n");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

await main();
