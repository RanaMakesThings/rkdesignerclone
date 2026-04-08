import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createResponse, extractResponseText } from "../../../../../scripts/llm/openai-client.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const imagePath = "/Users/kabeer/Desktop/Screenshot 2026-03-31 at 5.24.45 PM.png";

const readImageInput = async (filePath) => {
  const raw = await readFile(filePath);
  return {
    type: "input_image",
    image_url: `data:image/png;base64,${raw.toString("base64")}`,
  };
};

const main = async () => {
  const outDir = resolve(currentDir, "gpt-5.4-high");
  const promptPath = resolve(outDir, "prompt.txt");

  await mkdir(outDir, { recursive: true });
  const prompt = await readFile(promptPath, "utf8");
  const imageBlock = await readImageInput(imagePath);

  const payload = await createResponse({
    model: "gpt-5.4",
    reasoning: { effort: "high" },
    text: { verbosity: "medium" },
    input: [
      {
        role: "user",
        content: [imageBlock, { type: "input_text", text: prompt }],
      },
    ],
    max_output_tokens: 12000,
  });

  const text = extractResponseText(payload) || "";

  await writeFile(
    resolve(outDir, "meta.json"),
    `${JSON.stringify(
      {
        model: "gpt-5.4",
        reasoning: { effort: "high" },
        text: { verbosity: "medium" },
        max_output_tokens: 12000,
        image: imagePath,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(resolve(outDir, "response.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(resolve(outDir, "response.txt"), text.endsWith("\n") ? text : `${text}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        status: payload.status,
        textLength: text.length,
      },
      null,
      2
    )}\n`
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
