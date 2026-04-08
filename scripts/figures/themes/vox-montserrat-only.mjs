import { renderVoxThemeCss, voxTheme } from "./vox.mjs";

export const voxMontserratOnlyTheme = {
  ...voxTheme,
  id: "vox-montserrat-only",
  label: "Vox montserrat only",
  fonts: {
    body: '"Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    display: '"Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    importUrl:
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap",
  },
};

export const renderVoxMontserratOnlyThemeCss = () =>
  renderVoxThemeCss()
    .replace(
      /@import url\(".*?"\);/,
      `@import url("${voxMontserratOnlyTheme.fonts.importUrl}");`
    )
    .replace(
      /--font-body:\s*[^;]+;/,
      `--font-body: ${voxMontserratOnlyTheme.fonts.body};`
    )
    .replace(
      /--font-display:\s*[^;]+;/,
      `--font-display: ${voxMontserratOnlyTheme.fonts.display};`
    );
