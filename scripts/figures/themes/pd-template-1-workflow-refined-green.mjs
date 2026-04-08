import {
  pdTemplate1WorkflowRefinedTheme,
  renderPdTemplate1WorkflowRefinedThemeCss,
} from "./pd-template-1-workflow-refined.mjs";

export const pdTemplate1WorkflowRefinedGreenTheme = {
  ...pdTemplate1WorkflowRefinedTheme,
  id: "pd-template-1-workflow-refined-green",
  label: "Designer PD template 1 workflow refined green",
};

export const renderPdTemplate1WorkflowRefinedGreenThemeCss = () => {
  const css = renderPdTemplate1WorkflowRefinedThemeCss();

  return `${css}

      .theme-pd-template-1-workflow-refined-green .workflow-stage.role-focus {
        border-color: rgba(29, 118, 108, 0.28);
      }

      .theme-pd-template-1-workflow-refined-green .workflow-stage.role-focus::before {
        background: linear-gradient(
          90deg,
          rgba(21, 91, 83, 0.92) 0%,
          rgba(29, 118, 108, 0.24) 100%
        );
      }

      .theme-pd-template-1-workflow-refined-green .workflow-stage.role-focus .workflow-stage-label {
        color: rgba(21, 91, 83, 1);
      }

      .theme-pd-template-1-workflow-refined-green .workflow-stage.role-focus .workflow-stage-surface {
        border-color: rgba(29, 118, 108, 0.2);
        background: rgba(236, 248, 246, 1);
      }

      .theme-pd-template-1-workflow-refined-green .workflow-stage.role-focus .workflow-stage-item {
        color: rgba(21, 91, 83, 0.96);
        border-top-color: rgba(29, 118, 108, 0.16);
      }

      .theme-pd-template-1-workflow-refined-green .workflow-stage.role-focus .workflow-stage-tag {
        border-color: rgba(29, 118, 108, 0.16);
        color: rgba(21, 91, 83, 0.88);
      }
  `;
};
