const cssVar = (name, value) => `        --${name}: ${value};`;

export const voxEditorialTheme = {
  id: "vox-editorial",
  label: "Vox editorial premium",
  fonts: {
    body: '"Manrope", "Avenir Next", "Segoe UI", sans-serif',
    display: '"Fraunces", "Iowan Old Style", serif',
    importUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;700;800&display=swap",
  },
  tokens: {
    stageBackground:
      "radial-gradient(940px 460px at 14% -8%, rgba(39, 95, 87, 0.1) 0%, rgba(39, 95, 87, 0) 72%), radial-gradient(860px 420px at 100% 0%, rgba(190, 176, 146, 0.24) 0%, rgba(190, 176, 146, 0) 74%), linear-gradient(180deg, #f1eadf 0%, #e4dacb 100%)",
    slideBackground:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0) 32%), linear-gradient(135deg, #fffaf4 0%, #f7f0e5 100%)",
    slideOverlay:
      "radial-gradient(760px 300px at 88% 80%, rgba(39, 95, 87, 0.05) 0%, rgba(39, 95, 87, 0) 72%), linear-gradient(90deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 34%)",
    surfaceCanvas: "#e6dece",
    ink: "#20332f",
    muted: "#5f6963",
    quiet: "#8d8478",
    line: "#d8d1c6",
    softLine: "rgba(32, 51, 47, 0.08)",
    card: "rgba(255, 255, 255, 0.94)",
    cardSoft: "rgba(255, 255, 255, 0.82)",
    accent: "#275f57",
    accentDeep: "#1c4a43",
    accentSoft: "#deece7",
    neutral: "#cfc6b9",
    neutralSoft: "#efe6d8",
    shadow: "0 26px 64px rgba(36, 40, 35, 0.16)",
    shadowSoft: "0 18px 38px rgba(36, 40, 35, 0.08)",
    radiusXl: "34px",
    radiusLg: "26px",
    radiusMd: "18px",
  },
  layout: {
    stagePadding: "30px",
    slideRadius: "34px",
    chromePadding: {
      fullSlide: "70px 86px 46px",
      bodyFirst: "60px 76px 42px",
      bodyOnly: "58px 72px 44px",
    },
    headerRows: {
      fullSlide: "196px 1fr",
      bodyFirst: "138px 1fr",
      bodyOnly: "1fr",
    },
  },
};

export const renderVoxEditorialThemeCss = () => {
  const { fonts, tokens, layout } = voxEditorialTheme;

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
        max-width: 1180px;
      }

      .title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 68px;
        line-height: 0.96;
        letter-spacing: -0.05em;
        font-weight: 700;
      }

      .mode-body-first .title {
        font-size: 60px;
      }

      .subtitle {
        margin: 16px 0 0;
        max-width: 940px;
        font-size: 21px;
        line-height: 1.4;
        color: var(--muted);
        font-weight: 500;
      }

      .mode-body-first .subtitle {
        font-size: 19px;
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

      .theme-vox-editorial .workflow-strip-layout {
        inset: 6% 0 8% 0;
        gap: 26px;
      }

      .theme-vox-editorial .workflow-stage-row {
        grid-template-columns:
          minmax(0, 1fr)
          52px
          minmax(0, 1fr)
          52px
          minmax(0, 1fr)
          52px
          minmax(0, 1fr);
      }

      .theme-vox-editorial .workflow-stage {
        min-height: 392px;
        padding: 30px 28px 24px;
        border-radius: 28px;
        border-color: rgba(32, 51, 47, 0.08);
        background:
          linear-gradient(
            180deg,
            rgba(255, 252, 247, 0.98) 0%,
            rgba(250, 245, 238, 0.98) 100%
          );
        box-shadow: 0 26px 52px rgba(36, 40, 35, 0.09);
      }

      .theme-vox-editorial .workflow-stage::before {
        left: 28px;
        right: 28px;
        top: 20px;
        height: 2px;
        background: linear-gradient(
          90deg,
          rgba(39, 95, 87, 0.18) 0%,
          rgba(39, 95, 87, 0.05) 100%
        );
      }

      .theme-vox-editorial .workflow-stage.role-focus {
        border-color: rgba(39, 95, 87, 0.22);
        background:
          radial-gradient(circle at 10% 10%, rgba(39, 95, 87, 0.14) 0%, rgba(39, 95, 87, 0) 38%),
          linear-gradient(
            180deg,
            rgba(240, 248, 244, 0.98) 0%,
            rgba(247, 251, 248, 0.98) 100%
          );
        box-shadow: 0 28px 60px rgba(39, 95, 87, 0.12);
      }

      .theme-vox-editorial .workflow-stage.role-focus::before {
        background: linear-gradient(
          90deg,
          rgba(39, 95, 87, 0.92) 0%,
          rgba(39, 95, 87, 0.18) 100%
        );
      }

      .theme-vox-editorial .workflow-stage.role-output {
        background:
          radial-gradient(circle at 100% 0%, rgba(190, 176, 146, 0.18) 0%, rgba(190, 176, 146, 0) 42%),
          linear-gradient(
            180deg,
            rgba(255, 252, 248, 0.98) 0%,
            rgba(248, 242, 234, 0.98) 100%
          );
      }

      .theme-vox-editorial .workflow-stage-label {
        font-size: 42px;
        letter-spacing: -0.055em;
      }

      .theme-vox-editorial .workflow-stage-detail {
        min-height: 76px;
        font-size: 17px;
        line-height: 1.42;
        font-weight: 500;
      }

      .theme-vox-editorial .workflow-stage-surface {
        padding: 16px 16px 14px;
        border-radius: 20px;
        border-color: rgba(32, 51, 47, 0.06);
        background: rgba(255, 255, 255, 0.82);
      }

      .theme-vox-editorial .workflow-stage.role-focus .workflow-stage-surface {
        border-color: rgba(39, 95, 87, 0.14);
      }

      .theme-vox-editorial .workflow-artifact-label {
        color: #8b7d69;
      }

      .theme-vox-editorial .workflow-stage-items {
        gap: 9px;
      }

      .theme-vox-editorial .workflow-stage-item {
        border-radius: 13px;
        background: rgba(244, 239, 231, 0.92);
        font-size: 14px;
      }

      .theme-vox-editorial .workflow-stage.role-focus .workflow-stage-item {
        background: rgba(225, 238, 233, 0.94);
      }

      .theme-vox-editorial .workflow-stage.role-output .workflow-stage-item {
        background: rgba(246, 240, 231, 0.96);
      }

      .theme-vox-editorial .workflow-stage-tag {
        padding: 8px 11px;
        border-color: rgba(32, 51, 47, 0.08);
        background: rgba(255, 252, 247, 0.86);
        font-size: 11px;
        letter-spacing: 0.08em;
      }

      .theme-vox-editorial .workflow-stage.role-focus .workflow-stage-tag {
        border-color: rgba(39, 95, 87, 0.14);
        background: rgba(248, 253, 250, 0.9);
      }

      .theme-vox-editorial .workflow-connector {
        height: 1px;
        background: linear-gradient(
          90deg,
          rgba(39, 95, 87, 0.12) 0%,
          rgba(39, 95, 87, 0.34) 50%,
          rgba(39, 95, 87, 0.12) 100%
        );
      }

      .theme-vox-editorial .workflow-connector::before,
      .theme-vox-editorial .workflow-connector::after {
        width: 6px;
        height: 6px;
        background: #c2b59f;
      }
  `;
};
