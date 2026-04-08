import {
  ASSET_PROVIDERS,
  DEFAULT_ASSET_CANDIDATES,
  DEFAULT_ASSET_PROVIDER,
  MEDIA_COPY_SAFE_ZONES,
  MEDIA_SLOT_ORIENTATIONS,
} from "./constants.mjs";
import { getArg, hasFlag } from "./io.mjs";

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image-request";

export const parseStandaloneImageRequestArgs = (args) => {
  const purpose = String(getArg(args, "purpose") ?? "").trim();
  if (!purpose) {
    throw new Error("Missing --purpose. Pass a short description of the image need.");
  }

  const orientation = String(getArg(args, "orientation") ?? "").trim();
  if (orientation && !MEDIA_SLOT_ORIENTATIONS.has(orientation)) {
    throw new Error(
      `Invalid --orientation "${orientation}". Use landscape, portrait, or square.`
    );
  }

  const color = String(getArg(args, "color") ?? "").trim();
  const style = String(getArg(args, "style") ?? "").trim();
  const mood = String(getArg(args, "mood") ?? "").trim();
  const shot = String(getArg(args, "shot") ?? "").trim();
  const people = String(getArg(args, "people") ?? "").trim();
  const copySafe = String(getArg(args, "copy-safe") ?? "").trim();
  if (copySafe && !MEDIA_COPY_SAFE_ZONES.has(copySafe)) {
    throw new Error(
      `Invalid --copy-safe "${copySafe}". Use left, right, top, bottom, or center.`
    );
  }

  const provider = String(
    getArg(args, "provider") ?? DEFAULT_ASSET_PROVIDER
  ).trim();
  if (!ASSET_PROVIDERS.has(provider)) {
    throw new Error(
      `Invalid --provider "${provider}". Supported providers: ${Array.from(
        ASSET_PROVIDERS
      ).join(", ")}.`
    );
  }

  const reuseFrom = String(getArg(args, "reuse-from") ?? "").trim();
  const countText = getArg(args, "count");
  const count =
    countText === null
      ? DEFAULT_ASSET_CANDIDATES
      : Number(String(countText));

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Invalid --count. Use a positive integer.");
  }

  return {
    mode: "standalone",
    purpose,
    orientation,
    color,
    style,
    mood,
    shot,
    people,
    copySafe,
    provider,
    approvedOnly: hasFlag(args, "approved-only"),
    reuseFrom,
    count,
    slug: String(getArg(args, "slug") ?? "").trim() || slugify(purpose),
    outputDir: getArg(args, "out"),
    download: !hasFlag(args, "no-download"),
  };
};
