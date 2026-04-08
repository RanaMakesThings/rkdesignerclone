import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { readDeckSpec } from "./read-deck-spec.mjs";

export const discoverDeckProjects = async (repoRoot) => {
  const projectsRoot = resolve(repoRoot, "projects");
  const entries = await readdir(projectsRoot, { withFileTypes: true });

  const projectRoots = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(projectsRoot, entry.name))
    .filter((projectRoot) => existsSync(resolve(projectRoot, "deck-spec.json")))
    .sort();

  const discovered = [];
  for (const projectRoot of projectRoots) {
    const { deckSpecPath, deckSpec } = await readDeckSpec(projectRoot);
    discovered.push({
      projectId: String(deckSpec.deckId ?? projectRoot.split("/").at(-1)),
      projectRoot,
      deckSpecPath,
      title: String(deckSpec.title ?? ""),
      version: String(deckSpec.version ?? ""),
      status: String(deckSpec.status ?? "unknown"),
      slideCount: Array.isArray(deckSpec.slides) ? deckSpec.slides.length : 0,
    });
  }

  return discovered;
};
