#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_GEMINI_IMAGE_ASPECT_RATIO,
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_IMAGE_SIZE,
  generateGeminiImages,
  hasGeminiApiKey,
  writeGeminiImageArtifacts,
} from "./gemini-image-client.mjs";
import {
  buildRequestDoc,
  buildResultDoc,
  getOutputsDir,
  writeJsonDoc,
  writeOptionalRawResponse,
} from "./artifact-contract.mjs";
import { callOpenAI, createResponse, hasOpenAIApiKey } from "./openai-client.mjs";
import {
  createArtifactRunSlug,
  getDesignerDataPaths,
  toDesignerDataRelativePath,
} from "../../lib/repo/designer-data.mjs";

const require = createRequire(import.meta.url);

const requireDep = (name, hint) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(name);
  } catch (_error) {
    console.error(`\nMissing dependency: ${name}`);
    if (hint) {
      console.error(hint);
    }
    console.error("Run: npm install\n");
    process.exit(1);
  }
};

const yargs = requireDep("yargs/yargs", "Needed for CLI argument parsing.");
const { hideBin } = requireDep("yargs/helpers", "Needed for CLI argument parsing.");

const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1.5";
const DEFAULT_OPENAI_REFERENCE_RUNNER_MODEL = "gpt-5.4";
const DEFAULT_OPENAI_IMAGE_SIZE = "1536x1024";
const DEFAULT_OPENAI_IMAGE_QUALITY = "high";
const DEFAULT_OPENAI_IMAGE_BACKGROUND = "opaque";
const DEFAULT_OPENAI_OUTPUT_FORMAT = "png";
const GRAPHIC_ID_PREFIX = "graphic";
const GRAPHIC_BATCH_ID_PREFIX = "graphic-batch";

const VARIANT_PRESETS = [
  {
    id: "v01-editorial",
    label: "Editorial Baseline",
    note:
      "Start with the clearest premium editorial interpretation. One strong visual idea, calm hierarchy, restrained composition, and presentation-grade polish.",
  },
  {
    id: "v02-bold",
    label: "Bold Contrast",
    note:
      "Push contrast, crop, and geometry harder. The image should still feel premium and presentation-ready, but with a sharper visual hook.",
  },
  {
    id: "v03-minimal",
    label: "Minimal Restraint",
    note:
      "Bias toward minimalism, whitespace, and reduction. Keep the image confident and resolved without becoming empty or generic.",
  },
  {
    id: "v04-atmospheric",
    label: "Atmospheric Context",
    note:
      "Allow a bit more environmental texture or mood if it helps the concept, but keep the image clean enough to live inside a pitch deck.",
  },
  {
    id: "v05-graphic",
    label: "Graphic Object",
    note:
      "Lean into a more graphic, object-led interpretation with crisp silhouette, simplified forms, and strong deck-friendly readability.",
  },
  {
    id: "v06-quiet-photo",
    label: "Quiet Photo-Hybrid",
    note:
      "If the spec benefits from realism, allow a quiet photo-hybrid treatment with tasteful abstraction and no stock-photo energy.",
  },
];

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "presentation-images";

const toVersionId = (value) => `version-${String(value).padStart(2, "0")}`;

const toVersionLabel = (value) => `Version ${String(value).padStart(2, "0")}`;

const toGraphicId = (value) =>
  `${GRAPHIC_ID_PREFIX}-${String(value).padStart(6, "0")}`;

const toGraphicBatchId = (value) =>
  `${GRAPHIC_BATCH_ID_PREFIX}-${String(value).padStart(6, "0")}`;

const isWithinRoot = (rootPath, candidatePath) => {
  const normalizedRoot = resolve(rootPath);
  const normalizedCandidate = resolve(candidatePath);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
};

const formatProviderLabel = (provider) => {
  if (provider === "openai") {
    return "OpenAI";
  }
  if (provider === "gemini") {
    return "Gemini";
  }
  return String(provider ?? "");
};

export const buildBatchPlan = ({ providers, variants }) => {
  const plan = [];
  let versionNumber = 1;

  for (const provider of providers) {
    for (const variant of variants) {
      const versionId = toVersionId(versionNumber);
      plan.push({
        provider,
        variant,
        versionNumber,
        versionId,
        versionLabel: toVersionLabel(versionNumber),
        artifactSlug: `${versionId}--${slugify(variant.label)}`,
      });
      versionNumber += 1;
    }
  }

  return plan;
};

export const resolveOpenAIReferenceRunnerModel = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return DEFAULT_OPENAI_REFERENCE_RUNNER_MODEL;
  }

  if (/^gpt-image-/i.test(normalized)) {
    return DEFAULT_OPENAI_REFERENCE_RUNNER_MODEL;
  }

  return normalized;
};

const parseNumberedId = (value, prefix) => {
  const match = String(value ?? "").match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  return match ? Number(match[1]) : null;
};

const parseGraphicIdNumber = (value) => parseNumberedId(value, GRAPHIC_ID_PREFIX);

const parseGraphicBatchIdNumber = (value) =>
  parseNumberedId(value, GRAPHIC_BATCH_ID_PREFIX);

const parseVersionIdNumber = (value) => parseNumberedId(value, "version");

const normalizeGraphicResult = (result, index) => {
  const rawVersionNumber = Number(result?.versionNumber);
  const versionNumber =
    Number.isInteger(rawVersionNumber) && rawVersionNumber > 0
      ? rawVersionNumber
      : parseVersionIdNumber(result?.versionId) ?? index + 1;

  return {
    ...result,
    versionNumber,
    versionId: String(result?.versionId ?? "").trim() || toVersionId(versionNumber),
    versionLabel:
      String(result?.versionLabel ?? "").trim() || toVersionLabel(versionNumber),
  };
};

const sortByCreatedAtThenPath = (left, right) => {
  const leftTime = left.generatedAt ? Date.parse(left.generatedAt) : 0;
  const rightTime = right.generatedAt ? Date.parse(right.generatedAt) : 0;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.path.localeCompare(right.path);
};

const buildGraphicResultKey = (result) =>
  [
    String(result?.provider ?? "").trim().toLowerCase(),
    String(result?.versionId ?? "").trim().toLowerCase(),
    String(result?.variantId ?? "").trim().toLowerCase(),
    String(result?.versionLabel ?? "").trim().toLowerCase(),
    String(result?.variantLabel ?? "").trim().toLowerCase(),
  ].join("::");

const normalizePresentationImageRoots = (rootDir) =>
  [...new Set((Array.isArray(rootDir) ? rootDir : [rootDir]).filter(Boolean).map((value) => resolve(value)))];

const listPresentationImageManifestPaths = async (rootDir) => {
  const manifestPaths = [];
  for (const normalizedRoot of normalizePresentationImageRoots(rootDir)) {
    if (!existsSync(normalizedRoot)) {
      continue;
    }
    const entries = await readdir(normalizedRoot, { withFileTypes: true });
    manifestPaths.push(
      ...entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(normalizedRoot, entry.name, "manifest.json"))
        .filter((manifestPath) => existsSync(manifestPath))
    );
  }
  return manifestPaths;
};

const readJsonFile = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

export const assignGraphicIdsToManifest = async ({
  rootDir,
  outputDir,
  manifest,
}) => {
  const manifestPaths = await listPresentationImageManifestPaths(rootDir);
  const currentManifestPath = resolve(outputDir, "manifest.json");

  let maxGraphicNumber = 0;
  let maxBatchNumber = 0;
  const existingGraphicIdByKey = new Map();

  for (const manifestPath of manifestPaths) {
    const existingManifest = await readJsonFile(manifestPath);

    const existingBatchNumber = parseGraphicBatchIdNumber(existingManifest?.batchId);
    if (existingBatchNumber && existingBatchNumber > maxBatchNumber) {
      maxBatchNumber = existingBatchNumber;
    }

    for (const [index, rawResult] of Array.isArray(existingManifest?.results)
      ? existingManifest.results.entries()
      : []) {
      const result = normalizeGraphicResult(rawResult, index);
      const existingGraphicNumber = parseGraphicIdNumber(result?.graphicId);
      if (existingGraphicNumber && existingGraphicNumber > maxGraphicNumber) {
        maxGraphicNumber = existingGraphicNumber;
      }
      if (
        manifestPath === currentManifestPath &&
        existingGraphicNumber &&
        result
      ) {
        existingGraphicIdByKey.set(
          buildGraphicResultKey(result),
          toGraphicId(existingGraphicNumber)
        );
      }
    }
  }

  const normalizedResults = (Array.isArray(manifest?.results) ? manifest.results : []).map(
    (result, index) => normalizeGraphicResult(result, index)
  );

  const currentBatchNumber =
    parseGraphicBatchIdNumber(manifest?.batchId) ??
    parseGraphicBatchIdNumber(
      existsSync(currentManifestPath)
        ? (await readJsonFile(currentManifestPath))?.batchId
        : null
    );

  let nextGraphicNumber = maxGraphicNumber + 1;
  const nextResults = normalizedResults.map((result) => {
      const existingGraphicId =
        existingGraphicIdByKey.get(buildGraphicResultKey(result)) ??
        (parseGraphicIdNumber(result?.graphicId)
          ? String(result.graphicId)
          : null);

      return {
        ...result,
        graphicId: existingGraphicId ?? toGraphicId(nextGraphicNumber++),
      };
    });

  return {
    ...manifest,
    batchId:
      currentBatchNumber != null
        ? toGraphicBatchId(currentBatchNumber)
        : toGraphicBatchId(maxBatchNumber + 1),
    results: nextResults,
  };
};

const toStoredArtifactPath = ({ designerDataPaths, absolutePath }) =>
  toDesignerDataRelativePath(designerDataPaths.dataRoot, absolutePath) ??
  resolve(absolutePath);

export const backfillPresentationImageGraphicIds = async ({
  rootDir,
}) => {
  const manifestPaths = await listPresentationImageManifestPaths(rootDir);
  const manifests = await Promise.all(
    manifestPaths.map(async (manifestPath) => {
      const manifest = await readJsonFile(manifestPath);
      return {
        path: manifestPath,
        outputDir: resolve(manifestPath, ".."),
        manifest,
        generatedAt: manifest?.generatedAt ?? null,
      };
    })
  );

  manifests.sort(sortByCreatedAtThenPath);

  let maxGraphicNumber = 0;
  let maxBatchNumber = 0;

  for (const entry of manifests) {
    const manifest = entry.manifest ?? {};
    const existingBatchNumber = parseGraphicBatchIdNumber(manifest.batchId);
    const batchId =
      existingBatchNumber != null
        ? toGraphicBatchId(existingBatchNumber)
        : toGraphicBatchId(maxBatchNumber + 1);
    maxBatchNumber = Math.max(
      maxBatchNumber,
      parseGraphicBatchIdNumber(batchId) ?? maxBatchNumber
    );

    const nextResults = (Array.isArray(manifest.results) ? manifest.results : []).map(
      (result, index) => {
        const normalizedResult = normalizeGraphicResult(result, index);
        const existingGraphicNumber = parseGraphicIdNumber(result?.graphicId);
        const graphicId =
          existingGraphicNumber != null
            ? toGraphicId(existingGraphicNumber)
            : toGraphicId(maxGraphicNumber + 1);
        maxGraphicNumber = Math.max(
          maxGraphicNumber,
          parseGraphicIdNumber(graphicId) ?? maxGraphicNumber
        );
        return {
          ...normalizedResult,
          graphicId,
        };
      }
    );

    const nextManifest = {
      ...manifest,
      batchId,
      results: nextResults,
    };

    const specPath = resolve(entry.outputDir, "spec.txt");
    const spec = existsSync(specPath) ? (await readFile(specPath, "utf8")).trim() : "";

    await writeFile(
      entry.path,
      `${JSON.stringify(nextManifest, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      resolve(entry.outputDir, "summary.md"),
      renderSummary({
        dir: nextManifest.dir ?? entry.outputDir,
        spec,
        providers: Array.isArray(nextManifest.providers)
          ? nextManifest.providers
          : [],
        results: nextManifest.results ?? [],
      }),
      "utf8"
    );
  }
};

const readStdinText = async () => {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
};

const resolveSpec = async (argv) => {
  if (argv.spec && argv.specFile) {
    throw new Error("Use only one of --spec or --spec-file.");
  }

  if (argv.spec) {
    return String(argv.spec).trim();
  }

  if (argv.specFile) {
    return (await readFile(resolve(String(argv.specFile)), "utf8")).trim();
  }

  const stdinText = await readStdinText();
  if (stdinText.trim()) {
    return stdinText.trim();
  }

  throw new Error("Provide a spec via --spec, --spec-file, or stdin.");
};

export const buildPresentationPrompt = ({ spec, variant }) =>
  [
    "We are making a single image graphic for a pitch deck or presentation.",
    "Treat the following input as a design spec, not as a conversational prompt.",
    "Return one polished 16:9 image concept that feels premium, intentional, and presentation-ready.",
    "Do not generate browser chrome, UI screenshots, device mockups, or a slide-within-a-slide.",
    "Do not add on-image text unless the spec explicitly asks for it.",
    "Avoid generic stock-photo energy, generic SaaS dashboard imagery, and weak filler composition.",
    "",
    `Variant direction: ${variant.label}. ${variant.note}`,
    "",
    "Design spec:",
    spec.trim(),
  ].join("\n");

const readOpenAIImageInput = async (imagePath) => {
  const filePath = resolve(String(imagePath));
  const raw = await readFile(filePath);
  const mimeType = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : filePath.toLowerCase().match(/\.(jpe?g)$/)
      ? "image/jpeg"
      : filePath.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : filePath.toLowerCase().endsWith(".gif")
          ? "image/gif"
          : filePath.toLowerCase().endsWith(".svg")
            ? "image/svg+xml"
            : null;

  if (!mimeType) {
    throw new Error(`Unsupported image type for OpenAI image input: ${filePath}`);
  }

  return {
    type: "input_image",
    image_url: `data:${mimeType};base64,${raw.toString("base64")}`,
  };
};

const extractOpenAIResponseImageBase64 = (payload) => {
  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputItems) {
    if (item?.type === "image_generation_call" && typeof item.result === "string") {
      return item.result.trim();
    }
  }
  return "";
};

const extensionFromOutputFormat = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "jpeg" || normalized === "jpg") {
    return "jpg";
  }
  if (normalized === "webp") {
    return "webp";
  }
  return "png";
};

const generateOpenAIImage = async ({
  prompt,
  model,
  size,
  quality,
  background,
  outputFormat,
  images = [],
}) => {
  const imagePaths = Array.isArray(images) ? images : [];
  if (imagePaths.length > 0) {
    const requestModel = resolveOpenAIReferenceRunnerModel(model);
    const content = [];
    for (const imagePath of imagePaths) {
      content.push(await readOpenAIImageInput(imagePath));
    }
    content.push({
      type: "input_text",
      text: prompt,
    });

    const payload = await createResponse({
      model: requestModel,
      input: [
        {
          role: "user",
          content,
        },
      ],
      max_output_tokens: 2000,
      tools: [
        {
          type: "image_generation",
          size,
          quality,
          background,
        },
      ],
    });

    const imageBase64 = extractOpenAIResponseImageBase64(payload);
    if (!imageBase64) {
      throw new Error("OpenAI returned no image-generation result.");
    }

    return {
      raw: payload,
      requestModel,
      revisedPrompt:
        typeof payload?.output_text === "string" ? payload.output_text.trim() : "",
      imageBase64,
    };
  }

  const payload = await callOpenAI({
    method: "POST",
    path: "/images/generations",
    json: {
      model,
      prompt,
      n: 1,
      size,
      quality,
      background,
      output_format: outputFormat,
    },
  });

  const imageEntry = Array.isArray(payload?.data) ? payload.data[0] : null;
  const imageBase64 =
    typeof imageEntry?.b64_json === "string" ? imageEntry.b64_json.trim() : "";

  if (!imageBase64) {
    throw new Error("OpenAI returned no image payload.");
  }

  return {
    raw: payload,
    revisedPrompt:
      typeof imageEntry?.revised_prompt === "string"
        ? imageEntry.revised_prompt.trim()
        : "",
    imageBase64,
  };
};

const writeOpenAIImageArtifacts = async ({
  dir,
  prompt,
  model,
  size,
  quality,
  background,
  outputFormat,
  result,
  referenceImages = [],
  saveRaw = false,
  variantId = null,
  variantLabel = null,
  elapsedMs = null,
}) => {
  const outputDir = resolve(dir);
  await mkdir(outputDir, { recursive: true });
  const outputsDir = getOutputsDir(outputDir);
  await mkdir(outputsDir, { recursive: true });

  const imagePath = resolve(
    outputsDir,
    `image-01.${extensionFromOutputFormat(outputFormat)}`
  );
  await writeFile(imagePath, Buffer.from(result.imageBase64, "base64"));
  await writeFile(resolve(outputDir, "prompt.txt"), `${prompt.trim()}\n`, "utf8");
  await writeJsonDoc(
    resolve(outputDir, "request.json"),
    buildRequestDoc({
      provider: "openai",
      model,
      requestModel: result.requestModel ?? null,
      size,
      quality,
      background,
      outputFormat,
      referenceImages,
    })
  );
  await writeJsonDoc(
    resolve(outputDir, "result.json"),
    buildResultDoc({
      provider: "openai",
      model,
      created_at: new Date().toISOString(),
      outputs: [`outputs/${basename(imagePath)}`],
      variant_id: variantId,
      variant_label: variantLabel,
      width: null,
      height: null,
      elapsed_ms: elapsedMs,
      text: result.revisedPrompt || null,
    })
  );
  await writeOptionalRawResponse({
    outputDir,
    payload: result.raw,
    saveRaw,
  });
  if (result.revisedPrompt) {
    await writeFile(
      resolve(outputDir, "response.txt"),
      `${result.revisedPrompt}\n`,
      "utf8"
    );
  }

  return {
    dir: outputDir,
    imagePath,
    basename: basename(outputDir),
  };
};

const formatResultLabel = (result) => {
  const identity = result.graphicId
    ? `\`${result.graphicId}\` · ${result.versionLabel}`
    : result.versionLabel;
  return `${identity}: ${formatProviderLabel(result.provider)} / ${result.variantLabel} (\`${result.variantId}\`)`;
};

export const renderSummary = ({ dir, spec, providers, results }) => {
  const lines = [
    "# Presentation Image Batch",
    "",
    `- output dir: \`${dir}\``,
    `- providers: ${providers.map((provider) => `\`${provider}\``).join(", ")}`,
    "",
    "## Spec",
    "",
    "```md",
    spec.trim(),
    "```",
    "",
    "## Results",
    "",
  ];

  for (const result of results) {
    if (result.ok) {
      lines.push(`- ${formatResultLabel(result)}: \`${result.imagePath}\``);
    } else {
      lines.push(`- ${formatResultLabel(result)}: failed - ${result.error}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
};

export const runPresentationImagesCli = async (rawArgv = hideBin(process.argv)) =>
  yargs(rawArgv)
    .scriptName("presentation:images")
    .usage("Usage: npm run presentation:images -- [options]")
    .option("spec", {
      type: "string",
      describe: "Inline design spec for the presentation image batch",
    })
    .option("spec-file", {
      type: "string",
      describe: "Read the design spec from a file",
    })
    .option("provider", {
      type: "string",
      choices: ["both", "gemini", "openai"],
      default: "both",
      describe: "Which provider batch to run",
    })
    .option("image", {
      type: "array",
      string: true,
      default: [],
      describe: "One or more local reference images to send with each provider run",
    })
    .option("count-per-provider", {
      type: "number",
      default: 3,
      describe: "How many prompt variations to run per provider",
    })
    .option("slug", {
      type: "string",
      describe: "Output slug; defaults to a spec-derived slug",
    })
    .option("out", {
      type: "string",
      describe: "Explicit output directory",
    })
    .option("gemini-model", {
      type: "string",
      default: DEFAULT_GEMINI_IMAGE_MODEL,
      describe: "Gemini image model ID",
    })
    .option("gemini-aspect-ratio", {
      type: "string",
      default: DEFAULT_GEMINI_IMAGE_ASPECT_RATIO,
      describe: "Gemini aspect ratio",
    })
    .option("gemini-image-size", {
      type: "string",
      default: DEFAULT_GEMINI_IMAGE_SIZE,
      describe: "Gemini image size",
    })
    .option("openai-model", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_MODEL,
      describe: "OpenAI image model ID",
    })
    .option("openai-size", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_SIZE,
      describe: "OpenAI image size",
    })
    .option("openai-quality", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_QUALITY,
      describe: "OpenAI image quality",
    })
    .option("openai-background", {
      type: "string",
      default: DEFAULT_OPENAI_IMAGE_BACKGROUND,
      describe: "OpenAI image background mode",
    })
    .option("openai-output-format", {
      type: "string",
      default: DEFAULT_OPENAI_OUTPUT_FORMAT,
      describe: "OpenAI output format",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print manifest metadata as JSON",
    })
    .option("save-raw", {
      type: "boolean",
      default: false,
      describe: "Persist sanitized raw provider responses under debug/response.json",
    })
    .strict()
    .help()
    .parseAsync()
    .then(async (argv) => {
      const spec = await resolveSpec(argv);
      const countPerProvider = Number(argv.countPerProvider);
      if (!Number.isInteger(countPerProvider) || countPerProvider < 1) {
        throw new Error("--count-per-provider must be a positive integer.");
      }
      if (countPerProvider > VARIANT_PRESETS.length) {
        throw new Error(
          `--count-per-provider must be <= ${VARIANT_PRESETS.length}.`
        );
      }

      const slug = argv.slug ? slugify(argv.slug) : slugify(spec);
      const designerDataPaths = getDesignerDataPaths({ cwd: process.cwd() });
      const projectRunsRoot = resolve(designerDataPaths.runsRoot, "designer-health");
      const studioRepoGraphicsRoot = resolve(
        designerDataPaths.repoRoot,
        "output",
        "figures",
        "presentation-images"
      );
      const outputDir = argv.out
        ? resolve(String(argv.out))
        : resolve(projectRunsRoot, createArtifactRunSlug({ slug }));

      if (
        argv.out &&
        !isWithinRoot(projectRunsRoot, outputDir) &&
        !isWithinRoot(studioRepoGraphicsRoot, outputDir)
      ) {
        console.warn(
          [
            "Warning: this --out path is outside Design Studio's indexed graphics roots",
            `for the current checkout.`,
            `Studio in this repo scans:`,
            `- ${studioRepoGraphicsRoot}`,
            `- ${projectRunsRoot}`,
            `This batch may not appear in the current Design Studio unless you write it`,
            `under one of those locations or sync it afterward.`,
          ].join("\n")
        );
      }

      const selectedVariants = VARIANT_PRESETS.slice(0, countPerProvider);
      const providers =
        argv.provider === "both" ? ["gemini", "openai"] : [String(argv.provider)];
      const inputImages = Array.isArray(argv.image)
        ? argv.image.map((value) => resolve(String(value)))
        : [];
      const batchPlan = buildBatchPlan({
        providers,
        variants: selectedVariants,
      });

      if (providers.includes("gemini") && !hasGeminiApiKey()) {
        throw new Error("Missing GEMINI_API_KEY for Gemini batch generation.");
      }
      if (providers.includes("openai") && !hasOpenAIApiKey()) {
        throw new Error("Missing OPENAI_API_KEY for OpenAI batch generation.");
      }

      await mkdir(outputDir, { recursive: true });
      await writeFile(resolve(outputDir, "spec.txt"), `${spec.trim()}\n`, "utf8");

      const tasks = batchPlan.map((planItem) =>
        (async () => {
          const { provider, variant, versionNumber, versionId, versionLabel, artifactSlug } =
            planItem;
          const prompt = buildPresentationPrompt({ spec, variant });
          const artifactDir = resolve(outputDir, provider, artifactSlug);
          const referenceImages = inputImages;

          if (provider === "gemini") {
            const startedAt = Date.now();
            const result = await generateGeminiImages({
              prompt,
              model: String(argv.geminiModel),
              aspectRatio: String(argv.geminiAspectRatio),
              imageSize: String(argv.geminiImageSize),
              images: inputImages,
            });
            const elapsedMs = Date.now() - startedAt;
            const artifacts = await writeGeminiImageArtifacts({
              dir: artifactDir,
              prompt,
              model: String(argv.geminiModel),
              aspectRatio: String(argv.geminiAspectRatio),
              imageSize: String(argv.geminiImageSize),
              result,
              referenceImages,
              saveRaw: Boolean(argv.saveRaw),
              variantId: variant.id,
              variantLabel: variant.label,
              elapsedMs,
            });
            return {
              ok: true,
              versionNumber,
              versionId,
              versionLabel,
              provider,
              variantId: variant.id,
              variantLabel: variant.label,
              dir: toStoredArtifactPath({
                designerDataPaths,
                absolutePath: artifacts.dir,
              }),
              imagePath: toStoredArtifactPath({
                designerDataPaths,
                absolutePath: artifacts.primary,
              }),
              requestPath: toStoredArtifactPath({
                designerDataPaths,
                absolutePath: resolve(artifacts.dir, "request.json"),
              }),
              resultPath: toStoredArtifactPath({
                designerDataPaths,
                absolutePath: resolve(artifacts.dir, "result.json"),
              }),
            };
          }

          const startedAt = Date.now();
          const result = await generateOpenAIImage({
            prompt,
            model: String(argv.openaiModel),
            size: String(argv.openaiSize),
            quality: String(argv.openaiQuality),
            background: String(argv.openaiBackground),
            outputFormat: String(argv.openaiOutputFormat),
            images: inputImages,
          });
          const elapsedMs = Date.now() - startedAt;
          const artifacts = await writeOpenAIImageArtifacts({
            dir: artifactDir,
            prompt,
            model: String(argv.openaiModel),
            size: String(argv.openaiSize),
            quality: String(argv.openaiQuality),
            background: String(argv.openaiBackground),
            outputFormat: String(argv.openaiOutputFormat),
            result,
            referenceImages,
            saveRaw: Boolean(argv.saveRaw),
            variantId: variant.id,
            variantLabel: variant.label,
            elapsedMs,
          });
          return {
            ok: true,
            versionNumber,
            versionId,
            versionLabel,
            provider,
            variantId: variant.id,
            variantLabel: variant.label,
            dir: toStoredArtifactPath({
              designerDataPaths,
              absolutePath: artifacts.dir,
            }),
            imagePath: toStoredArtifactPath({
              designerDataPaths,
              absolutePath: artifacts.imagePath,
            }),
            requestPath: toStoredArtifactPath({
              designerDataPaths,
              absolutePath: resolve(artifacts.dir, "request.json"),
            }),
            resultPath: toStoredArtifactPath({
              designerDataPaths,
              absolutePath: resolve(artifacts.dir, "result.json"),
            }),
          };
        })().catch((error) => ({
          ok: false,
          versionNumber: planItem.versionNumber,
          versionId: planItem.versionId,
          versionLabel: planItem.versionLabel,
          provider: planItem.provider,
          variantId: planItem.variant.id,
          variantLabel: planItem.variant.label,
          error: error instanceof Error ? error.message : String(error),
        }))
      );

      const results = await Promise.all(tasks);
      const manifest = await assignGraphicIdsToManifest({
        rootDir: [
          designerDataPaths.legacyPresentationImagesRoot,
          projectRunsRoot,
        ],
        outputDir,
        manifest: {
          ok: results.some((result) => result.ok),
          generatedAt: new Date().toISOString(),
          slug,
          dir: toStoredArtifactPath({
            designerDataPaths,
            absolutePath: outputDir,
          }),
          providers,
          countPerProvider,
          versionCount: batchPlan.length,
          variants: selectedVariants.map((variant) => ({
            id: variant.id,
            label: variant.label,
            note: variant.note,
          })),
          results,
        },
      });

      await writeFile(
        resolve(outputDir, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8"
      );
      await writeFile(
        resolve(outputDir, "summary.md"),
        renderSummary({
          dir: outputDir,
          spec,
          providers,
          results: manifest.results,
        }),
        "utf8"
      );

      if (argv.json) {
        process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
        return;
      }

      process.stdout.write(`Generated presentation image batch\n${outputDir}\n`);
      for (const result of results) {
        const graphicId =
          manifest.results.find(
            (entry) =>
              entry.provider === result.provider &&
              entry.versionId === result.versionId &&
              entry.variantId === result.variantId
          )?.graphicId ?? null;
        if (result.ok) {
          process.stdout.write(
            `${graphicId ?? "graphic-pending"} ${result.versionId} ${formatProviderLabel(result.provider)} ${result.variantLabel} (${result.variantId}) ${result.imagePath}\n`
          );
        } else {
          process.stdout.write(
            `${graphicId ?? "graphic-pending"} ${result.versionId} ${formatProviderLabel(result.provider)} ${result.variantLabel} (${result.variantId}) failed ${result.error}\n`
          );
        }
      }
    });

const isMainModule = () =>
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule()) {
  runPresentationImagesCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
