export const voxTheme = {
  id: "vox",
  label: "Vox deck theme",
  fonts: {
    body: '"Manrope", "Avenir Next", "Segoe UI", sans-serif',
    display: '"Space Grotesk", "Avenir Next", sans-serif',
    importUrl:
      'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Montserrat:wght@500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap',
  },
  tokens: {
    stageBackground:
      "radial-gradient(1100px 520px at 10% -10%, rgba(29, 118, 108, 0.1) 0%, rgba(29, 118, 108, 0) 72%), radial-gradient(920px 460px at 100% 0%, rgba(210, 196, 166, 0.2) 0%, rgba(210, 196, 166, 0) 74%), linear-gradient(180deg, #f3efe7 0%, #e9e2d7 100%)",
    slideBackground:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.66) 0%, rgba(255, 255, 255, 0) 28%), linear-gradient(135deg, #fffdfa 0%, #fcfbf8 100%)",
    slideOverlay:
      "radial-gradient(760px 340px at 90% 82%, rgba(29, 118, 108, 0.06) 0%, rgba(29, 118, 108, 0) 72%), linear-gradient(90deg, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0) 34%)",
    surfaceCanvas: "#ece6db",
    ink: "#17322d",
    muted: "#62716d",
    quiet: "#8fa09a",
    line: "#d7dcd8",
    softLine: "rgba(23, 50, 45, 0.08)",
    card: "rgba(255, 255, 255, 0.94)",
    cardSoft: "rgba(255, 255, 255, 0.78)",
    accent: "#1d766c",
    accentDeep: "#155b53",
    accentSoft: "#d9ece8",
    neutral: "#cfd5d2",
    neutralSoft: "#edf1ef",
    shadow: "0 24px 60px rgba(23, 50, 45, 0.12)",
    shadowSoft: "0 16px 36px rgba(23, 50, 45, 0.07)",
    radiusXl: "32px",
    radiusLg: "24px",
    radiusMd: "18px",
  },
  layout: {
    stagePadding: "32px",
    slideRadius: "30px",
    chromePadding: {
      fullSlide: "64px 78px 40px",
      bodyFirst: "56px 72px 42px",
      bodyOnly: "56px 70px 44px",
    },
    headerRows: {
      fullSlide: "186px 1fr",
      bodyFirst: "128px 1fr",
      bodyOnly: "1fr",
    },
  },
};

const cssVar = (name, value) => `        --${name}: ${value};`;

export const renderVoxThemeCss = () => {
  const { fonts, tokens, layout } = voxTheme;

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
        font-size: 60px;
        line-height: 1.02;
        letter-spacing: -0.045em;
      }

      .mode-body-first .title {
        font-size: 54px;
      }

      .subtitle {
        margin: 12px 0 0;
        max-width: 980px;
        font-size: 22px;
        line-height: 1.35;
        color: var(--muted);
      }

      .mode-body-first .subtitle {
        font-size: 20px;
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
        z-index: 3;
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
  `;
};
