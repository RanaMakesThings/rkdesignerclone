const cssVar = (name, value) => `        --${name}: ${value};`;

export const voxClinicalTheme = {
  id: "vox-clinical",
  label: "Vox clinical minimal",
  fonts: {
    body: '"IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
    display: '"IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
    importUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  },
  tokens: {
    stageBackground: "linear-gradient(180deg, #eff5fb 0%, #e8eef7 100%)",
    slideBackground: "#fbfdff",
    slideOverlay: "none",
    surfaceCanvas: "#eef3f8",
    ink: "#0f172a",
    muted: "#556274",
    quiet: "#7d8a9d",
    line: "#d9e1eb",
    softLine: "rgba(15, 23, 42, 0.08)",
    card: "rgba(255, 255, 255, 0.98)",
    cardSoft: "rgba(255, 255, 255, 0.94)",
    accent: "#2563eb",
    accentDeep: "#1d4ed8",
    accentSoft: "#dde7ff",
    neutral: "#ced8e5",
    neutralSoft: "#eef3f8",
    shadow: "0 20px 42px rgba(15, 23, 42, 0.06)",
    shadowSoft: "0 12px 24px rgba(15, 23, 42, 0.04)",
    radiusXl: "24px",
    radiusLg: "18px",
    radiusMd: "12px",
  },
  layout: {
    stagePadding: "24px",
    slideRadius: "26px",
    chromePadding: {
      fullSlide: "60px 72px 38px",
      bodyFirst: "54px 66px 36px",
      bodyOnly: "52px 64px 38px",
    },
    headerRows: {
      fullSlide: "170px 1fr",
      bodyFirst: "128px 1fr",
      bodyOnly: "1fr",
    },
  },
};

export const renderVoxClinicalThemeCss = () => {
  const { fonts, tokens, layout } = voxClinicalTheme;

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
        font-size: 58px;
        line-height: 0.98;
        letter-spacing: -0.055em;
        font-weight: 700;
      }

      .mode-body-first .title {
        font-size: 52px;
      }

      .subtitle {
        margin: 14px 0 0;
        max-width: 900px;
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

      .theme-vox-clinical .workflow-strip-layout {
        inset: 4% 0 7% 0;
        gap: 18px;
      }

      .theme-vox-clinical .workflow-stage-row {
        grid-template-columns:
          minmax(0, 1fr)
          34px
          minmax(0, 1fr)
          34px
          minmax(0, 1fr)
          34px
          minmax(0, 1fr);
      }

      .theme-vox-clinical .workflow-stage {
        min-height: 356px;
        padding: 24px 22px 18px;
        border-radius: 20px;
        border: 1.5px solid #dbe4ee;
        background: #ffffff;
        box-shadow: none;
      }

      .theme-vox-clinical .workflow-stage::before {
        left: 0;
        right: 0;
        top: 0;
        height: 5px;
        border-radius: 20px 20px 0 0;
        background: #e7edf6;
      }

      .theme-vox-clinical .workflow-stage.role-focus {
        border-color: rgba(37, 99, 235, 0.22);
        background: linear-gradient(180deg, #f7faff 0%, #ffffff 100%);
        box-shadow: 0 14px 30px rgba(37, 99, 235, 0.08);
      }

      .theme-vox-clinical .workflow-stage.role-focus::before {
        background: var(--accent);
      }

      .theme-vox-clinical .workflow-stage.role-output {
        background: #fcfdff;
      }

      .theme-vox-clinical .workflow-stage-label {
        font-size: 34px;
        letter-spacing: -0.05em;
      }

      .theme-vox-clinical .workflow-stage-detail {
        min-height: 64px;
        font-size: 16px;
        line-height: 1.38;
        font-weight: 500;
      }

      .theme-vox-clinical .workflow-stage-surface {
        padding: 14px;
        border-radius: 16px;
        border-color: #e2e8f0;
        background: #fbfcfe;
      }

      .theme-vox-clinical .workflow-stage.role-focus .workflow-stage-surface {
        border-color: #dbe6ff;
        box-shadow: none;
      }

      .theme-vox-clinical .workflow-artifact-label {
        font-size: 11px;
        color: #8592a6;
      }

      .theme-vox-clinical .workflow-stage-items {
        gap: 7px;
      }

      .theme-vox-clinical .workflow-stage-item {
        padding: 10px 11px;
        border-radius: 10px;
        background: #eef3f7;
        font-size: 14px;
      }

      .theme-vox-clinical .workflow-stage.role-focus .workflow-stage-item {
        background: #e8efff;
        color: #1e3a8a;
      }

      .theme-vox-clinical .workflow-stage.role-output .workflow-stage-item {
        background: #f4f6f9;
      }

      .theme-vox-clinical .workflow-stage-tag {
        padding: 7px 9px;
        border-radius: 10px;
        border-color: #dbe4ee;
        background: #ffffff;
        font-size: 10px;
        letter-spacing: 0.05em;
        color: #6a788b;
      }

      .theme-vox-clinical .workflow-stage.role-focus .workflow-stage-tag {
        border-color: #d5e0ff;
        color: #1d4ed8;
      }

      .theme-vox-clinical .workflow-connector {
        width: 100%;
        height: 3px;
        background: linear-gradient(
          90deg,
          rgba(148, 163, 184, 0.32) 0%,
          rgba(148, 163, 184, 0.46) 50%,
          rgba(148, 163, 184, 0.32) 100%
        );
      }

      .theme-vox-clinical .workflow-connector::before,
      .theme-vox-clinical .workflow-connector::after {
        width: 10px;
        height: 10px;
        background: #cbd5e1;
      }
  `;
};
