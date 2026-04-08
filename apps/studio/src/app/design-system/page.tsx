import { FileChip } from "@/components/studio/file-chip";
import { DesignSystemReferenceFrame } from "@/components/studio/design-system-reference-frame";
import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import {
  getDesignerDesignSystemReference,
  DESIGNER_DESIGN_SYSTEM_REFERENCE_PATH,
} from "@/lib/server/design-system-reference";
import {
  getDesignerStudioDeck,
  DESIGNER_STUDIO_PROJECT_ID,
} from "@/lib/server/designer-studio";
import { studioHtmlHref } from "@/lib/presentation/links";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const buildRefLike = (path: string, label?: string) => ({
  path,
  label: label ?? null,
});

export default async function DesignSystemPage() {
  const [deck, reference] = await Promise.all([
    getDesignerStudioDeck({ includeGeneratedGraphics: false }),
    getDesignerDesignSystemReference(),
  ]);

  const cssLineCount = reference?.css ? reference.css.split(/\r?\n/).length : 0;

  return (
    <DesignerStudioShell deck={deck} activeSection="design-system">
      <div className="studio-canvas">
        {reference ? (
          <>
            <section className={styles.toolbar}>
              <div className={styles.toolbarCopy}>
                <p className="eyebrow">Design System</p>
                <h2>{reference.title}</h2>
                <p className={styles.toolbarNote}>
                  This route renders the checked-in reference HTML through its linked canonical
                  stylesheet. The CSS source stays below it as a secondary section.
                </p>
              </div>
              <div className={styles.toolbarActions}>
                <FileChip
                  projectId={DESIGNER_STUDIO_PROJECT_ID}
                  refLike={buildRefLike(reference.path, "HTML Source")}
                />
                {reference.cssPath ? (
                  <FileChip
                    projectId={DESIGNER_STUDIO_PROJECT_ID}
                    refLike={buildRefLike(reference.cssPath, "CSS Source")}
                  />
                ) : null}
                <a href="#css-source" className="studio-chip">
                  <span>Jump to CSS</span>
                </a>
                <span className="studio-chip">
                  <span>CSS lines</span>
                  <strong>{cssLineCount}</strong>
                </span>
              </div>
            </section>

            <section className={styles.referenceStage}>
              <DesignSystemReferenceFrame
                title={reference.title}
                className={styles.referenceFrame}
                src={studioHtmlHref(DESIGNER_STUDIO_PROJECT_ID, reference.path)}
                minHeight={1800}
              />
            </section>

            <section id="css-source" className={styles.codePanel}>
              <div className={styles.codePanelHead}>
                <div>
                  <p className="eyebrow">CSS Source</p>
                  <h3>Canonical stylesheet backing the reference page</h3>
                </div>
                <div className={styles.toolbarActions}>
                  {reference.fontHref ? (
                    <a
                      href={reference.fontHref}
                      target="_blank"
                      rel="noreferrer"
                      className="studio-chip"
                    >
                      <span>Font Link</span>
                    </a>
                  ) : null}
                  <span className="studio-chip">
                    <span>Stylesheets</span>
                    <strong>1</strong>
                  </span>
                </div>
              </div>
              <pre className={styles.codeBlock}>
                <code>{reference.css}</code>
              </pre>
            </section>
          </>
        ) : (
          <section className={styles.emptyState}>
            <p className="eyebrow">Missing Reference</p>
            <h3>No checked-in design-system HTML is available yet.</h3>
            <p className="studio-body-copy">
              Studio expected to find the reference at{" "}
              <code>{DESIGNER_DESIGN_SYSTEM_REFERENCE_PATH}</code>.
            </p>
          </section>
        )}
      </div>
    </DesignerStudioShell>
  );
}
