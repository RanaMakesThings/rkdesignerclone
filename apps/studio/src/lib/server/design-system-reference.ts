import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { resolveRepoRoot } from "./repo-contract";

export const DESIGNER_DESIGN_SYSTEM_REFERENCE_PATH =
  "projects/designer-health/references/vox-design-system-reference.html";
export const DESIGNER_DESIGN_SYSTEM_STYLESHEET_PATH =
  "projects/designer-health/references/vox-design-system.css";

const extractTitle = (html: string) => {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() || "Vox Design System Reference";
};

const extractCss = (html: string) =>
  Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join("\n\n");

const extractFontHref = (html: string) => {
  const match = html.match(
    /<link[^>]+href="([^"]*fonts\.googleapis\.com[^"]*)"[^>]*rel="stylesheet"[^>]*>/i
  );
  return match?.[1] ?? null;
};

const extractFontHrefFromCss = (css: string) => {
  const match = css.match(/@import\s+url\((['"]?)([^'")]*fonts\.googleapis\.com[^'")]+)\1\)/i);
  return match?.[2] ?? null;
};

const extractLocalStylesheetHref = (html: string) => {
  const matches = Array.from(
    html.matchAll(/<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"[^>]*>/gi),
    (match) => String(match[1] ?? "").trim()
  ).filter(Boolean);

  return (
    matches.find(
      (href) =>
        !href.includes("fonts.googleapis.com") &&
        !href.startsWith("http://") &&
        !href.startsWith("https://") &&
        !href.startsWith("//")
    ) ?? null
  );
};

const extractUniqueMatches = (input: string, pattern: RegExp) =>
  Array.from(
    new Set(
      Array.from(input.matchAll(pattern), (match) => String(match[1] ?? "").trim()).filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

export const getDesignerDesignSystemReference = async () => {
  const repoRoot = await resolveRepoRoot();
  const absolutePath = join(repoRoot, DESIGNER_DESIGN_SYSTEM_REFERENCE_PATH);
  const canonicalCssAbsolutePath = join(repoRoot, DESIGNER_DESIGN_SYSTEM_STYLESHEET_PATH);

  if (!existsSync(absolutePath)) {
    return null;
  }

  const html = readFileSync(absolutePath, "utf8");
  const linkedCssHref = extractLocalStylesheetHref(html);
  const linkedCssAbsolutePath = linkedCssHref
    ? resolve(dirname(absolutePath), linkedCssHref)
    : null;
  const resolvedCssAbsolutePath = existsSync(canonicalCssAbsolutePath)
    ? canonicalCssAbsolutePath
    : linkedCssAbsolutePath && existsSync(linkedCssAbsolutePath)
      ? linkedCssAbsolutePath
      : null;
  const css = resolvedCssAbsolutePath
    ? readFileSync(resolvedCssAbsolutePath, "utf8").trim()
    : extractCss(html);
  const tokenNames = extractUniqueMatches(css, /--([a-z0-9-]+)\s*:/gi);
  const classNames = extractUniqueMatches(css, /\.([a-z0-9_-]+)\s*[{,:]/gi);
  const cssPath = resolvedCssAbsolutePath
    ? relative(repoRoot, resolvedCssAbsolutePath).replaceAll("\\", "/")
    : null;

  return {
    title: extractTitle(html),
    path: DESIGNER_DESIGN_SYSTEM_REFERENCE_PATH,
    absolutePath,
    html,
    css,
    cssPath,
    fontHref: extractFontHref(html) ?? extractFontHrefFromCss(css),
    tokenNames,
    classNames,
  };
};
