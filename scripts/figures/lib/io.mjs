import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ASSET_CACHE_ROOT,
  OUTPUT_ROOT,
  REPO_ROOT,
} from "./constants.mjs";

export const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

export const writeJson = async (filePath, value) => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const writeText = async (filePath, value) => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
};

export const resolveRepoPath = (filePath) =>
  isAbsolute(filePath) ? filePath : resolve(REPO_ROOT, filePath);

export const toFileUrl = (filePath) => pathToFileURL(filePath).href;

export const slugToOutputDir = (slug) => resolve(OUTPUT_ROOT, slug);

export const slugToImageRequestOutputDir = (slug) =>
  resolve(OUTPUT_ROOT, "image-requests", slug);

export const assetCacheRoot = () => ASSET_CACHE_ROOT;

export const getOutputPaths = ({ slug, outputDir = null }) => {
  const dir = outputDir ? resolveRepoPath(outputDir) : slugToOutputDir(slug);
  return {
    dir,
    assetsDir: resolve(dir, "assets"),
    specJsonPath: resolve(dir, "spec.json"),
    metaJsonPath: resolve(dir, "meta.json"),
    htmlPath: resolve(dir, "figure.html"),
    svgPath: resolve(dir, "figure.svg"),
    pngPath: resolve(dir, "figure.png"),
    coveragePath: resolve(dir, "coverage.json"),
    assessmentPath: resolve(dir, "assessment.json"),
    assetsManifestPath: resolve(dir, "assets.json"),
    assetBoardHtmlPath: resolve(dir, "asset-board.html"),
    assetBoardPngPath: resolve(dir, "asset-board.png"),
    assetSelectionPath: resolve(dir, "asset-selection.json"),
    renderAssetsPath: resolve(dir, "render-assets.json"),
  };
};

export const getArg = (args, name) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
};

export const hasFlag = (args, name) => args.includes(`--${name}`);
