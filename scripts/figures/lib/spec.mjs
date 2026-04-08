import { resolve } from "node:path";
import {
  ASSET_PROVIDERS,
  DEFAULT_ASSET_PROVIDER,
  DEFAULT_ASSET_CANDIDATES,
  MEDIA_CLUTTER_TARGETS,
  MEDIA_COPY_SAFE_ZONES,
  FAMILY_REQUIREMENTS,
  FIGURE_FAMILIES,
  MEDIA_SLOT_ORIENTATIONS,
  MEDIA_SLOT_ROLES,
  MEDIA_STRATEGIES,
  TRACE_RULE_TYPES,
} from "./constants.mjs";
import { readJson } from "./io.mjs";

const SPEC_VERSION = 1;

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

export const get = (value, dottedPath) =>
  dottedPath.split(".").reduce((current, key) => current?.[key], value);

export const collectStrings = (value) => {
  const results = [];
  const walk = (entry) => {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        results.push(trimmed);
      }
      return;
    }
    if (Array.isArray(entry)) {
      for (const item of entry) {
        walk(item);
      }
      return;
    }
    if (entry && typeof entry === "object") {
      for (const item of Object.values(entry)) {
        walk(item);
      }
    }
  };

  walk(value);
  return results;
};

const normalizeTraceEntry = (entry) => ({
  excerpt: String(entry?.excerpt ?? "").trim(),
  targetPath: String(entry?.targetPath ?? "").trim(),
  ruleType: String(entry?.ruleType ?? "").trim(),
  note: String(entry?.note ?? "").trim(),
});

const coerceMode = (mode) => {
  const value = String(mode ?? "").trim();
  if (!value) {
    return "full-slide";
  }
  return value;
};

const normalizeChip = (chip) => {
  if (typeof chip === "string") {
    return chip.trim();
  }
  if (chip && typeof chip === "object" && typeof chip.label === "string") {
    return chip.label.trim();
  }
  return "";
};

const normalizeMediaSlot = (slot) => {
  const rawMaxCandidates = slot?.maxCandidates;
  const rawDesiredPeopleCount = slot?.desiredPeopleCount;
  return {
    id: String(slot?.id ?? "").trim(),
    label: String(slot?.label ?? "").trim(),
    role: String(slot?.role ?? "").trim() || "supporting",
    required: Boolean(slot?.required ?? false),
    query: String(slot?.query ?? "").trim(),
    orientation: String(slot?.orientation ?? "").trim(),
    color: String(slot?.color ?? "").trim(),
    styleTracks: Array.isArray(slot?.styleTracks)
      ? slot.styleTracks.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    moodTags: Array.isArray(slot?.moodTags)
      ? slot.moodTags.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    styleTags: Array.isArray(slot?.styleTags)
      ? slot.styleTags.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    subjectTags: Array.isArray(slot?.subjectTags)
      ? slot.subjectTags.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    avoidTags: Array.isArray(slot?.avoidTags)
      ? slot.avoidTags.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    excludeTerms: Array.isArray(slot?.excludeTerms)
      ? slot.excludeTerms.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    copySafeZones: Array.isArray(slot?.copySafeZones)
      ? slot.copySafeZones.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    desiredShotType: String(slot?.desiredShotType ?? "").trim(),
    desiredPeopleCount:
      rawDesiredPeopleCount === null ||
      rawDesiredPeopleCount === undefined ||
      rawDesiredPeopleCount === ""
        ? null
        : Number(rawDesiredPeopleCount),
    clutterTarget: String(slot?.clutterTarget ?? "").trim() || "medium",
    maxCandidates:
      rawMaxCandidates === null ||
      rawMaxCandidates === undefined ||
      rawMaxCandidates === ""
        ? DEFAULT_ASSET_CANDIDATES
        : Number(rawMaxCandidates),
    placement:
      slot?.placement && typeof slot.placement === "object"
        ? {
            target: String(slot.placement?.target ?? "").trim(),
            copySafeZone: String(slot.placement?.copySafeZone ?? "").trim(),
            objectPosition:
              String(slot.placement?.objectPosition ?? "").trim() ||
              "center center",
          }
        : {
            target: "",
            copySafeZone: "",
            objectPosition: "center center",
          },
    treatmentDefaults:
      slot?.treatmentDefaults && typeof slot.treatmentDefaults === "object"
        ? {
            treatment: String(slot.treatmentDefaults?.treatment ?? "").trim() || "mono",
            opacity:
              slot.treatmentDefaults?.opacity === null ||
              slot.treatmentDefaults?.opacity === undefined ||
              slot.treatmentDefaults?.opacity === ""
                ? null
                : Number(slot.treatmentDefaults.opacity),
          }
        : {
            treatment: "mono",
            opacity: null,
          },
    selectedAssetRef:
      slot?.selectedAssetRef && typeof slot.selectedAssetRef === "object"
        ? {
            assetId: String(slot.selectedAssetRef?.assetId ?? "").trim(),
            candidateId: String(slot.selectedAssetRef?.candidateId ?? "").trim(),
            status: String(slot.selectedAssetRef?.status ?? "").trim() || "approved",
            placement: String(slot.selectedAssetRef?.placement ?? "").trim() || "",
            treatment:
              String(slot.selectedAssetRef?.treatment ?? "").trim() || "mono",
            objectPosition:
              String(slot.selectedAssetRef?.objectPosition ?? "").trim() ||
              "center center",
            cropVariant:
              String(slot.selectedAssetRef?.cropVariant ?? "").trim() || "original",
            opacity:
              slot.selectedAssetRef?.opacity === null ||
              slot.selectedAssetRef?.opacity === undefined ||
              slot.selectedAssetRef?.opacity === ""
                ? null
                : Number(slot.selectedAssetRef.opacity),
            alt: String(slot.selectedAssetRef?.alt ?? "").trim(),
          }
        : null,
    placementNote: String(slot?.placementNote ?? "").trim(),
  };
};

const normalizeMediaSelection = (selection) => {
  const rawCandidateIndex = selection?.candidateIndex;
  const rawOpacity = selection?.opacity;
  const candidateIndex =
    rawCandidateIndex === null ||
    rawCandidateIndex === undefined ||
    rawCandidateIndex === ""
      ? null
      : Number(rawCandidateIndex);
  const opacity =
    rawOpacity === null || rawOpacity === undefined || rawOpacity === ""
      ? null
      : Number(rawOpacity);

  return {
    id: String(selection?.id ?? "").trim(),
    slotId: String(selection?.slotId ?? "").trim(),
    candidateId: String(selection?.candidateId ?? "").trim(),
    candidateIndex,
    src: String(selection?.src ?? "").trim(),
    placement: String(selection?.placement ?? "").trim() || "motif",
    alt: String(selection?.alt ?? "").trim(),
    treatment: String(selection?.treatment ?? "").trim() || "mono",
    objectPosition: String(selection?.objectPosition ?? "").trim() || "center center",
    opacity,
  };
};

const normalizeBody = (spec) => {
  const family = spec?.meta?.family;
  const body = spec?.body ?? {};

  if (family === "segmented_focus_bar") {
    const segments = Array.isArray(body.segments)
      ? body.segments.map((segment) => ({
          label: String(segment?.label ?? "").trim(),
          width: Number(segment?.width ?? 0),
          role: String(segment?.role ?? "").trim() || "quiet",
        }))
      : [];

    return {
      ...body,
      barLabel: String(body.barLabel ?? "").trim(),
      segments,
      callout: {
        title: String(body?.callout?.title ?? "").trim(),
        bullets: Array.isArray(body?.callout?.bullets)
          ? body.callout.bullets.map((bullet) => String(bullet ?? "").trim())
          : [],
      },
    };
  }

  if (family === "compound_ribbon_day_view") {
    const segments = Array.isArray(body?.hero?.segments)
      ? body.hero.segments.map((segment) => ({
          label: String(segment?.label ?? "").trim(),
          width: Number(segment?.width ?? 0),
          role: String(segment?.role ?? "").trim() || "quiet",
        }))
      : [];

    return {
      hero: {
        label: String(body?.hero?.label ?? "").trim(),
        rulerTicks: Array.isArray(body?.hero?.rulerTicks)
          ? body.hero.rulerTicks
              .map((tick) => Number(tick))
              .filter((tick) => Number.isFinite(tick))
          : [],
        segments,
        callout: {
          lines: Array.isArray(body?.hero?.callout?.lines)
            ? body.hero.callout.lines.map((line) => String(line ?? "").trim())
            : [],
        },
      },
      transitionLabel: String(body?.transitionLabel ?? "").trim(),
      dayView: {
        label: String(body?.dayView?.label ?? "").trim(),
        count: Number(body?.dayView?.count ?? 0),
        guideWidth: Number(body?.dayView?.guideWidth ?? 0),
        height: Number(body?.dayView?.height ?? 0),
        gap: Number(body?.dayView?.gap ?? 0),
        newVisitGap: Number(body?.dayView?.newVisitGap ?? 0),
        newVisitWidth: Number(body?.dayView?.newVisitWidth ?? 0),
        reducedStoryWidthPct: Number(body?.dayView?.reducedStoryWidthPct ?? 0),
        newVisitLabel: String(body?.dayView?.newVisitLabel ?? "").trim(),
        caption: String(body?.dayView?.caption ?? "").trim(),
      },
    };
  }

  if (family === "compound_ribbon_before_after") {
    const normalizeSegmentList = (segments) =>
      Array.isArray(segments)
        ? segments.map((segment) => ({
            label: String(segment?.label ?? "").trim(),
            width: Number(segment?.width ?? 0),
            role: String(segment?.role ?? "").trim() || "quiet",
          }))
        : [];

    return {
      hero: {
        rulerTicks: Array.isArray(body?.hero?.rulerTicks)
          ? body.hero.rulerTicks
              .map((tick) => Number(tick))
              .filter((tick) => Number.isFinite(tick))
          : [],
        segments: normalizeSegmentList(body?.hero?.segments),
        callout: {
          lines: Array.isArray(body?.hero?.callout?.lines)
            ? body.hero.callout.lines.map((line) => String(line ?? "").trim())
            : [],
        },
      },
      mechanism: {
        label: String(body?.mechanism?.label ?? "").trim(),
        segments: normalizeSegmentList(body?.mechanism?.segments),
        savedLabel: String(body?.mechanism?.savedLabel ?? "").trim(),
      },
      beforeRow: {
        count: Number(body?.beforeRow?.count ?? 0),
        segments: normalizeSegmentList(body?.beforeRow?.segments),
      },
      transitionLabel: String(body?.transitionLabel ?? "").trim(),
      afterRow: {
        count: Number(body?.afterRow?.count ?? 0),
        segments: normalizeSegmentList(body?.afterRow?.segments),
        newVisitLabel: String(body?.afterRow?.newVisitLabel ?? "").trim(),
      },
    };
  }

  if (family === "history_wedge") {
    const normalizeSegmentList = (segments) =>
      Array.isArray(segments)
        ? segments.map((segment) => ({
            label: String(segment?.label ?? "").trim(),
            width: Number(segment?.width ?? 0),
            role: String(segment?.role ?? "").trim() || "quiet",
          }))
        : [];

    return {
      sourceBar: {
        rulerTicks: Array.isArray(body?.sourceBar?.rulerTicks)
          ? body.sourceBar.rulerTicks
              .map((tick) => Number(tick))
              .filter((tick) => Number.isFinite(tick))
          : [],
        segments: normalizeSegmentList(body?.sourceBar?.segments),
      },
      hero: {
        label: String(body?.hero?.label ?? "").trim(),
      },
      support: {
        heading: String(body?.support?.heading ?? "").trim(),
        reasons: Array.isArray(body?.support?.reasons)
          ? body.support.reasons.map((reason) => ({
              title: String(reason?.title ?? "").trim(),
              detail: String(reason?.detail ?? "").trim(),
            }))
          : [],
      },
    };
  }

  if (family === "story_to_structure_triptych") {
    return {
      left: {
        label: String(body?.left?.label ?? "").trim(),
        storyText: String(body?.left?.storyText ?? "").trim(),
      },
      middle: {
        label: String(body?.middle?.label ?? "").trim(),
        rows: Array.isArray(body?.middle?.rows)
          ? body.middle.rows.map((row) => ({
              sourceExcerpt: String(row?.sourceExcerpt ?? "").trim(),
              outputs: Array.isArray(row?.outputs)
                ? row.outputs.map((item) => String(item ?? "").trim())
                : [],
            }))
          : [],
        callout: String(body?.middle?.callout ?? "").trim(),
      },
      right: {
        label: String(body?.right?.label ?? "").trim(),
        sections: Array.isArray(body?.right?.sections)
          ? body.right.sections.map((section) => ({
              title: String(section?.title ?? "").trim(),
              items: Array.isArray(section?.items)
                ? section.items.map((item) => String(item ?? "").trim())
                : [],
            }))
          : [],
      },
    };
  }

  if (family === "story_to_structure_membrane") {
    return {
      left: {
        label: String(body?.left?.label ?? "").trim(),
        storyText: String(body?.left?.storyText ?? "").trim(),
        highlightSweeps: Array.isArray(body?.left?.highlightSweeps)
          ? body.left.highlightSweeps.map((sweep) => ({
              x: Number(sweep?.x ?? 0),
              y: Number(sweep?.y ?? 0),
              w: Number(sweep?.w ?? 0),
              h: Number(sweep?.h ?? 0),
            }))
          : [],
      },
      middle: {
        label: String(body?.middle?.label ?? "").trim(),
        accentColor: String(body?.middle?.accentColor ?? "").trim(),
        accentTint: String(body?.middle?.accentTint ?? "").trim(),
        streams: Array.isArray(body?.middle?.streams)
          ? body.middle.streams.map((stream) => ({
              label: String(stream?.label ?? "").trim(),
              items: Array.isArray(stream?.items)
                ? stream.items.map((item) => String(item ?? "").trim())
                : [],
            }))
          : [],
        callout: String(body?.middle?.callout ?? "").trim(),
      },
      right: {
        label: String(body?.right?.label ?? "").trim(),
        sections: Array.isArray(body?.right?.sections)
          ? body.right.sections.map((section) => ({
              title: String(section?.title ?? "").trim(),
              items: Array.isArray(section?.items)
                ? section.items.map((item) => String(item ?? "").trim())
                : [],
            }))
          : [],
      },
    };
  }

  if (family === "workflow_strip") {
    const handoffAfterStageIndex = Number(body?.handoff?.afterStageIndex);
    return {
      stages: Array.isArray(body?.stages)
        ? body.stages.map((stage) => ({
            label: String(stage?.label ?? "").trim(),
            detail: String(stage?.detail ?? "").trim(),
            role: String(stage?.role ?? "").trim() || "neutral",
            artifactLabel: String(stage?.artifactLabel ?? "").trim(),
            items: Array.isArray(stage?.items)
              ? stage.items.map((item) => String(item ?? "").trim())
              : [],
            tags: Array.isArray(stage?.tags)
              ? stage.tags.map((item) => String(item ?? "").trim())
              : [],
          }))
        : [],
      handoff: body?.handoff
        ? {
            afterStageIndex: Number.isInteger(handoffAfterStageIndex)
              ? handoffAfterStageIndex
              : -1,
            label: String(body?.handoff?.label ?? "").trim(),
            items: Array.isArray(body?.handoff?.items)
              ? body.handoff.items.map((item) => String(item ?? "").trim())
              : [],
            tags: Array.isArray(body?.handoff?.tags)
              ? body.handoff.tags.map((item) => String(item ?? "").trim())
              : [],
          }
        : null,
      footerNote: String(body?.footerNote ?? "").trim(),
    };
  }

  if (family === "proof_tiles") {
    return {
      ...body,
      motif: String(body?.motif ?? "").trim() || "none",
      tiles: Array.isArray(body.tiles)
        ? body.tiles.map((tile) => ({
            eyebrow: String(tile?.eyebrow ?? "").trim(),
            metric: String(tile?.metric ?? "").trim(),
            detail: String(tile?.detail ?? "").trim(),
            kicker: String(tile?.kicker ?? "").trim(),
            graphic: {
              kind: String(tile?.graphic?.kind ?? "").trim(),
            },
          }))
        : [],
      };
  }

  if (family === "trend_breakout_banner") {
    return {
      trend: {
        eyebrow: String(body?.trend?.eyebrow ?? "").trim(),
        label: String(body?.trend?.label ?? "").trim(),
        unitLabel: String(body?.trend?.unitLabel ?? "").trim(),
        annotation: {
          headline: String(body?.trend?.annotation?.headline ?? "").trim(),
          detail: String(body?.trend?.annotation?.detail ?? "").trim(),
        },
        points: Array.isArray(body?.trend?.points)
          ? body.trend.points.map((point) => ({
              year: Number(point?.year ?? 0),
              value: Number(point?.value ?? 0),
              displayValue: String(point?.displayValue ?? "").trim(),
            }))
          : [],
      },
      breakout: {
        eyebrow: String(body?.breakout?.eyebrow ?? "").trim(),
        label: String(body?.breakout?.label ?? "").trim(),
        unitLabel: String(body?.breakout?.unitLabel ?? "").trim(),
        bars: Array.isArray(body?.breakout?.bars)
          ? body.breakout.bars.map((bar) => ({
              label: String(bar?.label ?? "").trim(),
              value: Number(bar?.value ?? 0),
              displayValue: String(bar?.displayValue ?? "").trim(),
            }))
          : [],
      },
      banner: {
        eyebrow: String(body?.banner?.eyebrow ?? "").trim(),
        metric: String(body?.banner?.metric ?? "").trim(),
        headline: String(body?.banner?.headline ?? "").trim(),
        detail: String(body?.banner?.detail ?? "").trim(),
      },
    };
  }

  if (family === "transformation_flow") {
    return {
      left: {
        label: String(body?.left?.label ?? "").trim(),
        fragments: Array.isArray(body?.left?.fragments)
          ? body.left.fragments.map((item) => String(item ?? "").trim())
          : [],
      },
      middle: {
        eyebrow: String(body?.middle?.eyebrow ?? "").trim(),
        label: String(body?.middle?.label ?? "").trim(),
        caption: String(body?.middle?.caption ?? "").trim(),
        callout: String(body?.middle?.callout ?? "").trim(),
      },
      right: {
        label: String(body?.right?.label ?? "").trim(),
        sections: Array.isArray(body?.right?.sections)
          ? body.right.sections.map((section) =>
              typeof section === "string"
                ? { title: "", lines: [section.trim()] }
                : {
                    title: String(section?.title ?? "").trim(),
                    lines: Array.isArray(section?.lines)
                      ? section.lines.map((line) => String(line ?? "").trim())
                      : [],
                  }
            )
          : [],
        note: String(body?.right?.note ?? "").trim(),
      },
    };
  }

  if (family === "artifact_with_zoom_callouts") {
    return {
      artifact: {
        label: String(body?.artifact?.label ?? "").trim(),
        sections: Array.isArray(body?.artifact?.sections)
          ? body.artifact.sections.map((section) =>
              typeof section === "string"
                ? { title: "", rows: [section.trim()] }
                : {
                    title: String(section?.title ?? "").trim(),
                    rows: Array.isArray(section?.rows)
                      ? section.rows.map((row) => String(row ?? "").trim())
                      : [],
                  }
            )
          : [],
      },
      callouts: Array.isArray(body?.callouts)
        ? body.callouts.map((callout) => ({
            label: String(callout?.label ?? "").trim(),
            detail: String(callout?.detail ?? "").trim(),
            anchorRegion: String(callout?.anchorRegion ?? "").trim(),
          }))
        : [],
    };
  }

  if (family === "hero_metric_with_scenarios") {
    return {
      hero: {
        label: String(body?.hero?.label ?? "").trim(),
        assumptions: Array.isArray(body?.hero?.assumptions)
          ? body.hero.assumptions.map((item) => String(item ?? "").trim())
          : [],
        primaryMetric: String(body?.hero?.primaryMetric ?? "").trim(),
        secondaryLine: String(body?.hero?.secondaryLine ?? "").trim(),
      },
      scenarios: Array.isArray(body?.scenarios)
        ? body.scenarios.map((scenario) => ({
            label: String(scenario?.label ?? "").trim(),
            metric: String(scenario?.metric ?? "").trim(),
            detail: String(scenario?.detail ?? "").trim(),
          }))
        : [],
      bottomLine: String(body?.bottomLine ?? "").trim(),
    };
  }

  return body;
};

export const normalizeFigureSpec = (rawSpec, specPath = null) => {
  const spec = structuredClone(rawSpec ?? {});
  return {
    specVersion: Number(spec.specVersion ?? SPEC_VERSION),
    meta: {
      slug: String(spec?.meta?.slug ?? "").trim(),
      family: String(spec?.meta?.family ?? "").trim(),
      deckId: String(spec?.meta?.deckId ?? "").trim(),
      theme: String(spec?.meta?.theme ?? "").trim(),
      mode: coerceMode(spec?.meta?.mode),
      sourcePath: specPath ? resolve(specPath) : null,
    },
    chrome: {
      title: String(spec?.chrome?.title ?? "").trim(),
      subtitle: String(spec?.chrome?.subtitle ?? "").trim(),
      chips: Array.isArray(spec?.chrome?.chips)
        ? spec.chrome.chips.map(normalizeChip).filter(Boolean)
        : [],
      footnote: String(spec?.chrome?.footnote ?? "").trim(),
    },
    constraints: {
      figureJob: String(spec?.constraints?.figureJob ?? "").trim(),
      focalPoint: String(spec?.constraints?.focalPoint ?? "").trim(),
      layout: String(spec?.constraints?.layout ?? "").trim(),
      big: Array.isArray(spec?.constraints?.big)
        ? spec.constraints.big.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
      quiet: Array.isArray(spec?.constraints?.quiet)
        ? spec.constraints.quiet.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
      accentTargets: Array.isArray(spec?.constraints?.accentTargets)
        ? spec.constraints.accentTargets
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        : [],
      forbidden: Array.isArray(spec?.constraints?.forbidden)
        ? spec.constraints.forbidden
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        : [],
      semanticGuards: Array.isArray(spec?.constraints?.semanticGuards)
        ? spec.constraints.semanticGuards
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        : [],
    },
    copyPolicy: {
      locked: Array.isArray(spec?.copyPolicy?.locked)
        ? spec.copyPolicy.locked.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
      preferred: Array.isArray(spec?.copyPolicy?.preferred)
        ? spec.copyPolicy.preferred
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        : [],
      optional: Array.isArray(spec?.copyPolicy?.optional)
        ? spec.copyPolicy.optional
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        : [],
      forbidden: Array.isArray(spec?.copyPolicy?.forbidden)
        ? spec.copyPolicy.forbidden
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        : [],
    },
    media: {
      strategy: String(spec?.media?.strategy ?? "").trim() || "native",
      provider: String(spec?.media?.provider ?? "").trim() || DEFAULT_ASSET_PROVIDER,
      slots: Array.isArray(spec?.media?.slots)
        ? spec.media.slots.map(normalizeMediaSlot)
        : [],
      selection: Array.isArray(spec?.media?.selection)
        ? spec.media.selection.map(normalizeMediaSelection)
        : [],
    },
    body: normalizeBody(spec),
    trace: Array.isArray(spec?.trace)
      ? spec.trace.map(normalizeTraceEntry)
      : [],
  };
};

export const validateFigureSpec = (spec) => {
  const errors = [];
  const { meta, chrome, constraints, copyPolicy, trace } = spec;

  if (!isNonEmptyString(meta.slug)) {
    errors.push("meta.slug is required");
  }
  if (!FIGURE_FAMILIES.has(meta.family)) {
    errors.push(
      `meta.family must be one of: ${Array.from(FIGURE_FAMILIES).join(", ")}`
    );
  }
  if (!isNonEmptyString(meta.deckId)) {
    errors.push("meta.deckId is required");
  }
  if (!["full-slide", "body-only", "body-first"].includes(meta.mode)) {
    errors.push("meta.mode must be full-slide, body-only, or body-first");
  }
  if (!isNonEmptyString(chrome.title) && meta.mode !== "body-only") {
    errors.push("chrome.title is required unless meta.mode is body-only");
  }
  if (!isNonEmptyString(constraints.figureJob)) {
    errors.push("constraints.figureJob is required");
  }
  if (!isNonEmptyString(constraints.focalPoint)) {
    errors.push("constraints.focalPoint is required");
  }
  if (!isNonEmptyString(constraints.layout)) {
    errors.push("constraints.layout is required");
  }
  if (constraints.accentTargets.length === 0) {
    errors.push("constraints.accentTargets must include at least one target");
  }

  for (const path of FAMILY_REQUIREMENTS[meta.family] ?? []) {
    const value = get(spec, path);
    const missingArray = Array.isArray(value) && value.length === 0;
    if (value == null || value === "" || missingArray) {
      errors.push(`${path} is required for ${meta.family}`);
    }
  }

  if (copyPolicy.locked.length === 0) {
    errors.push("copyPolicy.locked must include at least one locked string");
  }

  if (spec.media?.strategy && !MEDIA_STRATEGIES.has(spec.media.strategy)) {
    errors.push(
      `media.strategy must be one of: ${Array.from(MEDIA_STRATEGIES).join(", ")}`
    );
  }
  if (spec.media?.provider && !ASSET_PROVIDERS.has(spec.media.provider)) {
    errors.push(
      `media.provider must be one of: ${Array.from(ASSET_PROVIDERS).join(", ")}`
    );
  }

  const slotIds = new Set();
  for (const [index, slot] of (spec.media?.slots ?? []).entries()) {
    if (!isNonEmptyString(slot.id)) {
      errors.push(`media.slots[${index}].id is required`);
    } else if (slotIds.has(slot.id)) {
      errors.push(`media.slots[${index}].id must be unique`);
    } else {
      slotIds.add(slot.id);
    }

    if (!isNonEmptyString(slot.label)) {
      errors.push(`media.slots[${index}].label is required`);
    }
    if (slot.role && !MEDIA_SLOT_ROLES.has(slot.role)) {
      errors.push(
        `media.slots[${index}].role must be one of: ${Array.from(
          MEDIA_SLOT_ROLES
        ).join(", ")}`
      );
    }
    if (!isNonEmptyString(slot.query)) {
      errors.push(`media.slots[${index}].query is required`);
    }
    if (
      slot.orientation &&
      !MEDIA_SLOT_ORIENTATIONS.has(slot.orientation)
    ) {
      errors.push(
        `media.slots[${index}].orientation must be one of: ${Array.from(
          MEDIA_SLOT_ORIENTATIONS
        ).join(", ")}`
      );
    }
    if (
      !Number.isFinite(slot.maxCandidates) ||
      slot.maxCandidates < 1 ||
      !Number.isInteger(slot.maxCandidates)
    ) {
      errors.push(`media.slots[${index}].maxCandidates must be a positive integer`);
    }
    if (
      slot.desiredPeopleCount !== null &&
      (!Number.isFinite(slot.desiredPeopleCount) ||
        slot.desiredPeopleCount < 0 ||
        !Number.isInteger(slot.desiredPeopleCount))
    ) {
      errors.push(
        `media.slots[${index}].desiredPeopleCount must be a non-negative integer`
      );
    }
    if (
      slot.clutterTarget &&
      !MEDIA_CLUTTER_TARGETS.has(slot.clutterTarget)
    ) {
      errors.push(
        `media.slots[${index}].clutterTarget must be one of: ${Array.from(
          MEDIA_CLUTTER_TARGETS
        ).join(", ")}`
      );
    }
    for (const zone of slot.copySafeZones ?? []) {
      if (!MEDIA_COPY_SAFE_ZONES.has(zone)) {
        errors.push(
          `media.slots[${index}].copySafeZones must be chosen from: ${Array.from(
            MEDIA_COPY_SAFE_ZONES
          ).join(", ")}`
        );
        break;
      }
    }
    if (
      slot.placement?.copySafeZone &&
      !MEDIA_COPY_SAFE_ZONES.has(slot.placement.copySafeZone)
    ) {
      errors.push(
        `media.slots[${index}].placement.copySafeZone must be one of: ${Array.from(
          MEDIA_COPY_SAFE_ZONES
        ).join(", ")}`
      );
    }
    if (
      slot.treatmentDefaults?.opacity !== null &&
      (!Number.isFinite(slot.treatmentDefaults.opacity) ||
        slot.treatmentDefaults.opacity < 0 ||
        slot.treatmentDefaults.opacity > 1)
    ) {
      errors.push(
        `media.slots[${index}].treatmentDefaults.opacity must be between 0 and 1`
      );
    }
    if (slot.selectedAssetRef) {
      if (!isNonEmptyString(slot.selectedAssetRef.assetId)) {
        errors.push(`media.slots[${index}].selectedAssetRef.assetId is required`);
      }
      if (
        slot.selectedAssetRef.opacity !== null &&
        (!Number.isFinite(slot.selectedAssetRef.opacity) ||
          slot.selectedAssetRef.opacity < 0 ||
          slot.selectedAssetRef.opacity > 1)
      ) {
        errors.push(
          `media.slots[${index}].selectedAssetRef.opacity must be between 0 and 1`
        );
      }
    }
  }

  for (const [index, selection] of (spec.media?.selection ?? []).entries()) {
    if (!isNonEmptyString(selection.src) && !isNonEmptyString(selection.slotId)) {
      errors.push(`media.selection[${index}].slotId is required unless src is provided`);
    }
    if (
      !isNonEmptyString(selection.src) &&
      !isNonEmptyString(selection.candidateId) &&
      !Number.isInteger(selection.candidateIndex)
    ) {
      errors.push(
        `media.selection[${index}] must include candidateId or candidateIndex unless src is provided`
      );
    }
    if (
      selection.candidateIndex !== null &&
      (!Number.isInteger(selection.candidateIndex) || selection.candidateIndex < 0)
    ) {
      errors.push(`media.selection[${index}].candidateIndex must be a non-negative integer`);
    }
    if (
      selection.opacity !== null &&
      (!Number.isFinite(selection.opacity) ||
        selection.opacity < 0 ||
        selection.opacity > 1)
    ) {
      errors.push(`media.selection[${index}].opacity must be between 0 and 1`);
    }

    if (
      isNonEmptyString(selection.slotId) &&
      (spec.media?.slots ?? []).length > 0 &&
      !(spec.media?.slots ?? []).some((slot) => slot.id === selection.slotId)
    ) {
      errors.push(
        `media.selection[${index}].slotId must match one of media.slots ids`
      );
    }
  }

  if (meta.family === "proof_tiles") {
    if ((spec.body.tiles ?? []).length < 2) {
      errors.push("body.tiles must include at least two tiles");
    }
    for (const [index, tile] of (spec.body.tiles ?? []).entries()) {
      if (!isNonEmptyString(tile.metric)) {
        errors.push(`body.tiles[${index}].metric is required`);
      }
      if (!isNonEmptyString(tile.detail)) {
        errors.push(`body.tiles[${index}].detail is required`);
      }
    }
  }

  if (meta.family === "trend_breakout_banner") {
    if ((spec.body.trend?.points ?? []).length < 4) {
      errors.push("body.trend.points must include at least four points");
    }
    for (const [index, point] of (spec.body.trend?.points ?? []).entries()) {
      if (!Number.isFinite(point.year) || point.year < 1900) {
        errors.push(`body.trend.points[${index}].year must be a valid year`);
      }
      if (!Number.isFinite(point.value) || point.value <= 0) {
        errors.push(`body.trend.points[${index}].value must be a positive number`);
      }
    }
    if (!isNonEmptyString(spec.body.trend?.label)) {
      errors.push("body.trend.label is required");
    }
    if ((spec.body.breakout?.bars ?? []).length < 3) {
      errors.push("body.breakout.bars must include at least three bars");
    }
    for (const [index, bar] of (spec.body.breakout?.bars ?? []).entries()) {
      if (!isNonEmptyString(bar.label)) {
        errors.push(`body.breakout.bars[${index}].label is required`);
      }
      if (!Number.isFinite(bar.value) || bar.value <= 0) {
        errors.push(`body.breakout.bars[${index}].value must be a positive number`);
      }
    }
    if (!isNonEmptyString(spec.body.breakout?.label)) {
      errors.push("body.breakout.label is required");
    }
    if (!isNonEmptyString(spec.body.banner?.headline)) {
      errors.push("body.banner.headline is required");
    }
    if (!isNonEmptyString(spec.body.banner?.detail)) {
      errors.push("body.banner.detail is required");
    }
    if (!isNonEmptyString(spec.body.banner?.metric)) {
      errors.push("body.banner.metric is required");
    }
  }

  if (meta.family === "segmented_focus_bar") {
    if (!(spec.body.segments ?? []).some((segment) => segment.role === "focus")) {
      errors.push("body.segments must include one focus segment");
    }
    if (!isNonEmptyString(spec.body.barLabel)) {
      errors.push("body.barLabel is required");
    }
    if ((spec.body.callout?.bullets ?? []).length === 0) {
      errors.push("body.callout.bullets must include at least one bullet");
    }
  }

  if (meta.family === "compound_ribbon_day_view") {
    if (!isNonEmptyString(spec.body.hero?.label)) {
      errors.push("body.hero.label is required");
    }
    if ((spec.body.hero?.segments ?? []).length < 3) {
      errors.push("body.hero.segments must include at least three segments");
    }
    if (!(spec.body.hero?.segments ?? []).some((segment) => segment.role === "focus")) {
      errors.push("body.hero.segments must include one focus segment");
    }
    if ((spec.body.hero?.callout?.lines ?? []).length === 0) {
      errors.push("body.hero.callout.lines must include at least one line");
    }
    if (!isNonEmptyString(spec.body.transitionLabel)) {
      errors.push("body.transitionLabel is required");
    }
    if (!isNonEmptyString(spec.body.dayView?.label)) {
      errors.push("body.dayView.label is required");
    }
    if (
      !Number.isFinite(spec.body.dayView?.count) ||
      !Number.isInteger(spec.body.dayView.count) ||
      spec.body.dayView.count < 1
    ) {
      errors.push("body.dayView.count must be a positive integer");
    }
    if (!isNonEmptyString(spec.body.dayView?.newVisitLabel)) {
      errors.push("body.dayView.newVisitLabel is required");
    }
    if (!isNonEmptyString(spec.body.dayView?.caption)) {
      errors.push("body.dayView.caption is required");
    }
  }

  if (meta.family === "compound_ribbon_before_after") {
    if ((spec.body.hero?.segments ?? []).length < 3) {
      errors.push("body.hero.segments must include at least three segments");
    }
    if (!(spec.body.hero?.segments ?? []).some((segment) => segment.role === "focus")) {
      errors.push("body.hero.segments must include one focus segment");
    }
    if ((spec.body.hero?.callout?.lines ?? []).length === 0) {
      errors.push("body.hero.callout.lines must include at least one line");
    }
    if (
      !Number.isFinite(spec.body.beforeRow?.count) ||
      !Number.isInteger(spec.body.beforeRow.count) ||
      spec.body.beforeRow.count < 1
    ) {
      errors.push("body.beforeRow.count must be a positive integer");
    }
    if ((spec.body.beforeRow?.segments ?? []).length < 3) {
      errors.push("body.beforeRow.segments must include at least three segments");
    }
    if (!isNonEmptyString(spec.body.transitionLabel)) {
      errors.push("body.transitionLabel is required");
    }
    if (
      !Number.isFinite(spec.body.afterRow?.count) ||
      !Number.isInteger(spec.body.afterRow.count) ||
      spec.body.afterRow.count < 1
    ) {
      errors.push("body.afterRow.count must be a positive integer");
    }
    if ((spec.body.afterRow?.segments ?? []).length < 3) {
      errors.push("body.afterRow.segments must include at least three segments");
    }
    if (!isNonEmptyString(spec.body.afterRow?.newVisitLabel)) {
      errors.push("body.afterRow.newVisitLabel is required");
    }
  }

  if (meta.family === "history_wedge") {
    if ((spec.body.sourceBar?.segments ?? []).length < 3) {
      errors.push("body.sourceBar.segments must include at least three segments");
    }
    if (
      !(spec.body.sourceBar?.segments ?? []).some(
        (segment) => segment.role === "focus"
      )
    ) {
      errors.push("body.sourceBar.segments must include one focus segment");
    }
    if (!isNonEmptyString(spec.body.hero?.label)) {
      errors.push("body.hero.label is required");
    }
    if ((spec.body.support?.reasons ?? []).length !== 3) {
      errors.push("body.support.reasons must include exactly three reasons");
    }
    for (const [index, reason] of (spec.body.support?.reasons ?? []).entries()) {
      if (!isNonEmptyString(reason.title)) {
        errors.push(`body.support.reasons[${index}].title is required`);
      }
    }
  }

  if (meta.family === "story_to_structure_triptych") {
    if (!isNonEmptyString(spec.body.left?.label)) {
      errors.push("body.left.label is required");
    }
    if (!isNonEmptyString(spec.body.left?.storyText)) {
      errors.push("body.left.storyText is required");
    }
    if (!isNonEmptyString(spec.body.middle?.label)) {
      errors.push("body.middle.label is required");
    }
    if ((spec.body.middle?.rows ?? []).length !== 3) {
      errors.push("body.middle.rows must include exactly three rows");
    }
    for (const [index, row] of (spec.body.middle?.rows ?? []).entries()) {
      if (!isNonEmptyString(row.sourceExcerpt)) {
        errors.push(`body.middle.rows[${index}].sourceExcerpt is required`);
      }
      if ((row.outputs ?? []).length === 0 || (row.outputs ?? []).length > 2) {
        errors.push(
          `body.middle.rows[${index}].outputs must include one or two items`
        );
      }
    }
    if (!isNonEmptyString(spec.body.middle?.callout)) {
      errors.push("body.middle.callout is required");
    }
    if (!isNonEmptyString(spec.body.right?.label)) {
      errors.push("body.right.label is required");
    }
    if ((spec.body.right?.sections ?? []).length !== 3) {
      errors.push("body.right.sections must include exactly three sections");
    }
    for (const [index, section] of (spec.body.right?.sections ?? []).entries()) {
      if (!isNonEmptyString(section.title)) {
        errors.push(`body.right.sections[${index}].title is required`);
      }
      if ((section.items ?? []).length === 0 || (section.items ?? []).length > 2) {
        errors.push(
          `body.right.sections[${index}].items must include one or two items`
        );
      }
    }
  }

  if (meta.family === "story_to_structure_membrane") {
    if (!isNonEmptyString(spec.body.left?.label)) {
      errors.push("body.left.label is required");
    }
    if (!isNonEmptyString(spec.body.left?.storyText)) {
      errors.push("body.left.storyText is required");
    }
    if (!isNonEmptyString(spec.body.middle?.label)) {
      errors.push("body.middle.label is required");
    }
    if ((spec.body.middle?.streams ?? []).length !== 3) {
      errors.push("body.middle.streams must include exactly three streams");
    }
    for (const [index, stream] of (spec.body.middle?.streams ?? []).entries()) {
      if (!isNonEmptyString(stream.label)) {
        errors.push(`body.middle.streams[${index}].label is required`);
      }
      if ((stream.items ?? []).length === 0 || (stream.items ?? []).length > 2) {
        errors.push(
          `body.middle.streams[${index}].items must include one or two items`
        );
      }
    }
    if (!isNonEmptyString(spec.body.middle?.callout)) {
      errors.push("body.middle.callout is required");
    }
    if (!isNonEmptyString(spec.body.right?.label)) {
      errors.push("body.right.label is required");
    }
    if ((spec.body.right?.sections ?? []).length !== 3) {
      errors.push("body.right.sections must include exactly three sections");
    }
  }

  if (meta.family === "workflow_strip") {
    if ((spec.body.stages ?? []).length < 3) {
      errors.push("body.stages must include at least three stages");
    }
    for (const [index, stage] of (spec.body.stages ?? []).entries()) {
      if (!isNonEmptyString(stage.label)) {
        errors.push(`body.stages[${index}].label is required`);
      }
      if (!isNonEmptyString(stage.detail)) {
        errors.push(`body.stages[${index}].detail is required`);
      }
      if ((stage.items ?? []).length > 4) {
        errors.push(`body.stages[${index}].items must include at most four items`);
      }
    }
    if (spec.body.handoff) {
      if (!Number.isInteger(spec.body.handoff.afterStageIndex)) {
        errors.push("body.handoff.afterStageIndex must be an integer");
      } else if (
        spec.body.handoff.afterStageIndex < 0 ||
        spec.body.handoff.afterStageIndex >= (spec.body.stages ?? []).length - 1
      ) {
        errors.push(
          "body.handoff.afterStageIndex must point to a stage before the final stage"
        );
      }
      if (!isNonEmptyString(spec.body.handoff.label)) {
        errors.push("body.handoff.label is required");
      }
      if ((spec.body.handoff.items ?? []).length === 0) {
        errors.push("body.handoff.items must include at least one item");
      }
      if ((spec.body.handoff.items ?? []).length > 3) {
        errors.push("body.handoff.items must include at most three items");
      }
      if ((spec.body.handoff.tags ?? []).length > 2) {
        errors.push("body.handoff.tags must include at most two tags");
      }
    }
  }

  if (meta.family === "transformation_flow") {
    if (!isNonEmptyString(spec.body.left?.label)) {
      errors.push("body.left.label is required");
    }
    if ((spec.body.left?.fragments ?? []).length === 0) {
      errors.push("body.left.fragments must include at least one fragment");
    }
    if (!isNonEmptyString(spec.body.middle?.label)) {
      errors.push("body.middle.label is required");
    }
    if (!isNonEmptyString(spec.body.right?.label)) {
      errors.push("body.right.label is required");
    }
    if ((spec.body.right?.sections ?? []).length === 0) {
      errors.push("body.right.sections must include at least one section");
    }
  }

  if (meta.family === "artifact_with_zoom_callouts") {
    if (!isNonEmptyString(spec.body.artifact?.label)) {
      errors.push("body.artifact.label is required");
    }
    if ((spec.body.artifact?.sections ?? []).length === 0) {
      errors.push("body.artifact.sections must include at least one section");
    }
    if ((spec.body.callouts ?? []).length === 0) {
      errors.push("body.callouts must include at least one callout");
    }
  }

  if (meta.family === "hero_metric_with_scenarios") {
    if (!isNonEmptyString(spec.body.hero?.label)) {
      errors.push("body.hero.label is required");
    }
    if (!isNonEmptyString(spec.body.hero?.primaryMetric)) {
      errors.push("body.hero.primaryMetric is required");
    }
    if ((spec.body.scenarios ?? []).length === 0) {
      errors.push("body.scenarios must include at least one scenario");
    }
    if (!isNonEmptyString(spec.body.bottomLine)) {
      errors.push("body.bottomLine is required");
    }
  }

  if (trace.length === 0) {
    errors.push("trace must include prompt-to-spec mapping entries");
  }

  for (const [index, entry] of trace.entries()) {
    if (!isNonEmptyString(entry.excerpt)) {
      errors.push(`trace[${index}].excerpt is required`);
    }
    if (!isNonEmptyString(entry.targetPath)) {
      errors.push(`trace[${index}].targetPath is required`);
    }
    if (!TRACE_RULE_TYPES.has(entry.ruleType)) {
      errors.push(
        `trace[${index}].ruleType must be one of: ${Array.from(
          TRACE_RULE_TYPES
        ).join(", ")}`
      );
    }
  }

  return errors;
};

export const loadFigureSpec = async (specPath) => {
  const rawSpec = await readJson(specPath);
  const spec = normalizeFigureSpec(rawSpec, specPath);
  const errors = validateFigureSpec(spec);

  if (errors.length > 0) {
    const error = new Error(
      `Figure spec validation failed for ${resolve(specPath)}:\n- ${errors.join(
        "\n- "
      )}`
    );
    error.validationErrors = errors;
    throw error;
  }

  return spec;
};
