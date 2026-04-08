import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const replaceBlock = (html, id, content) =>
  html.replace(
    new RegExp(`(<pre id="${id}">)([\\s\\S]*?)(</pre>)`),
    `$1${escapeHtml(String(content ?? "").trim() || "No response saved.")}$3`
  );

const main = async () => {
  let html = await readFile(resolve(currentDir, "compare.html"), "utf8");
  const anthropic = await readFile(resolve(currentDir, "anthropic-opus-4-6", "response.txt"), "utf8");
  const gemini = await readFile(resolve(currentDir, "gemini-3.1-pro-preview", "response.txt"), "utf8");
  const openai = await readFile(resolve(currentDir, "gpt-5.4-high", "response.txt"), "utf8");

  html = replaceBlock(html, "anthropic-content", anthropic);
  html = replaceBlock(html, "gemini-content", gemini);
  html = replaceBlock(html, "openai-content", openai);

  await writeFile(resolve(currentDir, "compare.html"), html, "utf8");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
