import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { readJson } from "../lib/io.mjs";
import { prepareDesignerSlideCreate } from "../../designer/slide-create-prep-lib.mjs";

const makeTempDir = async () => mkdtemp(join(tmpdir(), "ysn-slide-create-prep-"));

test("prepareDesignerSlideCreate resolves slide aliases, seeds the draft root, and snapshots create context", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const templateDir = resolve(projectRoot, "templates", "designer-deck-template-v1");
  const stampedDir = resolve(projectRoot, "slide-figures", "slide-03");
  const packetPath = resolve(projectRoot, "slide-packets", "slide-03-packet.md");
  const notesDir = resolve(projectRoot, "slide-notes", "slide-03");

  try {
    await mkdir(templateDir, { recursive: true });
    await mkdir(stampedDir, { recursive: true });
    await mkdir(resolve(projectRoot, "slide-packets"), { recursive: true });
    await mkdir(notesDir, { recursive: true });

    await writeFile(
      resolve(templateDir, "template.html"),
      "<!doctype html><html><body><img src=\"../../assets/logo.svg\" /><div>Header</div><div>Subheader</div><div class=\"figure-stub\">Graphic / Figure</div></body></html>\n",
      "utf8"
    );
    await writeFile(resolve(templateDir, "template.png"), "template-preview", "utf8");
    await writeFile(
      resolve(templateDir, "shell-regions.json"),
      JSON.stringify(
        [
          {
            id: "footer-rule",
            label: "Footer Rule",
            x: 100,
            y: 1000,
            width: 400,
            height: 4,
            freezeLevel: "pixel-strict",
          },
        ],
        null,
        2
      ),
      "utf8"
    );
    await writeFile(packetPath, "# Slide packet\nLock the thesis.\n", "utf8");
    await writeFile(resolve(notesDir, "README.md"), "# Slide notes\n", "utf8");
    await writeFile(
      resolve(projectRoot, "deck-spec.json"),
      JSON.stringify(
        {
          template: {
            id: "designer-deck-template-v1",
            paths: {
              contractPath: resolve(projectRoot, "designer-deck-template.md"),
              templateDir,
              previewPath: resolve(templateDir, "template.png"),
              htmlPath: resolve(templateDir, "template.html"),
            },
          },
          slides: [
            {
              id: "slide-03",
              displayNumber: "3",
              title: "Workflow strip",
              header: "Vox prepares the visit before it starts.",
              subheader: "The clinician starts prepared, not from zero.",
              takeaway: "There is a credible pre-visit workflow.",
              purpose: "Make the workflow believable.",
              figureRole: "One calm operational strip.",
              selectedDirection: "Four beat storyboard.",
              buildStatus: "draft",
              paths: {
                packet: packetPath,
                stampedDir,
              },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await prepareDesignerSlideCreate({
      slide: "3",
      projectRoot,
    });

    assert.equal(result.slideId, "slide-03");
    assert.match(result.draftVersionId, /^version-\d{6}$/);
    assert.ok(result.draftVersionCreated);
    assert.ok(existsSync(result.draftVersionDir));
    assert.ok(existsSync(result.seedHtmlPath));
    assert.ok(existsSync(result.seedPreviewPath));
    assert.ok(existsSync(result.createContextPath));
    assert.ok(existsSync(result.createRequestPath));
    assert.ok(existsSync(result.createRequestSnapshotPath));
    assert.ok(existsSync(result.templateHtmlPath));
    assert.ok(existsSync(result.templatePreviewPath));

    const versionDoc = await readJson(resolve(result.draftVersionDir, "version.json"));
    assert.equal(versionDoc.sourceKind, "create-draft");

    const manifest = await readJson(resolve(stampedDir, "manifest.json"));
    const draftEntry = manifest.versions.find((entry) => entry.id === result.draftVersionId);
    assert.ok(draftEntry);
    assert.equal(draftEntry.status, "draft");

    const requestMarkdown = await readFile(result.createRequestPath, "utf8");
    assert.match(requestMarkdown, /## Requested change/);
    assert.match(requestMarkdown, /## Success checks/);
    assert.match(requestMarkdown, /## Guardrails/);

    const contextJson = await readJson(result.createContextPath);
    assert.equal(contextJson.slideId, "slide-03");
    assert.equal(contextJson.template.templateId, "designer-deck-template-v1");
    assert.equal(contextJson.packetPath, packetPath);
    assert.match(result.preferredNextCommand, /slide:create:run/);
    assert.match(result.preferredNextCommand, new RegExp(result.draftVersionId));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prepareDesignerSlideCreate resolves the current public slide number via deck-spec", async () => {
  const dir = await makeTempDir();
  const projectRoot = resolve(dir, "projects", "designer-health");
  const templateDir = resolve(projectRoot, "templates", "designer-deck-template-v1");
  const stampedDir = resolve(projectRoot, "slide-figures", "slide-05");
  const packetPath = resolve(projectRoot, "slide-packets", "slide-05-history-wedge.md");

  try {
    await mkdir(templateDir, { recursive: true });
    await mkdir(stampedDir, { recursive: true });
    await mkdir(resolve(projectRoot, "slide-packets"), { recursive: true });

    await writeFile(
      resolve(templateDir, "template.html"),
      "<!doctype html><html><body><div class=\"figure-stub\">Graphic / Figure</div></body></html>\n",
      "utf8"
    );
    await writeFile(resolve(templateDir, "template.png"), "template-preview", "utf8");
    await writeFile(resolve(templateDir, "shell-regions.json"), "[]\n", "utf8");
    await writeFile(packetPath, "# Slide packet\nLock the thesis.\n", "utf8");
    await writeFile(
      resolve(projectRoot, "deck-spec.json"),
      JSON.stringify(
        {
          template: {
            id: "designer-deck-template-v1",
            paths: {
              templateDir,
              previewPath: resolve(templateDir, "template.png"),
              htmlPath: resolve(templateDir, "template.html"),
            },
          },
          slides: [
            {
              id: "slide-05",
              displayNumber: "4",
              status: "active",
              title: "History wedge",
              header: "History is the cleanest place to reclaim minutes.",
              selectedDirection: "Locked history wedge.",
              paths: {
                packet: packetPath,
                stampedDir,
              },
            },
            {
              id: "slide-04",
              displayNumber: "4 (retired)",
              status: "deprecated",
              title: "Retired mechanism slide",
              header: "Visits start with story, not structure.",
              paths: {
                stampedDir: resolve(projectRoot, "slide-figures", "slide-04"),
              },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await prepareDesignerSlideCreate({
      slide: "4",
      projectRoot,
    });

    assert.equal(result.slideId, "slide-05");
    assert.match(result.preferredNextCommand, /--slide slide-05/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
