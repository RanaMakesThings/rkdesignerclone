import {
  pdTemplate1Theme,
  renderPdTemplate1ThemeCss,
} from "./pd-template-1.mjs";
import {
  designerV1Theme,
  renderDesignerV1ThemeCss,
} from "./designer-v1.mjs";
import {
  pdTemplate1WorkflowTheme,
  renderPdTemplate1WorkflowThemeCss,
} from "./pd-template-1-workflow.mjs";
import {
  pdTemplate1WorkflowRefinedTheme,
  renderPdTemplate1WorkflowRefinedThemeCss,
} from "./pd-template-1-workflow-refined.mjs";
import {
  pdTemplate1WorkflowRefinedGreenTheme,
  renderPdTemplate1WorkflowRefinedGreenThemeCss,
} from "./pd-template-1-workflow-refined-green.mjs";
import {
  voxClinicalTheme,
  renderVoxClinicalThemeCss,
} from "./vox-clinical.mjs";
import {
  voxEditorialTheme,
  renderVoxEditorialThemeCss,
} from "./vox-editorial.mjs";
import {
  voxMontserratTheme,
  renderVoxMontserratThemeCss,
} from "./vox-montserrat.mjs";
import {
  voxMontserratOnlyTheme,
  renderVoxMontserratOnlyThemeCss,
} from "./vox-montserrat-only.mjs";
import {
  voxSystemsTheme,
  renderVoxSystemsThemeCss,
} from "./vox-systems.mjs";
import { voxTheme, renderVoxThemeCss } from "./vox.mjs";

const THEMES = new Map([
  [designerV1Theme.id, designerV1Theme],
  [voxTheme.id, voxTheme],
  [voxMontserratOnlyTheme.id, voxMontserratOnlyTheme],
  [voxMontserratTheme.id, voxMontserratTheme],
  [voxEditorialTheme.id, voxEditorialTheme],
  [voxClinicalTheme.id, voxClinicalTheme],
  [voxSystemsTheme.id, voxSystemsTheme],
  [pdTemplate1WorkflowRefinedGreenTheme.id, pdTemplate1WorkflowRefinedGreenTheme],
  [pdTemplate1WorkflowRefinedTheme.id, pdTemplate1WorkflowRefinedTheme],
  [pdTemplate1WorkflowTheme.id, pdTemplate1WorkflowTheme],
  [pdTemplate1Theme.id, pdTemplate1Theme],
]);

const DECK_THEME_MAP = new Map([["vox-pd-v1", designerV1Theme.id]]);

export const resolveFigureTheme = (spec) => {
  const themeId =
    String(spec?.meta?.theme ?? "").trim() ||
    DECK_THEME_MAP.get(spec?.meta?.deckId) ||
    voxTheme.id;

  const theme = THEMES.get(themeId);
  if (!theme) {
    throw new Error(`Unknown figure theme: ${themeId}`);
  }

  return theme;
};

export const renderThemeCss = (theme) => {
  if (theme.id === designerV1Theme.id) {
    return renderDesignerV1ThemeCss();
  }
  if (theme.id === voxTheme.id) {
    return renderVoxThemeCss();
  }
  if (theme.id === voxMontserratOnlyTheme.id) {
    return renderVoxMontserratOnlyThemeCss();
  }
  if (theme.id === voxMontserratTheme.id) {
    return renderVoxMontserratThemeCss();
  }
  if (theme.id === voxEditorialTheme.id) {
    return renderVoxEditorialThemeCss();
  }
  if (theme.id === voxClinicalTheme.id) {
    return renderVoxClinicalThemeCss();
  }
  if (theme.id === voxSystemsTheme.id) {
    return renderVoxSystemsThemeCss();
  }
  if (theme.id === pdTemplate1WorkflowRefinedGreenTheme.id) {
    return renderPdTemplate1WorkflowRefinedGreenThemeCss();
  }
  if (theme.id === pdTemplate1WorkflowRefinedTheme.id) {
    return renderPdTemplate1WorkflowRefinedThemeCss();
  }
  if (theme.id === pdTemplate1WorkflowTheme.id) {
    return renderPdTemplate1WorkflowThemeCss();
  }
  if (theme.id === pdTemplate1Theme.id) {
    return renderPdTemplate1ThemeCss();
  }

  throw new Error(`No CSS renderer registered for theme: ${theme.id}`);
};
