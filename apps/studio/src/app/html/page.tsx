import { HtmlPreviewLab } from "@/components/studio/html-preview-lab";
import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import { getDesignerStudioDeck } from "@/lib/server/designer-studio";

export const dynamic = "force-dynamic";

export default async function HtmlPage() {
  const deck = await getDesignerStudioDeck({ includeGeneratedGraphics: false });
  const slideOptions = deck.activeSlides.map((slide) => ({
    slideId: slide.slideId,
    displayNumber: slide.displayNumber,
    title: slide.title,
  }));

  return (
    <DesignerStudioShell deck={deck} activeSection="html">
      <div className="studio-canvas">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">HTML Lab</p>
            <h2>Paste markup, render it instantly, and keep iterating.</h2>
            <p className="studio-body-copy">
              Use this page as a fast scratchpad while generating slide HTML. Drop in a full
              document or a partial fragment and review the rendered output directly underneath the
              editor.
            </p>
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">1</span>
              <span className="studio-hero-label">Paste box</span>
            </div>
            <div>
              <span className="studio-hero-metric">1</span>
              <span className="studio-hero-label">Live preview</span>
            </div>
            <div>
              <span className="studio-hero-metric">2</span>
              <span className="studio-hero-label">Load modes</span>
            </div>
            <div>
              <span className="studio-hero-metric">0</span>
              <span className="studio-hero-label">File saves needed</span>
            </div>
          </div>
        </section>

        <HtmlPreviewLab projectId={deck.projectId} slides={slideOptions} />
      </div>
    </DesignerStudioShell>
  );
}
