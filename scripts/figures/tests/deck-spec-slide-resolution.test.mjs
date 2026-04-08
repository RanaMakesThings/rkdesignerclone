import assert from "node:assert/strict";
import test from "node:test";

import {
  getActiveDeckSlides,
  parseDeckSlideDisplayNumber,
  resolveDeckSlideEntry,
} from "../../../lib/repo/read-deck-spec.mjs";

test("resolveDeckSlideEntry prefers active display numbers over legacy slide ids", () => {
  const deckSpec = {
    slides: [
      { id: "slide-01", displayNumber: "1", status: "active" },
      { id: "slide-05", displayNumber: "4", status: "active" },
      { id: "slide-04", displayNumber: "4 (retired)", status: "deprecated" },
      { id: "slide-04-05", displayNumber: "4/5", status: "deprecated" },
    ],
  };

  assert.equal(resolveDeckSlideEntry({ deckSpec, slide: "4" }).id, "slide-05");
  assert.equal(resolveDeckSlideEntry({ deckSpec, slide: "slide-4" }).id, "slide-05");
  assert.equal(resolveDeckSlideEntry({ deckSpec, slide: "slide-04" }).id, "slide-04");
  assert.equal(resolveDeckSlideEntry({ deckSpec, slide: "4 (retired)" }).id, "slide-04");
  assert.equal(resolveDeckSlideEntry({ deckSpec, slide: "4/5" }).id, "slide-04-05");
});

test("active deck filtering and numeric display parsing ignore retired labels", () => {
  const deckSpec = {
    slides: [
      { id: "slide-05", displayNumber: "4", status: "active" },
      { id: "slide-04", displayNumber: "4 (retired)", status: "deprecated" },
      { id: "slide-04-05", displayNumber: "4/5", status: "deprecated" },
    ],
  };

  assert.deepEqual(
    getActiveDeckSlides(deckSpec).map((slide) => slide.id),
    ["slide-05"]
  );
  assert.equal(parseDeckSlideDisplayNumber("4"), 4);
  assert.equal(parseDeckSlideDisplayNumber("4 (retired)"), null);
  assert.equal(parseDeckSlideDisplayNumber("4/5"), null);
});
