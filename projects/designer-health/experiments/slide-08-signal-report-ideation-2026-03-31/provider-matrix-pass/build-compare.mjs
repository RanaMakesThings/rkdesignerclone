import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

const specs = [
  { key: "anthropic-vertical", label: "Anthropic Vertical" },
  { key: "gemini-two-column", label: "Gemini Two-Column" },
  { key: "gpt-hybrid", label: "GPT Hybrid" },
];

const providers = [
  { key: "gemini-image", label: "Gemini Image", kind: "image" },
  { key: "gemini-html", label: "Gemini HTML", kind: "html" },
  { key: "openai-html", label: "OpenAI HTML", kind: "html" },
  { key: "anthropic-html", label: "Anthropic HTML", kind: "html" },
];

const findExisting = (paths) => paths.find((path) => existsSync(path)) || null;

const rel = (target) => relative(currentDir, target).replaceAll("\\", "/");

const cardFor = (spec, provider) => {
  const dir = resolve(currentDir, "variants", spec.key, provider.key);
  const preview = provider.kind === "image"
    ? findExisting([
        resolve(dir, "image-01.png"),
        resolve(dir, "image-01.jpg"),
        resolve(dir, "image-01.jpeg"),
        resolve(dir, "image-01.webp"),
      ])
    : findExisting([resolve(dir, "preview.png")]);
  const prompt = findExisting([resolve(dir, "prompt.txt")]);
  const response = findExisting([
    resolve(dir, "response.txt"),
    resolve(dir, "response.json"),
  ]);
  const html = findExisting([resolve(dir, "generated.html")]);
  const meta = findExisting([resolve(dir, "meta.json")]);

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3>${spec.label}</h3>
          <p>${provider.label}</p>
        </div>
      </div>
      ${
        preview
          ? `<a class="thumb" href="./${rel(preview)}"><img src="./${rel(preview)}" alt="${spec.label} ${provider.label} preview" /></a>`
          : `<div class="thumb empty">Pending preview</div>`
      }
      <div class="links">
        ${prompt ? `<a href="./${rel(prompt)}">prompt</a>` : ""}
        ${response ? `<a href="./${rel(response)}">${basename(response)}</a>` : ""}
        ${html ? `<a href="./${rel(html)}">html</a>` : ""}
        ${meta ? `<a href="./${rel(meta)}">meta</a>` : ""}
      </div>
    </article>
  `;
};

const main = async () => {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Slide 08 Provider Matrix</title>
    <style>
      :root {
        --bg: #f4f0e8;
        --panel: #fffdf8;
        --ink: #1f242b;
        --muted: #69727f;
        --line: #d8d2c7;
        --accent: #21465f;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 28px;
        background:
          radial-gradient(circle at top left, rgba(33,70,95,0.08), transparent 24%),
          linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
        color: var(--ink);
        font-family: "Iowan Old Style", Georgia, serif;
      }
      main { max-width: 1800px; margin: 0 auto; }
      h1,h2,h3,p { margin: 0; }
      .hero { margin-bottom: 24px; }
      .eyebrow {
        color: var(--accent);
        font: 700 12px/1.2 "Helvetica Neue", Arial, sans-serif;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .hero h1 { font-size: 34px; letter-spacing: -0.03em; }
      .hero p {
        margin-top: 10px;
        max-width: 980px;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.5;
      }
      .section { margin-top: 28px; }
      .section h2 { margin-bottom: 14px; font-size: 24px; }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }
      .card {
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--panel);
        box-shadow: 0 12px 30px rgba(31,36,43,0.05);
      }
      .card-head {
        margin-bottom: 12px;
      }
      .card-head h3 { font-size: 18px; }
      .card-head p {
        margin-top: 4px;
        color: var(--muted);
        font: 500 12px/1.3 "Helvetica Neue", Arial, sans-serif;
      }
      .thumb {
        display: block;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid var(--line);
        background: #f3f4f6;
        aspect-ratio: 16 / 9;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .thumb.empty {
        display: grid;
        place-items: center;
        color: var(--muted);
        font: 500 13px/1.3 "Helvetica Neue", Arial, sans-serif;
      }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .links a {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        color: var(--accent);
        text-decoration: none;
        font: 600 12px/1.2 "Helvetica Neue", Arial, sans-serif;
        background: rgba(255,255,255,0.75);
      }
      @media (max-width: 1400px) {
        .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 800px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">Designer Health / Slide 08 / Provider Matrix</div>
        <h1>Three Specs Across Four Generation Branches</h1>
        <p>
          This matrix runs the three detailed signal-report directions across Gemini image,
          Gemini HTML, OpenAI HTML, and Anthropic HTML using the same screenshot family anchor.
        </p>
      </section>
      ${specs
        .map(
          (spec) => `
        <section class="section">
          <h2>${spec.label}</h2>
          <div class="grid">
            ${providers.map((provider) => cardFor(spec, provider)).join("\n")}
          </div>
        </section>`
        )
        .join("\n")}
    </main>
  </body>
</html>
`;

  await writeFile(resolve(currentDir, "compare.html"), html, "utf8");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
