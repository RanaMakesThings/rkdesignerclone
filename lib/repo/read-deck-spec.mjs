import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { readJson } from "./read-json.mjs";

const normalizeLookup = (value) => String(value ?? "").trim().toLowerCase();

const toDisplayNumberAlias = (value) => {
  const raw = normalizeLookup(value);
  if (!raw) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    return String(Number(raw));
  }
  if (/^slide-\d+$/.test(raw) && !/^slide-\d\d$/.test(raw)) {
    return String(Number(raw.replace("slide-", "")));
  }
  return null;
};

export const parseDeckSlideDisplayNumber = (value) => {
  const raw = String(value ?? "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
};

export const getActiveDeckSlides = (deckSpec) =>
  Array.isArray(deckSpec?.slides)
    ? deckSpec.slides.filter((slide) => slide?.status === "active")
    : [];

export const resolveDeckSlideEntry = ({ deckSpec, slide }) => {
  const slides = Array.isArray(deckSpec?.slides) ? deckSpec.slides : [];
  const raw = normalizeLookup(slide);
  if (!raw) {
    throw new Error("Slide is required.");
  }

  const exactId = slides.find((entry) => normalizeLookup(entry?.id) === raw);
  if (exactId) {
    return exactId;
  }

  const exactDisplay = slides.find(
    (entry) => normalizeLookup(entry?.displayNumber) === raw
  );
  if (exactDisplay) {
    return exactDisplay;
  }

  const displayAlias = toDisplayNumberAlias(raw);
  if (displayAlias) {
    const activeByDisplay = getActiveDeckSlides(deckSpec).find(
      (entry) =>
        parseDeckSlideDisplayNumber(entry?.displayNumber) === Number(displayAlias)
    );
    if (activeByDisplay) {
      return activeByDisplay;
    }

    const anyByDisplay = slides.find(
      (entry) =>
        parseDeckSlideDisplayNumber(entry?.displayNumber) === Number(displayAlias)
    );
    if (anyByDisplay) {
      return anyByDisplay;
    }

    const byIdAlias = slides.find((entry) => {
      const candidateId = normalizeLookup(entry?.id);
      if (!/^slide-\d+$/.test(candidateId)) {
        return false;
      }
      return String(Number(candidateId.replace("slide-", ""))) === displayAlias;
    });
    if (byIdAlias) {
      return byIdAlias;
    }
  }

  throw new Error(`Could not find slide "${slide}" in deck-spec.json.`);
};

export const readDeckSpec = async (projectRoot) => {
  const deckSpecPath = resolve(projectRoot, "deck-spec.json");
  if (!existsSync(deckSpecPath)) {
    throw new Error(`Missing deck spec: ${deckSpecPath}`);
  }
  const deckSpec = await readJson(deckSpecPath);
  if (!deckSpec || !Array.isArray(deckSpec.slides)) {
    throw new Error(`Invalid deck spec format: ${deckSpecPath}`);
  }
  return {
    deckSpecPath,
    deckSpec,
  };
};
