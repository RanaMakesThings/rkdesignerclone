#!/usr/bin/env node

import process from "node:process";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { createRequire } from "node:module";

import {
  bootstrapSlideFromRoot,
  compactSlideRoot,
  createSlideVersion,
  importSlideHtmlVersion,
  migrateProjectSlideVersions,
  normalizeSlideVersionCss,
  normalizeSlideId,
  promoteSlideVersion,
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

const defaultProjectRoot = resolve(process.cwd(), "projects", "designer-health");

const readStdinBuffer = async () => {
  if (process.stdin.isTTY) {
    return null;
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

await yargs(hideBin(process.argv))
  .scriptName("slide:versions")
  .command(
    "create",
    "Allocate a new slide version and optionally clone the current one",
    (command) =>
      command
        .option("project-root", {
          type: "string",
          default: defaultProjectRoot,
          describe: "Project root, e.g. projects/designer-health",
        })
        .option("slide", {
          type: "string",
          demandOption: true,
          describe: "Logical slide id, e.g. slide-09",
        })
        .option("label", {
          type: "string",
          describe: "Human-readable version label",
        })
        .option("clone-current", {
          type: "boolean",
          default: false,
          describe: "Copy the current version payload into the new version bundle",
        })
        .option("source-kind", {
          type: "string",
          default: "draft",
          describe: "Version sourceKind metadata value",
        })
        .option("bootstrap-root", {
          type: "boolean",
          default: false,
          describe: "If no manifest exists yet, seed it from the current root payload first",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON",
        }),
    async (argv) => {
      const projectRoot = resolve(String(argv.projectRoot));
      const slideId = normalizeSlideId(argv.slide);
      if (argv.bootstrapRoot) {
        await bootstrapSlideFromRoot({ projectRoot, slideId });
      }
      const created = await createSlideVersion({
        projectRoot,
        slideId,
        label: argv.label ? String(argv.label) : null,
        sourceKind: String(argv.sourceKind),
        cloneCurrent: Boolean(argv.cloneCurrent),
      });
      const payload = {
        ok: true,
        slideId: created.slideId,
        slideDir: created.slideDir,
        versionId: created.versionId,
        versionDir: created.versionDir,
      };
      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }
      process.stdout.write(
        [`Created slide version`, created.versionId, created.versionDir].join("\n")
      );
      process.stdout.write("\n");
    }
  )
  .command(
    "import-html",
    "Register operator-supplied HTML as a new slide version bundle",
    (command) =>
      command
        .option("project-root", {
          type: "string",
          default: defaultProjectRoot,
          describe: "Project root, e.g. projects/designer-health",
        })
        .option("slide", {
          type: "string",
          demandOption: true,
          describe: "Logical slide id, e.g. slide-09",
        })
        .option("html-file", {
          type: "string",
          describe: "Path to the source HTML file; otherwise reads HTML from stdin",
        })
        .option("label", {
          type: "string",
          describe: "Human-readable version label",
        })
        .option("base-version-id", {
          type: "string",
          default: "current",
          describe: "Version provenance base; use current, none, or a version id",
        })
        .option("promote", {
          type: "boolean",
          default: false,
          describe: "Promote the imported version to current after preview render",
        })
        .option("width", {
          type: "number",
          default: 1920,
          describe: "Preview viewport width",
        })
        .option("height", {
          type: "number",
          default: 1080,
          describe: "Preview viewport height",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON",
        }),
    async (argv) => {
      const projectRoot = resolve(String(argv.projectRoot));
      const slideId = normalizeSlideId(argv.slide);
      const htmlFile = argv.htmlFile ? resolve(String(argv.htmlFile)) : null;
      const htmlBuffer = htmlFile ? await readFile(htmlFile) : await readStdinBuffer();
      if (!htmlBuffer || htmlBuffer.byteLength === 0) {
        throw new Error("Provide HTML via --html-file or stdin.");
      }

      const imported = await importSlideHtmlVersion({
        projectRoot,
        slideId,
        label: argv.label ? String(argv.label) : null,
        labelHint: htmlFile ? basename(htmlFile, extname(htmlFile)) : null,
        html: htmlBuffer,
        baseVersionId: String(argv.baseVersionId),
        promote: Boolean(argv.promote),
        previewWidth: Number(argv.width),
        previewHeight: Number(argv.height),
      });

      const payload = {
        ok: true,
        slideId: imported.slideId,
        slideDir: imported.slideDir,
        versionId: imported.versionId,
        versionDir: imported.versionDir,
        generatedHtmlPath: imported.generatedHtmlPath,
        sourceHtmlPath: imported.sourceHtmlPath,
        previewPath: imported.previewPath,
        promoted: imported.promoted,
      };
      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }
      process.stdout.write(
        [
          "Imported slide HTML",
          imported.versionId,
          imported.versionDir,
          imported.promoted ? "promoted: true" : "promoted: false",
        ].join("\n")
      );
      process.stdout.write("\n");
    }
  )
  .command(
    "normalize-css",
    "Create a shared-CSS draft from an existing version bundle",
    (command) =>
      command
        .option("project-root", {
          type: "string",
          default: defaultProjectRoot,
          describe: "Project root, e.g. projects/designer-health",
        })
        .option("slide", {
          type: "string",
          demandOption: true,
          describe: "Logical slide id, e.g. slide-09",
        })
        .option("version-id", {
          type: "string",
          demandOption: true,
          describe: "Version id to normalize, e.g. version-000123",
        })
        .option("label", {
          type: "string",
          describe: "Human-readable label for the new shared-CSS draft",
        })
        .option("width", {
          type: "number",
          default: 1920,
          describe: "Preview viewport width",
        })
        .option("height", {
          type: "number",
          default: 1080,
          describe: "Preview viewport height",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON",
        }),
    async (argv) => {
      const normalized = await normalizeSlideVersionCss({
        projectRoot: resolve(String(argv.projectRoot)),
        slideId: normalizeSlideId(argv.slide),
        versionId: String(argv.versionId),
        label: argv.label ? String(argv.label) : null,
        previewWidth: Number(argv.width),
        previewHeight: Number(argv.height),
      });
      const payload = {
        ok: true,
        slideId: normalized.slideId,
        slideDir: normalized.slideDir,
        sourceVersionId: normalized.sourceVersionId,
        versionId: normalized.versionId,
        versionDir: normalized.versionDir,
        generatedHtmlPath: normalized.generatedHtmlPath,
        sourceHtmlPath: normalized.sourceHtmlPath,
        previewPath: normalized.previewPath,
      };
      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }
      process.stdout.write(
        [
          "Normalized slide CSS",
          `source: ${normalized.sourceVersionId}`,
          normalized.versionId,
          normalized.versionDir,
        ].join("\n")
      );
      process.stdout.write("\n");
    }
  )
  .command(
    "promote",
    "Copy a version payload to the slide root and mark it current",
    (command) =>
      command
        .option("project-root", {
          type: "string",
          default: defaultProjectRoot,
          describe: "Project root, e.g. projects/designer-health",
        })
        .option("slide", {
          type: "string",
          demandOption: true,
          describe: "Logical slide id, e.g. slide-09",
        })
        .option("version-id", {
          type: "string",
          demandOption: true,
          describe: "Version id, e.g. version-000123",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON",
        }),
    async (argv) => {
      const promoted = await promoteSlideVersion({
        projectRoot: resolve(String(argv.projectRoot)),
        slideId: normalizeSlideId(argv.slide),
        versionId: String(argv.versionId),
      });
      const payload = {
        ok: true,
        slideId: promoted.slideId,
        slideDir: promoted.slideDir,
        versionId: promoted.versionId,
        versionDir: promoted.versionDir,
      };
      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }
      process.stdout.write(
        [`Promoted slide version`, promoted.versionId, promoted.slideDir].join("\n")
      );
      process.stdout.write("\n");
    }
  )
  .command(
    "compact",
    "Reduce slide roots to the clean current figure projection plus versions",
    (command) =>
      command
        .option("project-root", {
          type: "string",
          default: defaultProjectRoot,
          describe: "Project root, e.g. projects/designer-health",
        })
        .option("slide", {
          type: "array",
          string: true,
          default: [],
          describe: "Optional one or more slide dir names or ids to compact",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON",
        }),
    async (argv) => {
      const projectRoot = resolve(String(argv.projectRoot));
      const slides = Array.isArray(argv.slide) ? argv.slide.map((value) => String(value)) : [];
      const targetSlides =
        slides.length > 0
          ? slides
          : (await readdir(resolve(projectRoot, "slide-figures"), { withFileTypes: true }))
              .filter((entry) => entry.isDirectory() && entry.name.startsWith("slide-"))
              .map((entry) => entry.name);
      const results = [];

      for (const slide of targetSlides) {
        results.push(
          await compactSlideRoot({
            projectRoot,
            slideId: normalizeSlideId(slide),
          })
        );
      }

      const payload = {
        ok: true,
        results,
      };
      if (argv.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }
      process.stdout.write(
        `Compacted slide roots\n${results.length} slide directories\n`
      );
    }
  )
  .command(
    "migrate",
    "Migrate legacy slide-figures history into manifest-backed versions",
    (command) =>
      command
        .option("project-root", {
          type: "string",
          default: defaultProjectRoot,
          describe: "Project root, e.g. projects/designer-health",
        })
        .option("slide", {
          type: "array",
          string: true,
          default: [],
          describe: "Optional one or more slide dir names or ids to migrate",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON",
        }),
    async (argv) => {
      const result = await migrateProjectSlideVersions({
        projectRoot: resolve(String(argv.projectRoot)),
        slideIds: Array.isArray(argv.slide) ? argv.slide.map((value) => String(value)) : [],
      });
      if (argv.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      process.stdout.write(`Migrated slide versioning\n${result.results.length} slide directories\n`);
    }
  )
  .demandCommand(1)
  .strict()
  .help()
  .parseAsync()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
