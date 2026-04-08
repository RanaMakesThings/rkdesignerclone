import {
  pdTemplate1WorkflowRefinedGreenTheme,
  renderPdTemplate1WorkflowRefinedGreenThemeCss,
} from "./pd-template-1-workflow-refined-green.mjs";

export const designerV1Theme = {
  ...pdTemplate1WorkflowRefinedGreenTheme,
  id: "designer-v1",
  label: "Designer deck style v1",
};

export const renderDesignerV1ThemeCss = () =>
  renderPdTemplate1WorkflowRefinedGreenThemeCss();
