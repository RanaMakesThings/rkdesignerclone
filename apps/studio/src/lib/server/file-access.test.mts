import assert from "node:assert/strict";
import test from "node:test";

import { getContentTypeForFile, resolveAllowlistedFile } from "./file-access.ts";

test("resolveAllowlistedFile allows checked-in design-system CSS through /api/file", async () => {
  const file = await resolveAllowlistedFile({
    pathLike: "projects/designer-health/design-system/vox-shared.css",
    projectId: "designer-health",
    kind: "file",
  });

  assert.equal(file.repoRelativePath, "projects/designer-health/design-system/vox-shared.css");
  assert.equal(file.extension, ".css");
  assert.equal(getContentTypeForFile(file, "file"), "text/css; charset=utf-8");
});
