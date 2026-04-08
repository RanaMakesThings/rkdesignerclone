import {
  pdTemplate1Theme,
  renderPdTemplate1ThemeCss,
} from "./pd-template-1.mjs";

export const pdTemplate1WorkflowTheme = {
  ...pdTemplate1Theme,
  id: "pd-template-1-workflow",
  label: "Designer PD template 1 workflow",
};

export const renderPdTemplate1WorkflowThemeCss = () => {
  const css = renderPdTemplate1ThemeCss();

  return `${css}

      .theme-pd-template-1-workflow .figure-inner::before,
      .theme-pd-template-1-workflow .figure-inner::after {
        content: "";
        position: absolute;
        left: 62px;
        right: 62px;
        height: 2px;
        background: rgba(0, 0, 0, 0.78);
        pointer-events: none;
      }

      .theme-pd-template-1-workflow .figure-inner::before {
        top: 8px;
      }

      .theme-pd-template-1-workflow .figure-inner::after {
        bottom: 12px;
      }

      .theme-pd-template-1-workflow .chrome,
      .theme-pd-template-1-workflow .body-shell {
        position: relative;
        z-index: 1;
      }

      .theme-pd-template-1-workflow .chrome {
        max-width: 1360px;
      }

      .theme-pd-template-1-workflow .title {
        font-size: 62px;
        line-height: 1;
        letter-spacing: -0.055em;
        font-weight: 600;
      }

      .theme-pd-template-1-workflow .mode-body-first .title {
        font-size: 56px;
      }

      .theme-pd-template-1-workflow .subtitle {
        margin-top: 14px;
        max-width: 1180px;
        font-size: 21px;
        line-height: 1.32;
        font-weight: 400;
        color: rgba(0, 0, 0, 0.7);
      }

      .theme-pd-template-1-workflow .workflow-strip-layout {
        inset: 5% 0 10% 0;
        gap: 28px;
      }

      .theme-pd-template-1-workflow .workflow-stage-row {
        grid-template-columns:
          minmax(0, 1fr)
          28px
          minmax(0, 1fr)
          28px
          minmax(0, 1fr)
          28px
          minmax(0, 1fr);
      }

      .theme-pd-template-1-workflow .workflow-stage {
        min-height: 364px;
        padding: 22px 18px 18px;
        gap: 16px;
        border-radius: 0;
        border: 1px solid rgba(0, 0, 0, 0.14);
        background: #ffffff;
        box-shadow: none;
      }

      .theme-pd-template-1-workflow .workflow-stage::before {
        left: 18px;
        right: 18px;
        top: 14px;
        height: 2px;
        border-radius: 0;
        background: rgba(0, 0, 0, 0.16);
      }

      .theme-pd-template-1-workflow .workflow-stage.role-focus {
        border-color: rgba(111, 90, 140, 0.34);
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 1) 0%,
            rgba(127, 105, 155, 0.06) 100%
          );
      }

      .theme-pd-template-1-workflow .workflow-stage.role-focus::before {
        background: linear-gradient(
          90deg,
          rgba(111, 90, 140, 0.92) 0%,
          rgba(127, 105, 155, 0.18) 100%
        );
      }

      .theme-pd-template-1-workflow .workflow-stage.role-output {
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 1) 0%,
            rgba(0, 0, 0, 0.025) 100%
          );
      }

      .theme-pd-template-1-workflow .workflow-stage-head {
        padding-top: 10px;
      }

      .theme-pd-template-1-workflow .workflow-stage-label {
        font-size: 31px;
        line-height: 1.02;
        letter-spacing: -0.055em;
        font-weight: 500;
      }

      .theme-pd-template-1-workflow .workflow-stage.role-focus .workflow-stage-label {
        color: rgba(111, 90, 140, 1);
      }

      .theme-pd-template-1-workflow .workflow-stage-detail {
        margin-top: 10px;
        min-height: 64px;
        color: rgba(0, 0, 0, 0.68);
        font-size: 17px;
        line-height: 1.32;
        font-weight: 500;
      }

      .theme-pd-template-1-workflow .workflow-stage-surface {
        padding: 12px 14px 10px;
        border-radius: 0;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: linear-gradient(
          180deg,
          rgba(252, 252, 252, 1) 0%,
          rgba(246, 246, 246, 1) 100%
        );
      }

      .theme-pd-template-1-workflow .workflow-stage.role-focus .workflow-stage-surface {
        border-color: rgba(127, 105, 155, 0.24);
        background: linear-gradient(
          180deg,
          rgba(249, 247, 252, 1) 0%,
          rgba(244, 240, 248, 1) 100%
        );
      }

      .theme-pd-template-1-workflow .workflow-artifact-label {
        margin-bottom: 12px;
        font-size: 11px;
        letter-spacing: 0.12em;
        color: rgba(0, 0, 0, 0.46);
      }

      .theme-pd-template-1-workflow .workflow-stage-items {
        gap: 0;
      }

      .theme-pd-template-1-workflow .workflow-stage-item {
        padding: 10px 0;
        border-radius: 0;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        background: transparent;
        font-size: 15px;
        line-height: 1.2;
        font-weight: 600;
      }

      .theme-pd-template-1-workflow .workflow-stage-item:first-child {
        border-top: 0;
      }

      .theme-pd-template-1-workflow .workflow-stage.role-focus .workflow-stage-item {
        color: rgba(111, 90, 140, 1);
        border-top-color: rgba(127, 105, 155, 0.18);
        background: transparent;
      }

      .theme-pd-template-1-workflow .workflow-stage.role-output .workflow-stage-item {
        background: transparent;
      }

      .theme-pd-template-1-workflow .workflow-stage-tags {
        gap: 6px;
      }

      .theme-pd-template-1-workflow .workflow-stage-tag {
        padding: 7px 8px 6px;
        border-radius: 0;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: #ffffff;
        color: rgba(0, 0, 0, 0.52);
        font-size: 10px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.12em;
      }

      .theme-pd-template-1-workflow .workflow-stage.role-focus .workflow-stage-tag {
        border-color: rgba(127, 105, 155, 0.2);
        background: rgba(249, 247, 252, 1);
        color: rgba(111, 90, 140, 1);
      }

      .theme-pd-template-1-workflow .workflow-connector {
        width: 100%;
        height: 1px;
        border-radius: 0;
        background: linear-gradient(
          90deg,
          rgba(0, 0, 0, 0.18) 0%,
          rgba(127, 105, 155, 0.36) 50%,
          rgba(0, 0, 0, 0.18) 100%
        );
      }

      .theme-pd-template-1-workflow .workflow-connector::before,
      .theme-pd-template-1-workflow .workflow-connector::after {
        display: none;
      }

      .theme-pd-template-1-workflow .workflow-strip-footer {
        max-width: 880px;
        font-size: 15px;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.5);
      }
  `;
};
