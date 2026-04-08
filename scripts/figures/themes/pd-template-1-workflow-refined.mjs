import {
  pdTemplate1WorkflowTheme,
  renderPdTemplate1WorkflowThemeCss,
} from "./pd-template-1-workflow.mjs";

export const pdTemplate1WorkflowRefinedTheme = {
  ...pdTemplate1WorkflowTheme,
  id: "pd-template-1-workflow-refined",
  label: "Designer PD template 1 workflow refined",
};

export const renderPdTemplate1WorkflowRefinedThemeCss = () => {
  const css = renderPdTemplate1WorkflowThemeCss();

  return `${css}

      .theme-pd-template-1-workflow-refined .figure-inner::before {
        display: none;
      }

      .theme-pd-template-1-workflow-refined .figure-inner::after {
        left: 70px;
        right: 70px;
        bottom: 16px;
        height: 1px;
        background: rgba(0, 0, 0, 0.72);
      }

      .theme-pd-template-1-workflow-refined .chrome {
        max-width: 1280px;
      }

      .theme-pd-template-1-workflow-refined .title {
        font-size: 54px;
        line-height: 1.04;
        letter-spacing: -0.048em;
        font-weight: 500;
      }

      .theme-pd-template-1-workflow-refined .mode-body-first .title {
        font-size: 50px;
      }

      .theme-pd-template-1-workflow-refined .subtitle {
        margin-top: 12px;
        max-width: 960px;
        font-size: 19px;
        line-height: 1.34;
        font-weight: 400;
        color: rgba(0, 0, 0, 0.62);
      }

      .theme-pd-template-1-workflow-refined .workflow-strip-layout {
        inset: 6% 0 14% 0;
        gap: 24px;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage-row {
        grid-template-columns:
          minmax(0, 1fr)
          34px
          minmax(0, 1fr)
          34px
          minmax(0, 1fr)
          34px
          minmax(0, 1fr);
      }

      .theme-pd-template-1-workflow-refined .workflow-stage {
        min-height: 348px;
        padding: 20px 16px 16px;
        gap: 14px;
        border-radius: 0;
        border-color: rgba(0, 0, 0, 0.1);
        background: #ffffff;
        box-shadow: none;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage::before {
        left: 16px;
        right: 16px;
        top: 12px;
        background: rgba(0, 0, 0, 0.12);
      }

      .theme-pd-template-1-workflow-refined .workflow-stage.role-focus {
        border-color: rgba(127, 105, 155, 0.22);
        background: #ffffff;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage.role-focus::before {
        background: linear-gradient(
          90deg,
          rgba(111, 90, 140, 0.84) 0%,
          rgba(127, 105, 155, 0.16) 100%
        );
      }

      .theme-pd-template-1-workflow-refined .workflow-stage.role-output {
        background: #ffffff;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage-label {
        font-size: 29px;
        line-height: 1.04;
        letter-spacing: -0.05em;
        font-weight: 500;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage.role-focus .workflow-stage-label {
        color: rgba(111, 90, 140, 0.92);
      }

      .theme-pd-template-1-workflow-refined .workflow-stage-detail {
        margin-top: 8px;
        min-height: 58px;
        color: rgba(0, 0, 0, 0.6);
        font-size: 16px;
        line-height: 1.3;
        font-weight: 500;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage-surface {
        padding: 10px 12px 8px;
        border-radius: 0;
        border-color: rgba(0, 0, 0, 0.09);
        background: #ffffff;
        box-shadow: none;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage.role-focus .workflow-stage-surface {
        border-color: rgba(127, 105, 155, 0.18);
        background: rgba(250, 248, 252, 1);
      }

      .theme-pd-template-1-workflow-refined .workflow-artifact-label {
        margin-bottom: 10px;
        font-size: 10px;
        letter-spacing: 0.13em;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage-item {
        padding: 9px 0;
        border-radius: 0;
        border-top-color: rgba(0, 0, 0, 0.065);
        background: transparent;
        color: rgba(0, 0, 0, 0.82);
        font-size: 14px;
        font-weight: 600;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage.role-focus .workflow-stage-item {
        background: transparent;
        color: rgba(111, 90, 140, 0.9);
        border-top-color: rgba(127, 105, 155, 0.14);
      }

      .theme-pd-template-1-workflow-refined .workflow-stage-tag {
        padding: 6px 7px 5px;
        border-radius: 0;
        border-color: rgba(0, 0, 0, 0.1);
        background: #ffffff;
        color: rgba(0, 0, 0, 0.48);
        font-size: 9px;
        letter-spacing: 0.14em;
      }

      .theme-pd-template-1-workflow-refined .workflow-stage.role-focus .workflow-stage-tag {
        border-color: rgba(127, 105, 155, 0.16);
        background: #ffffff;
        color: rgba(111, 90, 140, 0.82);
      }

      .theme-pd-template-1-workflow-refined .workflow-connector {
        border-radius: 0;
        background: rgba(0, 0, 0, 0.12);
      }

      .theme-pd-template-1-workflow-refined .workflow-connector::before,
      .theme-pd-template-1-workflow-refined .workflow-connector::after {
        display: none;
      }
  `;
};
