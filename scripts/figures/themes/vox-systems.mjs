const cssVar = (name, value) => `        --${name}: ${value};`;

export const voxSystemsTheme = {
  id: "vox-systems",
  label: "Vox systems clean",
  fonts: {
    body: '"Inter", "Avenir Next", "Segoe UI", sans-serif',
    display: '"Archivo", "Avenir Next", sans-serif',
    importUrl:
      "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Inter:wght@400;500;600;700&display=swap",
  },
  tokens: {
    stageBackground:
      "radial-gradient(900px 420px at 12% -4%, rgba(13, 148, 136, 0.09) 0%, rgba(13, 148, 136, 0) 72%), linear-gradient(180deg, #edf4f6 0%, #e4ecef 100%)",
    slideBackground:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0) 26%), linear-gradient(135deg, #fbfcfd 0%, #f3f7f9 100%)",
    slideOverlay:
      "radial-gradient(780px 320px at 92% 82%, rgba(14, 116, 144, 0.06) 0%, rgba(14, 116, 144, 0) 72%)",
    surfaceCanvas: "#e5edef",
    ink: "#10202a",
    muted: "#4f6471",
    quiet: "#7d9099",
    line: "#d7e0e4",
    softLine: "rgba(16, 32, 42, 0.08)",
    card: "rgba(255, 255, 255, 0.96)",
    cardSoft: "rgba(255, 255, 255, 0.88)",
    accent: "#0f766e",
    accentDeep: "#0b5a54",
    accentSoft: "#d9f2ef",
    neutral: "#c6d3d8",
    neutralSoft: "#edf4f6",
    shadow: "0 22px 52px rgba(16, 32, 42, 0.1)",
    shadowSoft: "0 14px 30px rgba(16, 32, 42, 0.05)",
    radiusXl: "28px",
    radiusLg: "22px",
    radiusMd: "16px",
  },
  layout: {
    stagePadding: "28px",
    slideRadius: "28px",
    chromePadding: {
      fullSlide: "64px 74px 40px",
      bodyFirst: "58px 70px 38px",
      bodyOnly: "56px 68px 40px",
    },
    headerRows: {
      fullSlide: "178px 1fr",
      bodyFirst: "132px 1fr",
      bodyOnly: "1fr",
    },
  },
};

export const renderVoxSystemsThemeCss = () => {
  const { fonts, tokens, layout } = voxSystemsTheme;

  return `
      @import url("${fonts.importUrl}");

      :root {
${Object.entries(tokens)
  .map(([key, value]) =>
    cssVar(
      key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`),
      value
    )
  )
  .join("\n")}
        --font-body: ${fonts.body};
        --font-display: ${fonts.display};
        --stage-padding: ${layout.stagePadding};
        --slide-radius: ${layout.slideRadius};
        --chrome-padding-full-slide: ${layout.chromePadding.fullSlide};
        --chrome-padding-body-first: ${layout.chromePadding.bodyFirst};
        --chrome-padding-body-only: ${layout.chromePadding.bodyOnly};
        --header-rows-full-slide: ${layout.headerRows.fullSlide};
        --header-rows-body-first: ${layout.headerRows.bodyFirst};
        --header-rows-body-only: ${layout.headerRows.bodyOnly};
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: var(--surface-canvas);
      }

      body {
        font-family: var(--font-body);
        color: var(--ink);
      }

      .figure-stage {
        width: 100%;
        height: 100%;
        padding: var(--stage-padding);
        background: var(--stage-background);
      }

      .figure-slide {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: var(--slide-radius);
        background: var(--slide-background);
        box-shadow: var(--shadow);
      }

      .figure-slide::before {
        content: "";
        position: absolute;
        inset: 0;
        background: var(--slide-overlay);
        pointer-events: none;
      }

      .figure-inner {
        position: relative;
        z-index: 1;
        display: grid;
        width: 100%;
        height: 100%;
      }

      .mode-full-slide .figure-inner {
        grid-template-rows: var(--header-rows-full-slide);
        padding: var(--chrome-padding-full-slide);
      }

      .mode-body-first .figure-inner {
        grid-template-rows: var(--header-rows-body-first);
        padding: var(--chrome-padding-body-first);
      }

      .mode-body-only .figure-inner {
        grid-template-rows: var(--header-rows-body-only);
        padding: var(--chrome-padding-body-only);
      }

      .chrome {
        max-width: 1120px;
      }

      .title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 62px;
        line-height: 0.98;
        letter-spacing: -0.06em;
        font-weight: 700;
      }

      .mode-body-first .title {
        font-size: 56px;
      }

      .subtitle {
        margin: 14px 0 0;
        max-width: 960px;
        font-size: 20px;
        line-height: 1.36;
        color: var(--muted);
        font-weight: 500;
      }

      .mode-body-first .subtitle {
        font-size: 18px;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      .chip,
      .assumption-chip {
        display: inline-flex;
        align-items: center;
        padding: 9px 15px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.82);
        color: var(--muted);
        font-size: 16px;
        font-weight: 700;
      }

      .body-shell {
        position: relative;
        min-height: 0;
      }

      .footnote {
        position: absolute;
        left: 78px;
        bottom: 16px;
        max-width: 1120px;
        font-size: 14px;
        line-height: 1.35;
        color: rgba(23, 50, 45, 0.46);
      }

      .proof-tile,
      .focus-callout,
      .artifact-callout,
      .scenario-tile {
        position: relative;
        border: 1px solid var(--soft-line);
        border-radius: 26px;
        background: var(--card);
        box-shadow: var(--shadow-soft);
      }

      .proof-eyebrow,
      .object-label,
      .bar-label,
      .transform-eyebrow,
      .artifact-label,
      .scenario-label,
      .hero-label {
        font-size: 14px;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--quiet);
      }

      .output-card,
      .artifact-card,
      .hero-block {
        position: relative;
        border: 1px solid var(--soft-line);
        border-radius: 28px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.98) 0%,
          rgba(247, 250, 248, 0.98) 100%
        );
        box-shadow: 0 18px 40px rgba(23, 50, 45, 0.08);
      }

      .output-section-title,
      .artifact-section-title {
        margin-bottom: 8px;
        font-size: 15px;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--quiet);
      }

      .theme-vox-systems .workflow-strip-layout {
        inset: 5% 0 7% 0;
        gap: 20px;
      }

      .theme-vox-systems .workflow-stage-row {
        grid-template-columns:
          minmax(0, 1fr)
          48px
          minmax(0, 1fr)
          48px
          minmax(0, 1fr)
          48px
          minmax(0, 1fr);
      }

      .theme-vox-systems .workflow-stage {
        min-height: 364px;
        padding: 26px 22px 20px;
        border-radius: 22px;
        border-color: rgba(16, 32, 42, 0.08);
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(246, 249, 250, 0.98) 100%
          );
        box-shadow: 0 20px 38px rgba(16, 32, 42, 0.06);
      }

      .theme-vox-systems .workflow-stage::before {
        left: 22px;
        right: 22px;
        top: 16px;
        height: 5px;
        background: linear-gradient(
          90deg,
          rgba(15, 118, 110, 0.28) 0%,
          rgba(15, 118, 110, 0.08) 100%
        );
      }

      .theme-vox-systems .workflow-stage.role-focus {
        border-color: rgba(15, 118, 110, 0.22);
        background:
          radial-gradient(circle at 12% 8%, rgba(14, 116, 144, 0.14) 0%, rgba(14, 116, 144, 0) 36%),
          linear-gradient(
            180deg,
            rgba(242, 252, 251, 0.98) 0%,
            rgba(247, 251, 252, 0.98) 100%
          );
      }

      .theme-vox-systems .workflow-stage.role-focus::before {
        background: linear-gradient(90deg, #0f766e 0%, rgba(14, 116, 144, 0.3) 100%);
      }

      .theme-vox-systems .workflow-stage.role-output {
        background:
          radial-gradient(circle at 100% 0%, rgba(198, 211, 216, 0.24) 0%, rgba(198, 211, 216, 0) 42%),
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(244, 247, 249, 0.98) 100%
          );
      }

      .theme-vox-systems .workflow-stage-label {
        font-size: 36px;
        letter-spacing: -0.06em;
      }

      .theme-vox-systems .workflow-stage-detail {
        min-height: 68px;
        font-size: 17px;
        line-height: 1.36;
        font-weight: 600;
      }

      .theme-vox-systems .workflow-stage-surface {
        padding: 15px 15px 14px;
        border-radius: 18px;
        border-color: rgba(16, 32, 42, 0.06);
        background: linear-gradient(
          180deg,
          rgba(247, 250, 252, 0.98) 0%,
          rgba(241, 246, 248, 0.96) 100%
        );
      }

      .theme-vox-systems .workflow-stage.role-focus .workflow-stage-surface {
        border-color: rgba(15, 118, 110, 0.14);
      }

      .theme-vox-systems .workflow-stage-item {
        padding: 10px 12px;
        border-left: 4px solid rgba(148, 163, 184, 0.18);
        border-radius: 12px;
        background: rgba(239, 244, 246, 0.94);
        font-size: 14px;
      }

      .theme-vox-systems .workflow-stage.role-focus .workflow-stage-item {
        border-left-color: var(--accent);
        background: rgba(228, 247, 245, 0.96);
      }

      .theme-vox-systems .workflow-stage.role-output .workflow-stage-item {
        border-left-color: rgba(16, 32, 42, 0.16);
      }

      .theme-vox-systems .workflow-stage-tag {
        padding: 8px 10px;
        border-radius: 999px;
        border-color: rgba(16, 32, 42, 0.08);
        background: rgba(255, 255, 255, 0.9);
        font-size: 11px;
        letter-spacing: 0.06em;
      }

      .theme-vox-systems .workflow-stage.role-focus .workflow-stage-tag {
        border-color: rgba(15, 118, 110, 0.12);
        background: rgba(242, 252, 251, 0.92);
      }

      .theme-vox-systems .workflow-connector {
        width: calc(100% - 2px);
        height: 4px;
        background: linear-gradient(
          90deg,
          rgba(148, 163, 184, 0.36) 0%,
          rgba(14, 116, 144, 0.52) 50%,
          rgba(148, 163, 184, 0.36) 100%
        );
      }

      .theme-vox-systems .workflow-connector::before,
      .theme-vox-systems .workflow-connector::after {
        width: 12px;
        height: 12px;
        background: #ffffff;
        border: 2px solid rgba(14, 116, 144, 0.36);
      }
  `;
};
