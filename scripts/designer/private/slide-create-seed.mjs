import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { captureHtmlScreenshot } from "../../utils/html-screenshot-lib.mjs";

const isRelativeAssetRef = (value) => {
  const raw = String(value ?? "").trim();
  return Boolean(
    raw &&
      !raw.startsWith("#") &&
      !raw.startsWith("/") &&
      !raw.startsWith("data:") &&
      !raw.startsWith("http://") &&
      !raw.startsWith("https://") &&
      !raw.startsWith("javascript:")
  );
};

const toPosix = (value) => String(value).replaceAll("\\", "/");

const relativizeAssetPath = ({ templateDir, versionDir, assetRef }) => {
  const resolvedAssetPath = resolve(templateDir, assetRef);
  const rel = toPosix(relative(versionDir, resolvedAssetPath));
  if (!rel || rel === "") {
    return ".";
  }
  return rel.startsWith(".") ? rel : `./${rel}`;
};

export const rewriteTemplateAssetPaths = ({
  html,
  templateDir,
  versionDir,
}) => {
  let nextHtml = String(html ?? "");

  nextHtml = nextHtml.replace(
    /\b(src|href)=["']([^"']+)["']/gi,
    (match, attr, value) => {
      if (!isRelativeAssetRef(value)) {
        return match;
      }
      const rewritten = relativizeAssetPath({
        templateDir,
        versionDir,
        assetRef: value,
      });
      return `${attr}="${rewritten}"`;
    }
  );

  nextHtml = nextHtml.replace(/url\((['"]?)([^'")]+)\1\)/gi, (match, quote, value) => {
    if (!isRelativeAssetRef(value)) {
      return match;
    }
    const rewritten = relativizeAssetPath({
      templateDir,
      versionDir,
      assetRef: value,
    });
    return `url(${quote || ""}${rewritten}${quote || ""})`;
  });

  return nextHtml;
};

const ensureTemplateSeedSnapshotInternal = async ({
  versionDir,
  templateDir,
  shellRegionsPath,
  screenshotImpl = captureHtmlScreenshot,
}) => {
  const resolvedVersionDir = resolve(String(versionDir));
  const resolvedTemplateDir = resolve(String(templateDir));
  const createDir = resolve(resolvedVersionDir, "create");
  const canonicalTemplateHtmlPath = resolve(resolvedTemplateDir, "template.html");
  const canonicalTemplatePreviewPath = resolve(resolvedTemplateDir, "template.png");
  const snapshotTemplateHtmlPath = resolve(createDir, "template.html");
  const snapshotTemplatePreviewPath = resolve(createDir, "template.png");
  const snapshotShellRegionsPath = resolve(createDir, "shell-regions.json");

  await mkdir(createDir, { recursive: true });

  const rawTemplateHtml = await readFile(canonicalTemplateHtmlPath, "utf8");
  const seededHtml = rewriteTemplateAssetPaths({
    html: rawTemplateHtml,
    templateDir: resolvedTemplateDir,
    versionDir: resolvedVersionDir,
  });
  await writeFile(snapshotTemplateHtmlPath, `${seededHtml.trim()}\n`, "utf8");

  if (shellRegionsPath && existsSync(shellRegionsPath)) {
    await copyFile(resolve(shellRegionsPath), snapshotShellRegionsPath);
  }

  if (existsSync(canonicalTemplatePreviewPath)) {
    await copyFile(canonicalTemplatePreviewPath, snapshotTemplatePreviewPath);
  } else {
    await screenshotImpl({
      inputPath: snapshotTemplateHtmlPath,
      outputPath: snapshotTemplatePreviewPath,
    });
  }

  return {
    canonicalTemplateHtmlPath,
    canonicalTemplatePreviewPath: existsSync(canonicalTemplatePreviewPath)
      ? canonicalTemplatePreviewPath
      : null,
    templateHtmlPath: snapshotTemplateHtmlPath,
    templatePreviewPath: snapshotTemplatePreviewPath,
    snapshotTemplateHtmlPath,
    snapshotTemplatePreviewPath,
    snapshotShellRegionsPath: existsSync(snapshotShellRegionsPath)
      ? snapshotShellRegionsPath
      : null,
  };
};

export const ensureTemplateSeedSnapshot = async ({
  versionDir,
  templateDir,
  shellRegionsPath,
  screenshotImpl = captureHtmlScreenshot,
}) => {
  return ensureTemplateSeedSnapshotInternal({
    versionDir,
    templateDir,
    shellRegionsPath,
    screenshotImpl,
  });
};

export const seedVersionFromTemplate = async ({
  versionDir,
  templateDir,
  shellRegionsPath,
  screenshotImpl = captureHtmlScreenshot,
}) => {
  const resolvedVersionDir = resolve(String(versionDir));
  const generatedHtmlPath = resolve(resolvedVersionDir, "generated.html");
  const previewPath = resolve(resolvedVersionDir, "preview.png");
  const templateSnapshot = await ensureTemplateSeedSnapshotInternal({
    versionDir,
    templateDir,
    shellRegionsPath,
    screenshotImpl,
  });

  const seededHtml = await readFile(templateSnapshot.templateHtmlPath, "utf8");
  await writeFile(generatedHtmlPath, `${seededHtml.trim()}\n`, "utf8");
  await copyFile(templateSnapshot.templatePreviewPath, previewPath);

  return {
    generatedHtmlPath,
    previewPath,
    ...templateSnapshot,
  };
};
