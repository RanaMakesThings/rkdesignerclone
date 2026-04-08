import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import { TemplateGallery } from "@/components/studio/template-gallery";
import {
  getDesignerStudioDeck,
  DESIGNER_STUDIO_PROJECT_ID,
} from "@/lib/server/designer-studio";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const deck = await getDesignerStudioDeck({ includeGeneratedGraphics: false });
  const lockedCount = deck.templates.filter((template) => template.status === "locked").length;

  return (
    <DesignerStudioShell deck={deck} activeSection="templates">
      <div className="studio-canvas">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Templates</p>
            <h2>Browse locked shell references outside the slide archive.</h2>
          </div>
          <div className="studio-intro-stats">
            <div>
              <span className="studio-hero-metric">{deck.templates.length}</span>
              <span className="studio-hero-label">Templates</span>
            </div>
            <div>
              <span className="studio-hero-metric">{lockedCount}</span>
              <span className="studio-hero-label">Locked</span>
            </div>
          </div>
        </section>

        <TemplateGallery
          deck={deck}
          projectId={DESIGNER_STUDIO_PROJECT_ID}
          title="Locked templates and shell references"
          description="The Vox design-system reference now has its own Studio page with a live preview and extracted CSS."
          ctaHref="/design-system"
          ctaLabel="Open Design System"
        />
      </div>
    </DesignerStudioShell>
  );
}
