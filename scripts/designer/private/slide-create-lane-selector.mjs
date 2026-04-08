const EXPLICIT_LANES = new Set(["html", "native", "hybrid"]);

export const selectSlideCreateLane = ({
  deckSlide,
  referenceImagePaths = [],
  explicitLane = "auto",
}) => {
  const normalizedExplicit = String(explicitLane ?? "auto").trim().toLowerCase();
  if (EXPLICIT_LANES.has(normalizedExplicit)) {
    return {
      lane: normalizedExplicit,
      reason: `Explicit lane override selected: ${normalizedExplicit}.`,
      confidence: 1,
      fallbackLane: "html",
    };
  }

  if (Array.isArray(referenceImagePaths) && referenceImagePaths.length > 0) {
    return {
      lane: "hybrid",
      reason: "Reference images were provided, so v1 routes through the hybrid bootstrap.",
      confidence: 0.95,
      fallbackLane: "html",
    };
  }

  const slideTitle = String(deckSlide?.title ?? deckSlide?.id ?? "this slide");
  return {
    lane: "html",
    reason: `${slideTitle} defaults to the template-seeded HTML lane in v1.`,
    confidence: 0.8,
    fallbackLane: "html",
  };
};
