import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FileChip } from "@/components/studio/file-chip";
import { DesignerStudioShell } from "@/components/studio/designer-studio-shell";
import { StudioPreviewLightbox } from "@/components/studio/studio-preview-lightbox";
import {
  getDesignerStudioSlideRun,
  type StudioHtmlEditRunSlotDetail,
} from "@/lib/server/html-edit-runs";
import { DESIGNER_STUDIO_PROJECT_ID } from "@/lib/server/designer-studio";
import { studioSlideHref } from "@/lib/presentation/links";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatDate = (value: string | null) => {
  if (!value) {
    return "Unknown";
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : dateFormatter.format(parsed);
};

const renderPreview = ({
  preview,
  html,
  alt,
  title,
  meta,
}: {
  preview: Parameters<typeof StudioPreviewLightbox>[0]["preview"];
  html?: Parameters<typeof StudioPreviewLightbox>[0]["html"];
  alt: string;
  title: string;
  meta: string;
}) => {
  if (!preview?.path) {
    return (
      <div className="studio-empty-preview studio-empty-preview-placeholder">
        <div className="studio-empty-preview-copy">
          <span className="studio-empty-preview-kicker">Missing preview</span>
          <strong>{title}</strong>
          <p>{meta}</p>
        </div>
      </div>
    );
  }

  return (
    <StudioPreviewLightbox
      projectId={DESIGNER_STUDIO_PROJECT_ID}
      preview={preview}
      html={html}
      alt={alt}
      title={title}
      meta={meta}
      previewLoading="lazy"
    />
  );
};

const renderSlotCard = (slot: StudioHtmlEditRunSlotDetail) => (
  <div key={slot.slotId} className="detail-nav-link">
    <span className="detail-nav-label">
      {slot.slotId} · {slot.status}
    </span>
    <strong>{slot.model ?? slot.provider ?? "unknown-model"}</strong>
    <p className="studio-body-copy">
      {slot.decision?.reason ?? slot.score?.reason ?? "No decision recorded for this slot."}
    </p>

    <div className="slide-facts-grid">
      <div className="slide-fact">
        <span className="slide-fact-label">Outcome</span>
        <strong>{slot.decision?.outcome ?? slot.score?.outcome ?? "n/a"}</strong>
      </div>
      <div className="slide-fact">
        <span className="slide-fact-label">Class</span>
        <strong>{slot.score?.class ?? "n/a"}</strong>
      </div>
      <div className="slide-fact">
        <span className="slide-fact-label">Attempt</span>
        <strong>{slot.attemptNumber}</strong>
      </div>
      <div className="slide-fact">
        <span className="slide-fact-label">Locked Regions</span>
        <strong>{slot.lockedViolations.length}</strong>
      </div>
    </div>

    <div className="detail-nav-row">
      <div>
        <p className="eyebrow">Parent</p>
        {renderPreview({
          preview: slot.parentPreview,
          html: slot.parentHtml,
          alt: `${slot.slotId} parent preview`,
          title: `${slot.slotId} parent preview`,
          meta: slot.parentHtml?.path ?? "parent preview",
        })}
      </div>
      <div>
        <p className="eyebrow">Candidate</p>
        {renderPreview({
          preview: slot.candidatePreview,
          html: slot.candidateHtml,
          alt: `${slot.slotId} candidate preview`,
          title: `${slot.slotId} candidate preview`,
          meta: slot.candidateHtml?.path ?? "candidate preview",
        })}
      </div>
    </div>

    <div className="studio-chip-row">
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.prompt}
        label="Prompt"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.candidateHtml}
        label="HTML"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.prefilter}
        label="Prefilter"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.gptDeltaFile}
        label="GPT Delta"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.claudeDeltaFile}
        label="Claude Delta"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.gptRegressionFile}
        label="GPT Regression"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.claudeRegressionFile}
        label="Claude Regression"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.scoreFile}
        label="Score"
      />
      <FileChip
        projectId={DESIGNER_STUDIO_PROJECT_ID}
        refLike={slot.decisionFile}
        label="Decision"
      />
    </div>

    {slot.retryBrief ? (
      <details>
        <summary>Retry Brief</summary>
        <pre>{slot.retryBrief}</pre>
      </details>
    ) : null}

    {slot.lockedViolations.length > 0 ? (
      <details>
        <summary>Locked Region Signals</summary>
        <ul>
          {slot.lockedViolations.map((violation, index) => (
            <li key={`${slot.slotId}-locked-${index}`}>
              {(violation.label ?? violation.regionId ?? "region").trim()} ·{" "}
              {violation.freezeLevel ?? "unknown"} ·{" "}
              {violation.blocked ? "blocked" : violation.warning ? "warning" : "noted"}
              {violation.reason ? ` · ${violation.reason}` : ""}
            </li>
          ))}
        </ul>
      </details>
    ) : null}
  </div>
);

export default async function SlideRunPage({
  params,
}: {
  params: Promise<{ slideId: string; runId: string }>;
}) {
  const { slideId, runId } = await params;
  const { deck, slide, run, canonicalParam } = await getDesignerStudioSlideRun(slideId, runId);

  if (!slide || !run) {
    notFound();
  }
  if (canonicalParam && canonicalParam !== slideId) {
    redirect(`${studioSlideHref(slide.displayNumber, slide.slideId)}/runs/${encodeURIComponent(runId)}`);
  }

  return (
    <DesignerStudioShell deck={deck} activeSlideId={slide.slideId}>
      <div className="studio-canvas">
        <section className="slide-detail-hero">
          <div className="slide-detail-copy">
            <div className="slide-detail-topbar">
              <div className="slide-wall-identity">
                <span className="studio-step-label">HTML Edit Run</span>
                <span className="studio-id-pill">{run.runId}</span>
                <span className="studio-id-pill studio-id-pill-accent">{run.status}</span>
              </div>
            </div>

            <h2>{slide.title}</h2>
            <p className="studio-body-copy">
              {run.surface ?? "html-edit"} · {run.mode ?? "repair"} · started{" "}
              {formatDate(run.createdAt)}
            </p>

            <div className="detail-nav-row">
              <Link
                href={studioSlideHref(slide.displayNumber, slide.slideId)}
                className="detail-nav-link"
              >
                <span className="detail-nav-label">Back to Slide</span>
                <strong>
                  {slide.displayNumber} {slide.title}
                </strong>
              </Link>
              {run.report ? (
                <a
                  href={`/api/report?projectId=${encodeURIComponent(DESIGNER_STUDIO_PROJECT_ID)}&path=${encodeURIComponent(run.report.path)}`}
                  className="detail-nav-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="detail-nav-label">Open HTML Report</span>
                  <strong>{run.report.path.split("/").at(-1)}</strong>
                </a>
              ) : (
                <span className="detail-nav-link detail-nav-link-muted">
                  <span className="detail-nav-label">HTML Report</span>
                  <strong>Not generated</strong>
                </span>
              )}
            </div>

            <div className="slide-facts-grid">
              <div className="slide-fact">
                <span className="slide-fact-label">Schema</span>
                <strong>{run.schema}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Rounds</span>
                <strong>{run.roundsCount}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Slots</span>
                <strong>{run.slotCount}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Updated</span>
                <strong>{formatDate(run.updatedAt)}</strong>
              </div>
              <div className="slide-fact">
                <span className="slide-fact-label">Winner</span>
                <strong>{run.winner?.slotId ?? "none"}</strong>
              </div>
            </div>

            <div className="studio-chip-row">
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.requestMarkdown}
                label="Request Markdown"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.requestJson}
                label="Request JSON"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.state}
                label="State JSON"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.winnerFile}
                label="Winner JSON"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.codexReviewTemplate}
                label="Codex Review"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.artifactDir}
                label="Artifact Dir"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.runDir}
                label="Run Dir"
              />
            </div>
          </div>

          <div className="slide-detail-visual">
            {renderPreview({
              preview: run.winnerPreview ?? run.baseline.parentPreview,
              html: run.winnerHtml ?? run.baseline.parentHtml,
              alt: `${slide.title} run preview`,
              title: `${slide.title} run preview`,
              meta: run.winner?.slotId ?? run.runId,
            })}
          </div>
        </section>

        <section className="asset-section">
          <div className="asset-group">
            <div className="asset-group-head">
              <div>
                <p className="eyebrow">Request</p>
                <h3>Change contract</h3>
              </div>
            </div>

            <div className="detail-nav-row">
              <div className="detail-nav-link">
                <span className="detail-nav-label">Requested Change</span>
                <strong>{run.request.requestedChange ?? "None"}</strong>
              </div>
              <div className="detail-nav-link">
                <span className="detail-nav-label">Success Checks</span>
                <strong>{run.request.successChecks ?? "None"}</strong>
              </div>
            </div>

            <div className="detail-nav-row">
              <div className="detail-nav-link">
                <span className="detail-nav-label">Guardrails</span>
                <strong>{run.request.guardrails ?? "None"}</strong>
              </div>
              <div className="detail-nav-link">
                <span className="detail-nav-label">Reference Intent</span>
                <strong>{run.request.referenceIntent ?? "None"}</strong>
              </div>
            </div>

            {run.request.approvedRegions.length > 0 ? (
              <details>
                <summary>Approved Regions</summary>
                <ul>
                  {run.request.approvedRegions.map((region) => (
                    <li key={region.id ?? region.label ?? "region"}>
                      {(region.label ?? region.id ?? "region").trim()} ·{" "}
                      {region.freezeLevel ?? "unknown"}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </section>

        <section className="asset-section">
          <div className="asset-group">
            <div className="asset-group-head">
              <div>
                <p className="eyebrow">Baseline</p>
                <h3>Official vs parent</h3>
              </div>
            </div>
            <div className="detail-nav-row">
              <div>
                <p className="eyebrow">Official Baseline</p>
                {renderPreview({
                  preview: run.baseline.officialPreview,
                  alt: `${slide.title} official baseline`,
                  title: "Official Baseline",
                  meta: run.baseline.officialPreview?.path ?? "no baseline preview",
                })}
              </div>
              <div>
                <p className="eyebrow">Parent Preview</p>
                {renderPreview({
                  preview: run.baseline.parentPreview,
                  html: run.baseline.parentHtml,
                  alt: `${slide.title} parent preview`,
                  title: "Parent Preview",
                  meta: run.baseline.parentHtml?.path ?? "no parent html",
                })}
              </div>
            </div>
            <div className="studio-chip-row">
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.baseline.parentHtml}
                label="Parent HTML"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.baseline.approvedRegions}
                label="Approved Regions JSON"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.winnerHtml}
                label="Winner HTML"
              />
              <FileChip
                projectId={DESIGNER_STUDIO_PROJECT_ID}
                refLike={run.winnerPreview}
                label="Winner Preview"
              />
            </div>
          </div>
        </section>

        {run.rounds.length > 0 ? (
          <section className="asset-section">
            <div className="asset-group">
              <div className="asset-group-head">
                <div>
                  <p className="eyebrow">Rounds</p>
                  <h3>{run.rounds.length} recorded rounds</h3>
                </div>
              </div>
              {run.rounds.map((round) => (
                <div key={`round-${round.roundNumber}`} className="asset-group">
                  <div className="asset-group-head">
                    <div>
                      <p className="eyebrow">Round {round.roundNumber}</p>
                      <h3>{round.status}</h3>
                    </div>
                  </div>
                  <div className="slide-facts-grid">
                    <div className="slide-fact">
                      <span className="slide-fact-label">Pass</span>
                      <strong>{round.summary.passCount}</strong>
                    </div>
                    <div className="slide-fact">
                      <span className="slide-fact-label">Retry</span>
                      <strong>{round.summary.retryCount}</strong>
                    </div>
                    <div className="slide-fact">
                      <span className="slide-fact-label">Blocked</span>
                      <strong>{round.summary.blockedCount}</strong>
                    </div>
                    <div className="slide-fact">
                      <span className="slide-fact-label">Escalated</span>
                      <strong>{round.summary.escalatedCount}</strong>
                    </div>
                  </div>
                  {round.synthesisMarkdown ? (
                    <details>
                      <summary>Global Retry Synthesis</summary>
                      <pre>{round.synthesisMarkdown}</pre>
                    </details>
                  ) : null}
                  <div className="slide-facts-grid">
                    {round.slots.map((slot) => renderSlotCard(slot))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {run.legacyAttempts.length > 0 ? (
          <section className="asset-section">
            <div className="asset-group">
              <div className="asset-group-head">
                <div>
                  <p className="eyebrow">Legacy Attempts</p>
                  <h3>{run.legacyAttempts.length} attempt records</h3>
                </div>
              </div>
              <div className="slide-facts-grid">
                {run.legacyAttempts.map((attempt) => (
                  <div key={attempt.label} className="detail-nav-link">
                    <span className="detail-nav-label">{attempt.label}</span>
                    <strong>{attempt.outcome ?? "unknown"}</strong>
                    <p className="studio-body-copy">
                      {attempt.nextAction ?? "See run report for more detail."}
                    </p>
                    <div className="studio-chip-row">
                      <FileChip
                        projectId={DESIGNER_STUDIO_PROJECT_ID}
                        refLike={attempt.attemptDir}
                        label="Attempt Dir"
                      />
                      <FileChip
                        projectId={DESIGNER_STUDIO_PROJECT_ID}
                        refLike={attempt.beforePreview}
                        label="Before"
                      />
                      <FileChip
                        projectId={DESIGNER_STUDIO_PROJECT_ID}
                        refLike={attempt.afterPreview}
                        label="After"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {run.pendingCodexReview || run.failureReason ? (
          <section className="asset-section">
            <div className="asset-group">
              <div className="asset-group-head">
                <div>
                  <p className="eyebrow">Outcome</p>
                  <h3>{run.pendingCodexReview ? "Review pending" : "Failure summary"}</h3>
                </div>
              </div>
              {run.pendingCodexReview ? (
                <div className="detail-nav-link">
                  <span className="detail-nav-label">
                    {run.pendingCodexReview.slotId ?? "winner"} awaiting Codex review
                  </span>
                  <strong>{run.pendingCodexReview.provider ?? "unknown-provider"}</strong>
                  <div className="studio-chip-row">
                    <FileChip
                      projectId={DESIGNER_STUDIO_PROJECT_ID}
                      refLike={run.pendingCodexReview.reviewFile}
                      label="Review File"
                    />
                  </div>
                </div>
              ) : null}
              {run.failureReason ? (
                <div className="detail-nav-link">
                  <span className="detail-nav-label">Failure reason</span>
                  <strong>{run.failureReason}</strong>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </DesignerStudioShell>
  );
}
