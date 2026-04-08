import { studioFileHref, studioHtmlHref } from "./links";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderInline = (value: string, projectId: string) =>
  escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
      if (/^(https?:\/\/|mailto:|#)/i.test(href)) {
        return `<a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
      }
      const localHref = href.endsWith(".html")
        ? studioHtmlHref(projectId, href)
        : studioFileHref(projectId, href);
      return `<a href="${localHref}" target="_blank" rel="noreferrer">${escapeHtml(
        label
      )}</a>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

export const markdownToHtml = (markdown: string, projectId: string) => {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const chunks: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    chunks.push(`<p>${renderInline(paragraph.join(" ").trim(), projectId)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }
    chunks.push(
      `<${listType}>${listItems
        .map((item) => `<li>${renderInline(item.trim(), projectId)}</li>`)
        .join("")}</${listType}>`
    );
    listType = null;
    listItems = [];
  };

  const flushCode = () => {
    if (!inCode) {
      return;
    }
    chunks.push(
      `<pre><code>${escapeHtml(codeLines.join("\n")).trimEnd()}</code></pre>`
    );
    inCode = false;
    codeLines = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length, 6);
      chunks.push(`<h${level}>${renderInline(headingMatch[2], projectId)}</h${level}>`);
      continue;
    }

    const boldOnlyMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
    if (boldOnlyMatch) {
      flushParagraph();
      flushList();
      chunks.push(`<h4>${renderInline(boldOnlyMatch[1], projectId)}</h4>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      chunks.push("<hr />");
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();

  return chunks.join("\n");
};
