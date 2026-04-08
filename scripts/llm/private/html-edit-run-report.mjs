import { relative, resolve } from "node:path";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const relFromRunDir = (runDir, absolutePath) => {
  if (!absolutePath) {
    return null;
  }
  return relative(runDir, resolve(absolutePath)).replaceAll("\\", "/");
};

const renderList = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "<li>None.</li>";
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
};

const renderSlot = (runDir, slot) => {
  const previewSrc = relFromRunDir(runDir, slot?.after?.previewPath);
  const parentSrc = relFromRunDir(runDir, slot?.before?.parentPreviewPath);
  return [
    '<article class="slot-card">',
    `<h4>${escapeHtml(slot.slotId)}</h4>`,
    `<p><strong>Status:</strong> ${escapeHtml(slot.status)}</p>`,
    `<p><strong>Outcome:</strong> ${escapeHtml(slot.decision?.outcome || slot.score?.outcome || "")}</p>`,
    `<p><strong>Reason:</strong> ${escapeHtml(slot.decision?.reason || slot.score?.reason || "")}</p>`,
    previewSrc
      ? `<div class="image-pair"><figure><figcaption>Parent</figcaption><img src="${escapeHtml(parentSrc || previewSrc)}" alt="Parent preview"></figure><figure><figcaption>Candidate</figcaption><img src="${escapeHtml(previewSrc)}" alt="Candidate preview"></figure></div>`
      : "",
    "<details><summary>Prompt synthesis</summary>",
    `<pre>${escapeHtml(slot.retryBrief || "")}</pre>`,
    "</details>",
    "</article>",
  ].join("");
};

export const buildHtmlEditRunReport = ({ runDir, state }) => {
  const rounds = Array.isArray(state?.rounds) ? state.rounds : [];
  const baselineOfficial = relFromRunDir(runDir, state?.baseline?.officialPreviewPath);
  const baselineParent = relFromRunDir(runDir, state?.baseline?.parentPreviewPath);

  const roundMarkup = rounds
    .map((round) => {
      const slots = Array.isArray(round?.slots) ? round.slots : [];
      return [
        '<section class="round-card">',
        `<h3>Round ${escapeHtml(round.roundNumber)}</h3>`,
        `<p><strong>Status:</strong> ${escapeHtml(round.status)}</p>`,
        round?.summary
          ? `<p><strong>Summary:</strong> pass=${escapeHtml(round.summary.passCount)} retry=${escapeHtml(round.summary.retryCount)} blocked=${escapeHtml(round.summary.blockedCount)} escalated=${escapeHtml(round.summary.escalatedCount)}</p>`
          : "",
        round?.retrySynthesis?.global
          ? `<details open><summary>Global retry synthesis</summary><pre>${escapeHtml(round.retrySynthesis.global)}</pre></details>`
          : "",
        `<div class="slot-grid">${slots.map((slot) => renderSlot(runDir, slot)).join("")}</div>`,
        "</section>",
      ].join("");
    })
    .join("");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<title>HTML edit run report</title>",
    "<style>",
    "body{font-family:Inter,system-ui,sans-serif;margin:24px;background:#f6f4ef;color:#171717;line-height:1.45}",
    "h1,h2,h3,h4{margin:0 0 8px}",
    ".meta,.round-card,.request-card,.baseline-card{background:#fff;border:1px solid #d6d0c4;border-radius:14px;padding:16px;margin-bottom:16px}",
    ".baseline-images,.image-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}",
    "figure{margin:0;background:#faf8f2;border:1px solid #e6dfd0;border-radius:10px;padding:10px}",
    "img{display:block;width:100%;height:auto;border-radius:8px;background:#fff}",
    ".slot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}",
    ".slot-card{background:#fcfbf7;border:1px solid #ddd4c3;border-radius:12px;padding:14px}",
    "pre{white-space:pre-wrap;background:#f3efe5;padding:12px;border-radius:8px;overflow:auto}",
    "ul{margin:8px 0 0 20px}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${escapeHtml(state?.runId || "HTML edit run")}</h1>`,
    '<section class="meta">',
    `<p><strong>Status:</strong> ${escapeHtml(state?.status || "")}</p>`,
    `<p><strong>Mode:</strong> ${escapeHtml(state?.mode || "")}</p>`,
    `<p><strong>Surface:</strong> ${escapeHtml(state?.surface || "")}</p>`,
    `<p><strong>Slide:</strong> ${escapeHtml(state?.slideId || "")}</p>`,
    `<p><strong>Version:</strong> ${escapeHtml(state?.versionId || "")}</p>`,
    "</section>",
    '<section class="request-card">',
    "<h2>Request</h2>",
    `<p><strong>Requested change</strong></p><pre>${escapeHtml(state?.request?.requestedChange || "")}</pre>`,
    `<p><strong>Success checks</strong></p><pre>${escapeHtml(state?.request?.successChecks || "")}</pre>`,
    `<p><strong>Guardrails</strong></p><pre>${escapeHtml(state?.request?.guardrails || "None.")}</pre>`,
    "<p><strong>Approved regions</strong></p>",
    `<ul>${renderList((state?.request?.approvedRegions ?? []).map((region) => `${region.label || region.id}: ${region.freezeLevel}`))}</ul>`,
    "</section>",
    '<section class="baseline-card">',
    "<h2>Baseline</h2>",
    '<div class="baseline-images">',
    baselineOfficial
      ? `<figure><figcaption>Official baseline</figcaption><img src="${escapeHtml(baselineOfficial)}" alt="Official baseline"></figure>`
      : "",
    baselineParent
      ? `<figure><figcaption>Parent preview</figcaption><img src="${escapeHtml(baselineParent)}" alt="Parent preview"></figure>`
      : "",
    "</div>",
    "</section>",
    roundMarkup || "<p>No rounds recorded.</p>",
    "</body>",
    "</html>",
  ].join("");
};
