import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { FileChip } from "@/components/studio/file-chip";
import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import { StylesLab } from "@/components/studio/styles-lab";
import {
  getDesignerStudioDeck,
  DESIGNER_STUDIO_PROJECT_ID,
} from "@/lib/server/designer-studio";
import { getRepoRoot } from "@/lib/server/studio-data";

export const dynamic = "force-dynamic";

const SHARED_CSS_PATH = "projects/designer-health/design-system/vox-shared.css";
const STYLE_PREVIEW_PATH = "projects/designer-health/design-system/style-preview.html";
const STYLE_PREVIEW_SOURCE_PATH =
  "projects/designer-health/design-system/style-preview.source-locked.html";

export default async function StylesPage() {
  const deck = await getDesignerStudioDeck({ includeGeneratedGraphics: false });
  const repoRoot = getRepoRoot();
  const [initialCss, previewTemplateHtml] = await Promise.all([
    readFile(resolve(repoRoot, SHARED_CSS_PATH), "utf8"),
    readFile(resolve(repoRoot, STYLE_PREVIEW_PATH), "utf8"),
  ]);

  return (
    <DesignerStudioShell deck={deck} activeSection="styles">
      <div className="studio-canvas">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Styles</p>
            <h2>Manage the shared Designer design-system stylesheet.</h2>
            <p className="studio-body-copy">
              The shared CSS file is now checked in beside a style-preview HTML shell seeded from
              the supplied slide example. Update the master stylesheet here and preview the result
              before using it in slide versions.
            </p>
            <div className="studio-chip-row">
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={{ path: SHARED_CSS_PATH }}
                label="Master CSS"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={{ path: STYLE_PREVIEW_PATH }}
                label="Preview HTML"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={{ path: STYLE_PREVIEW_SOURCE_PATH }}
                label="Source Snapshot"
              />
            </div>
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">1</span>
              <span className="studio-hero-label">Master CSS file</span>
            </div>
            <div>
              <span className="studio-hero-metric">1</span>
              <span className="studio-hero-label">Preview shell</span>
            </div>
            <div>
              <span className="studio-hero-metric">1</span>
              <span className="studio-hero-label">Source snapshot</span>
            </div>
            <div>
              <span className="studio-hero-metric">1</span>
              <span className="studio-hero-label">Upload surface</span>
            </div>
          </div>
        </section>

        <StylesLab
          projectId={DESIGNER_STUDIO_PROJECT_ID}
          initialCss={initialCss}
          previewTemplateHtml={previewTemplateHtml}
        />
      </div>
    </DesignerStudioShell>
  );
}
