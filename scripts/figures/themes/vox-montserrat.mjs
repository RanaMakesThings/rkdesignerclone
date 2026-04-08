import { renderVoxThemeCss, voxTheme } from "./vox.mjs";

export const voxMontserratTheme = {
  ...voxTheme,
  id: "vox-montserrat",
  label: "Vox montserrat refresh",
  fonts: {
    body: '"Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    display: '"Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    importUrl:
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap",
  },
};

export const renderVoxMontserratThemeCss = () => {
  const css = renderVoxThemeCss()
    .replace(
      /@import url\(".*?"\);/,
      `@import url("${voxMontserratTheme.fonts.importUrl}");`
    )
    .replace(
      /--font-body:\s*[^;]+;/,
      `--font-body: ${voxMontserratTheme.fonts.body};`
    )
    .replace(
      /--font-display:\s*[^;]+;/,
      `--font-display: ${voxMontserratTheme.fonts.display};`
    );

  return `${css}

      .theme-vox-montserrat .title {
        font-size: 56px;
        line-height: 0.98;
        letter-spacing: -0.05em;
        font-weight: 700;
      }

      .theme-vox-montserrat .mode-body-first .title {
        font-size: 50px;
      }

      .theme-vox-montserrat .subtitle {
        font-size: 21px;
        line-height: 1.34;
        font-weight: 500;
      }

      .theme-vox-montserrat .mode-body-first .subtitle {
        font-size: 19px;
      }

      .theme-vox-montserrat .workflow-stage-label {
        font-size: 35px;
        line-height: 1.02;
        letter-spacing: -0.055em;
        font-weight: 700;
      }

      .theme-vox-montserrat .workflow-stage-detail {
        font-size: 17px;
        line-height: 1.32;
        font-weight: 600;
      }

      .theme-vox-montserrat .workflow-artifact-label {
        font-size: 11px;
        letter-spacing: 0.09em;
      }

      .theme-vox-montserrat .workflow-stage-item {
        font-size: 14px;
        font-weight: 700;
      }

      .theme-vox-montserrat .workflow-stage-tag {
        font-size: 11px;
        letter-spacing: 0.05em;
      }
  `;
};
