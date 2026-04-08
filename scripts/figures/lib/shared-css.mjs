import { dirname, relative, resolve } from "node:path";

export const SHARED_CSS_MODE = "shared-css";
export const DESIGNER_DESIGN_SYSTEM_DIR = "design-system";
export const DESIGNER_SHARED_CSS_FILE = "vox-shared.css";
export const DESIGNER_STYLE_PREVIEW_FILE = "style-preview.html";
export const DESIGNER_STYLE_PREVIEW_SOURCE_FILE = "style-preview.source-locked.html";

const FULL_DOCUMENT_RE = /<(?:!doctype|html|head|body)\b/i;
const STYLE_TAG_RE = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
const HEAD_CLOSE_RE = /<\/head>/i;
const BODY_OPEN_RE = /<body\b[^>]*>/i;
const HTML_OPEN_RE = /<html\b[^>]*>/i;
const SHARED_CSS_LINK_RE =
  /<link\b[^>]*data-designer-shared-css=(?:"true"|'true')[^>]*>/gi;
const SHARED_CSS_LINK_SINGLE_RE =
  /<link\b[^>]*data-designer-shared-css=(?:"true"|'true')[^>]*>/i;

const normalizeLineEndings = (value) => String(value ?? "").replace(/\r\n?/g, "\n");

const escapeRegExp = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPosixPath = (value) => String(value ?? "").replaceAll("\\", "/");

const collapseEmptyLines = (value) =>
  String(value ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeCssBlockForMatch = (value) =>
  normalizeLineEndings(value)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

const stripIndentedSharedCssBlock = ({ styleText, sharedCssText }) => {
  const sharedLines = normalizeLineEndings(sharedCssText)
    .trim()
    .split("\n")
    .map((line) => line.trim());
  const styleLines = normalizeLineEndings(styleText).split("\n");

  if (sharedLines.length === 0 || sharedLines.every((line) => !line)) {
    return styleText;
  }

  for (let start = 0; start <= styleLines.length - sharedLines.length; start += 1) {
    const candidateLines = styleLines
      .slice(start, start + sharedLines.length)
      .map((line) => line.trim());
    if (candidateLines.join("\n") !== sharedLines.join("\n")) {
      continue;
    }
    return [...styleLines.slice(0, start), ...styleLines.slice(start + sharedLines.length)].join(
      "\n"
    );
  }

  return styleText;
};

const ensureHtmlDocument = (html) => {
  const source = normalizeLineEndings(html).trim();
  if (!source) {
    return "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n  </head>\n  <body></body>\n</html>\n";
  }

  if (FULL_DOCUMENT_RE.test(source)) {
    return source;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>${source}</body>
</html>
`;
};

const buildSharedCssLinkTag = (href) =>
  `<link rel="stylesheet" href="${href}" data-designer-shared-css="true" />`;

const stripKnownSharedCssFromStyleText = ({ styleText, sharedCssText }) => {
  let nextStyle = normalizeLineEndings(styleText);
  const normalizedSharedCss = normalizeLineEndings(sharedCssText).trim();

  if (normalizedSharedCss && nextStyle.includes(normalizedSharedCss)) {
    nextStyle = nextStyle.replace(normalizedSharedCss, "");
  } else if (
    normalizedSharedCss &&
    normalizeCssBlockForMatch(nextStyle).includes(normalizeCssBlockForMatch(normalizedSharedCss))
  ) {
    nextStyle = stripIndentedSharedCssBlock({
      styleText: nextStyle,
      sharedCssText: normalizedSharedCss,
    });
  }

  const sharedImport = normalizedSharedCss.match(/@import\s+url\([^)]+\);?/i)?.[0] ?? null;
  if (sharedImport) {
    nextStyle = nextStyle.replace(new RegExp(`^\\s*${escapeRegExp(sharedImport)}\\s*`, "i"), "");
  }

  return collapseEmptyLines(nextStyle);
};

const stripKnownSharedCssFromHtml = ({ html, sharedCssText }) =>
  html.replace(STYLE_TAG_RE, (_match, attrs, styleText) => {
    const nextStyleText = stripKnownSharedCssFromStyleText({
      styleText,
      sharedCssText,
    });
    if (!nextStyleText) {
      return "";
    }
    return `<style${attrs}>${nextStyleText}\n  </style>`;
  });

const injectSharedCssLink = ({ html, href }) => {
  const linkTag = buildSharedCssLinkTag(href);
  const withoutExisting = html.replace(SHARED_CSS_LINK_RE, "");

  if (HEAD_CLOSE_RE.test(withoutExisting)) {
    return withoutExisting.replace(HEAD_CLOSE_RE, `  ${linkTag}\n</head>`);
  }

  if (BODY_OPEN_RE.test(withoutExisting)) {
    return withoutExisting.replace(
      BODY_OPEN_RE,
      `<head>\n  ${linkTag}\n</head>\n$&`
    );
  }

  if (HTML_OPEN_RE.test(withoutExisting)) {
    return withoutExisting.replace(
      HTML_OPEN_RE,
      `$&\n<head>\n  ${linkTag}\n</head>`
    );
  }

  return `<!doctype html>\n<html lang="en">\n<head>\n  ${linkTag}\n</head>\n<body>\n${withoutExisting}\n</body>\n</html>\n`;
};

export const getProjectSharedCssAbsolutePath = (projectRoot) =>
  resolve(projectRoot, DESIGNER_DESIGN_SYSTEM_DIR, DESIGNER_SHARED_CSS_FILE);

export const getProjectStylePreviewAbsolutePath = (projectRoot) =>
  resolve(projectRoot, DESIGNER_DESIGN_SYSTEM_DIR, DESIGNER_STYLE_PREVIEW_FILE);

export const getProjectStylePreviewSourceAbsolutePath = (projectRoot) =>
  resolve(projectRoot, DESIGNER_DESIGN_SYSTEM_DIR, DESIGNER_STYLE_PREVIEW_SOURCE_FILE);

export const getSharedCssHrefForHtml = ({ projectRoot, htmlAbsolutePath }) =>
  toPosixPath(
    relative(
      dirname(resolve(htmlAbsolutePath)),
      getProjectSharedCssAbsolutePath(projectRoot)
    )
  ) || DESIGNER_SHARED_CSS_FILE;

export const normalizeHtmlWithSharedCss = ({
  html,
  projectRoot,
  targetHtmlAbsolutePath,
  sharedCssText,
}) => {
  const documentHtml = ensureHtmlDocument(html);
  const strippedHtml = stripKnownSharedCssFromHtml({
    html: documentHtml,
    sharedCssText,
  });

  return injectSharedCssLink({
    html: strippedHtml,
    href: getSharedCssHrefForHtml({
      projectRoot,
      htmlAbsolutePath: targetHtmlAbsolutePath,
    }),
  });
};

export const rewriteSharedCssHrefInHtml = ({
  html,
  projectRoot,
  targetHtmlAbsolutePath,
}) => {
  if (!SHARED_CSS_LINK_SINGLE_RE.test(html)) {
    return html;
  }

  return injectSharedCssLink({
    html,
    href: getSharedCssHrefForHtml({
      projectRoot,
      htmlAbsolutePath: targetHtmlAbsolutePath,
    }),
  });
};

export const inlineSharedCssInHtml = ({ html, sharedCssText }) => {
  if (!SHARED_CSS_LINK_SINGLE_RE.test(html)) {
    return html;
  }

  const styleTag = `<style data-designer-shared-css="true">\n${String(
    sharedCssText ?? ""
  ).trim()}\n</style>`;
  return html.replace(SHARED_CSS_LINK_SINGLE_RE, styleTag);
};
