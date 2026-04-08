import assert from "node:assert/strict";
import test from "node:test";

import { isTrustedStudioPath } from "./path-allowlist.ts";

test("isTrustedStudioPath accepts current Studio canonical roots", () => {
  assert.equal(
    isTrustedStudioPath("projects/designer-health/design-system/vox-shared.css"),
    true
  );
  assert.equal(
    isTrustedStudioPath("projects/designer-health/templates/designer-deck-template-v1/template.png"),
    true
  );
  assert.equal(
    isTrustedStudioPath(
      "output/figures/presentation-images/clinician-patient-brief-vignette/gemini/version-01--editorial-baseline/outputs/image-01.jpg"
    ),
    true
  );
});

test("isTrustedStudioPath rejects unrelated or external-looking paths", () => {
  assert.equal(isTrustedStudioPath("../secrets.txt"), false);
  assert.equal(isTrustedStudioPath("apps/studio/package.json"), false);
  assert.equal(isTrustedStudioPath("projects/other-deck/deck-spec.json", "other-deck"), false);
});
