#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";

import { resolveDesignerRepoRoot } from "../../lib/repo/config.mjs";
import { touchProjectManifestRefreshToken } from "../../lib/repo/manifest-cache.mjs";
import { readDeckSpec } from "../../lib/repo/read-deck-spec.mjs";
import { writeProjectReferenceArtifacts } from "../../lib/repo/resolve-references.mjs";

const parseArgs = (argv) => {
  const args = {
    projectRoot: "projects/designer-health",
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--project-root") {
      args.projectRoot = argv[index + 1] ?? args.projectRoot;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      process.stdout.write(
        [
          "Usage: npm run references:sync -- [--project-root <path>] [--json]",
          "",
          "--project-root  Project root relative to the repo root.",
          "--json          Print the sync result as JSON.",
        ].join("\n") + "\n"
      );
      process.exit(0);
    }

    throw new Error(`Unknown argument "${token}".`);
  }

  return args;
};

const main = async () => {
  const argv = parseArgs(process.argv.slice(2));
  const repoRoot = resolveDesignerRepoRoot({
    cwd: process.cwd(),
    env: process.env,
  });
  const projectRoot = resolve(repoRoot, argv.projectRoot);
  const { deckSpec } = await readDeckSpec(projectRoot);
  const result = await writeProjectReferenceArtifacts({
    repoRoot,
    projectRoot,
    deckSpec,
  });

  await touchProjectManifestRefreshToken({ repoRoot });

  if (argv.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          projectId: deckSpec.deckId,
          referencesManifestPath: result.manifestPath,
          generatedPaths: result.generatedPaths,
          runningReferenceCount: result.compiled.running.length,
          warningCount: result.compiled.warnings.length,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  process.stdout.write(
    [
      "Synced project references.",
      `- project: ${deckSpec.deckId}`,
      `- manifest: ${result.manifestPath}`,
      `- running references: ${result.compiled.running.length}`,
      `- warnings: ${result.compiled.warnings.length}`,
      `- json: ${result.generatedPaths.json}`,
      `- markdown: ${result.generatedPaths.markdown}`,
      `- appendix: ${result.generatedPaths.appendixHtml}`,
    ].join("\n") + "\n"
  );
};

await main();
