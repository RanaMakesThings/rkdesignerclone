import { CANVAS } from "./constants.mjs";

const SVG_TAG_PATTERN = /<svg\b[\s\S]*?<\/svg>/i;
const STYLE_BLOCK_PATTERN = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const BODY_PATTERN = /<body[^>]*>([\s\S]*?)<\/body>/i;

const ensureSvgNamespace = (svg) =>
  /\bxmlns=/.test(svg)
    ? svg
    : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');

const extractStyleText = (html) => {
  const blocks = [];
  let match;
  while ((match = STYLE_BLOCK_PATTERN.exec(String(html ?? ""))) !== null) {
    const text = String(match[1] ?? "").trim();
    if (text) {
      blocks.push(text);
    }
  }
  return blocks.join("\n\n");
};

const injectStyleIntoSvg = (svg, styleText) => {
  if (!styleText.trim()) {
    return ensureSvgNamespace(svg);
  }

  const withNamespace = ensureSvgNamespace(svg);
  return withNamespace.replace(
    /<svg\b([^>]*)>/i,
    `<svg$1><style>${styleText}</style>`
  );
};

const wrapHtmlInForeignObjectSvg = (html) => {
  const styleText = extractStyleText(html);
  const bodyMatch = String(html ?? "").match(BODY_PATTERN);
  const bodyInner = String(bodyMatch?.[1] ?? "").trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">
  <foreignObject x="0" y="0" width="${CANVAS.width}" height="${CANVAS.height}">
    <body xmlns="http://www.w3.org/1999/xhtml">
      <style>${styleText}</style>
      ${bodyInner}
    </body>
  </foreignObject>
</svg>
`;
};

export const renderFigureSvgFromHtml = (html) => {
  const text = String(html ?? "");
  const svgMatch = text.match(SVG_TAG_PATTERN);

  if (svgMatch) {
    return injectStyleIntoSvg(svgMatch[0], extractStyleText(text));
  }

  return wrapHtmlInForeignObjectSvg(text);
};
