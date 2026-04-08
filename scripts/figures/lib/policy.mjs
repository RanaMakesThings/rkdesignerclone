import {
  DEFAULT_POLICY_PATH,
  ASSESSOR_PROVIDERS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CLAUDE_MAX_TOKENS,
  DEFAULT_OPENAI_VISION_MODEL,
} from "./constants.mjs";
import { readJson } from "./io.mjs";

export const loadWorkflowPolicy = async (policyPath = null) => {
  const resolvedPath = policyPath ?? DEFAULT_POLICY_PATH;
  const doc = await readJson(resolvedPath);
  const provider = String(doc?.assessor?.provider ?? "auto").trim().toLowerCase();
  if (!ASSESSOR_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported assessor provider "${doc?.assessor?.provider}" in ${resolvedPath}`
    );
  }

  const explicitModel =
    typeof doc?.assessor?.model === "string" && doc.assessor.model.trim()
      ? doc.assessor.model.trim()
      : "";

  return {
    policyPath: resolvedPath,
    policy: {
      assessor: {
        provider,
        strictJson: Boolean(doc?.assessor?.strictJson ?? true),
        model:
          explicitModel ||
          (provider === "openai"
            ? DEFAULT_OPENAI_VISION_MODEL
            : provider === "claude"
              ? DEFAULT_CLAUDE_MODEL
              : ""),
        maxTokens:
          typeof doc?.assessor?.maxTokens === "number" &&
          Number.isFinite(doc.assessor.maxTokens)
            ? Math.max(256, Math.floor(doc.assessor.maxTokens))
            : DEFAULT_CLAUDE_MAX_TOKENS,
      },
    },
  };
};
