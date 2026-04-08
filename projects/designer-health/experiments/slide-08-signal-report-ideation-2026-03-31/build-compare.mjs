import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const replaceBlock = (html, id, content) => {
  const pattern = new RegExp(`(<pre id="${id}">)([\\s\\S]*?)(</pre>)`);
  return html.replace(pattern, `$1${escapeHtml(content)}$3`);
};

const main = async () => {
  const comparePath = resolve(currentDir, "compare.html");
  const prompt = await readFile(resolve(currentDir, "shared-prompt.md"), "utf8");
  const anthropic = await readFile(resolve(currentDir, "anthropic-opus-4-6", "response.txt"), "utf8");
  const gemini = await readFile(resolve(currentDir, "gemini-3.1-pro-preview", "response.txt"), "utf8");
  const openai = await readFile(resolve(currentDir, "gpt-5.4-high", "response.txt"), "utf8");

  let html = await readFile(comparePath, "utf8");
  html = replaceBlock(html, "prompt-content", prompt.trim());
  html = replaceBlock(html, "anthropic-content", anthropic.trim());
  html = replaceBlock(html, "gemini-content", gemini.trim());
  html = replaceBlock(html, "openai-content", openai.trim() || "No readable OpenAI text saved.");

  await writeFile(comparePath, html, "utf8");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
