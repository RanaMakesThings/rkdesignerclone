import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { callOpenAI, extractResponseText } from "../../../../scripts/llm/openai-client.mjs";

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const currentDir = dirname(fileURLToPath(import.meta.url));
const promptPath = resolve(currentDir, "shared-prompt.md");
const outDir = resolve(currentDir, "gpt-5.4-high");

const pollUntilDone = async (responseId, maxAttempts = 30, pollMs = 10000) => {
  let payload = await callOpenAI({
    method: "GET",
    path: `/responses/${responseId}`,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (
      payload.status === "completed" ||
      payload.status === "failed" ||
      payload.status === "cancelled" ||
      payload.status === "incomplete"
    ) {
      return payload;
    }
    await sleep(pollMs);
    payload = await callOpenAI({
      method: "GET",
      path: `/responses/${responseId}`,
    });
  }

  return payload;
};

const main = async () => {
  await mkdir(outDir, { recursive: true });
  const prompt = await readFile(promptPath, "utf8");

  const created = await callOpenAI({
    method: "POST",
    path: "/responses",
    json: {
      model: "gpt-5.4",
      background: true,
      reasoning: { effort: "high" },
      text: { verbosity: "medium" },
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      max_output_tokens: 12000,
    },
  });

  const payload = await pollUntilDone(created.id, 30, 10000);
  const text = extractResponseText(payload) || "";

  await writeFile(resolve(outDir, "prompt.txt"), prompt.endsWith("\n") ? prompt : `${prompt}\n`, "utf8");
  await writeFile(
    resolve(outDir, "meta.json"),
    `${JSON.stringify(
      {
        model: "gpt-5.4",
        reasoning: { effort: "high" },
        text: { verbosity: "medium" },
        max_output_tokens: 12000,
        mode: "background-poll",
        responseId: created.id,
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
        responseId: created.id,
        status: payload.status,
        outputTokens: payload.usage?.output_tokens ?? null,
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
