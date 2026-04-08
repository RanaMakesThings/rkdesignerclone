import { CANVAS } from "./constants.mjs";
import { renderThemeCss, resolveFigureTheme } from "../themes/index.mjs";
import { renderFigureBody } from "./renderers.mjs";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderChips = (chips) =>
  chips
    .map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`)
    .join("");

export const renderFigureHtml = (spec) => {
  const bodyHtml = renderFigureBody(spec);
  const showChrome = spec.meta.mode !== "body-only";
  const theme = resolveFigureTheme(spec);
  const themeCss = renderThemeCss(theme);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(spec.chrome.title || spec.meta.slug)}</title>
    <style>
      ${themeCss}

      html,
      body {
        width: ${CANVAS.width}px;
        height: ${CANVAS.height}px;
      }

      .proof-tiles {
        position: absolute;
        inset: 4% 2% 16% 2%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
        align-items: center;
      }

      .proof-tiles.with-motif::before {
        content: "";
        position: absolute;
        inset: 26% -2% 0 -4%;
        background:
          repeating-linear-gradient(
            90deg,
            rgba(23, 50, 45, 0.04) 0,
            rgba(23, 50, 45, 0.04) 1px,
            transparent 1px,
            transparent 120px
          ),
          repeating-linear-gradient(
            180deg,
            rgba(23, 50, 45, 0.03) 0,
            rgba(23, 50, 45, 0.03) 1px,
            transparent 1px,
            transparent 88px
          );
        filter: blur(1px);
        opacity: 0.45;
      }

      .proof-tile {
        padding: 28px 30px;
      }

      .media-frame {
        position: relative;
        overflow: hidden;
      }

      .media-frame img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .media-frame.treatment-mono img {
        filter: grayscale(1) contrast(0.92) brightness(0.98);
      }

      .media-frame.treatment-soft img {
        filter: grayscale(1) contrast(0.86) brightness(1.02);
      }

      .media-frame.treatment-ink img {
        filter: grayscale(1) contrast(1.04) brightness(0.94);
      }

      .photo-frame-empty {
        border: 1px dashed var(--line);
        background: rgba(0, 0, 0, 0.03);
      }

      .proof-metric {
        margin-top: 18px;
        font-family: var(--font-display);
        font-size: 68px;
        line-height: 0.96;
        letter-spacing: -0.06em;
      }

      .proof-detail {
        margin-top: 14px;
        font-size: 24px;
        line-height: 1.24;
        font-weight: 700;
        max-width: 16ch;
      }

      .proof-kicker {
        margin-top: 16px;
        font-size: 17px;
        color: var(--muted);
      }

      .trend-breakout-layout {
        position: absolute;
        inset: 0 0 48px 0;
      }

      .trend-breakout-svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .trend-breakout-svg text {
        font-family: var(--font-body);
      }

      .trend-breakout-overline {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .trend-breakout-title {
        font-family: var(--font-display);
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.04em;
      }

      .trend-breakout-title-small {
        font-size: 25px;
      }

      .trend-breakout-unit,
      .trend-breakout-axis-label {
        font-size: 13px;
        font-weight: 600;
      }

      .trend-breakout-value {
        font-size: 14px;
        font-weight: 700;
      }

      .trend-breakout-value-strong,
      .trend-breakout-banner-number {
        font-family: var(--font-display);
        font-weight: 800;
        letter-spacing: -0.05em;
      }

      .trend-breakout-value-strong {
        font-size: 42px;
      }

      .trend-breakout-banner-number {
        font-size: 60px;
      }

      .trend-breakout-annotation-strong {
        font-size: 17px;
        font-weight: 800;
      }

      .trend-breakout-annotation,
      .trend-breakout-bar-value {
        font-size: 13px;
        font-weight: 700;
      }

      .trend-breakout-bar-label {
        font-size: 15px;
        font-weight: 700;
      }

      .trend-breakout-banner-headline {
        font-family: var(--font-display);
        font-size: 29px;
        font-weight: 700;
        letter-spacing: -0.035em;
      }

      .trend-breakout-banner-detail {
        font-size: 19px;
        font-weight: 600;
      }

      .focus-bar-layout {
        position: absolute;
        inset: 4% 0 10% 0;
      }

      .bar-shell {
        position: absolute;
        left: 1%;
        right: 31%;
        top: 24%;
      }

      .bar-label {
        margin-bottom: 16px;
      }

      .focus-bar {
        display: flex;
        align-items: stretch;
        min-height: 150px;
        border-radius: 30px;
        overflow: hidden;
        box-shadow: 0 18px 38px rgba(23, 50, 45, 0.08);
      }

      .segment {
        display: grid;
        place-items: center;
        padding: 18px;
        text-align: center;
        font-size: 29px;
        font-weight: 800;
        line-height: 1.08;
      }

      .segment-focus {
        background: linear-gradient(135deg, #25897d 0%, var(--accent) 58%, var(--accent-deep) 100%);
        color: #f8fffd;
      }

      .segment-neutral {
        background: #cfd5d2;
        color: rgba(23, 50, 45, 0.74);
      }

      .segment-quiet {
        background: #ecefef;
        color: rgba(23, 50, 45, 0.54);
      }

      .focus-callout {
        position: absolute;
        top: 10%;
        right: 2%;
        width: 360px;
        padding: 24px 24px 24px 28px;
        border-color: rgba(29, 118, 108, 0.24);
      }

      .callout-title {
        font-family: var(--font-display);
        font-size: 34px;
        line-height: 1;
        letter-spacing: -0.03em;
      }

      .focus-callout ul {
        margin: 16px 0 0;
        padding-left: 22px;
        display: grid;
        gap: 12px;
        font-size: 23px;
        line-height: 1.22;
        font-weight: 700;
      }

      .focus-callout-link {
        position: absolute;
        top: 32%;
        right: 29.5%;
        width: 84px;
        height: 2px;
        background: linear-gradient(90deg, rgba(29, 118, 108, 0.55) 0%, rgba(29, 118, 108, 0.1) 100%);
      }

      .compound-ribbon-layout {
        position: absolute;
        inset: 0;
      }

      .family-compound_ribbon_before_after .title,
      .family-compound_ribbon_before_after .subtitle,
      .family-compound_ribbon_before_after .chip,
      .family-compound_ribbon_before_after .footnote {
        font-family: "Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
      }

      .family-compound_ribbon_before_after .title {
        font-weight: 800;
        letter-spacing: -0.05em;
      }

      .family-compound_ribbon_before_after .subtitle {
        margin-top: 14px;
        max-width: 720px;
        font-size: 28px;
        line-height: 1.12;
        font-weight: 600;
        letter-spacing: -0.03em;
        color: var(--muted);
      }

      .family-compound_ribbon_before_after .chips {
        gap: 14px;
        margin-top: 22px;
      }

      .family-compound_ribbon_before_after .chip {
        padding: 12px 20px;
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
      }

      .compound-ribbon-svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .family-compound_ribbon_before_after .compound-ribbon-svg text {
        font-family: "Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
      }

      .compound-ribbon-svg text {
        font-family: var(--font-body);
      }

      .compound-ribbon-overline {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .compound-ribbon-ruler-tick {
        font-size: 13px;
        font-weight: 500;
        text-anchor: middle;
      }

      .compound-ribbon-segment-label {
        font-size: 18px;
        font-weight: 600;
        text-anchor: middle;
      }

      .compound-ribbon-callout-line {
        font-size: 18px;
        font-weight: 500;
      }

      .compound-ribbon-callout-line.is-strong {
        font-size: 22px;
        font-weight: 700;
      }

      .compound-ribbon-transition {
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-anchor: middle;
        text-transform: uppercase;
      }

      .compound-ribbon-new-visit-label {
        font-size: 16px;
        font-weight: 600;
        text-anchor: middle;
      }

      .compound-ribbon-caption {
        font-size: 15px;
        font-weight: 500;
      }

      .story-structure-layout {
        position: absolute;
        inset: 0;
      }

      .story-structure-svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .story-structure-svg text {
        font-family: var(--font-body);
      }

      .story-structure-label {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .story-structure-label-accent {
        letter-spacing: 0.08em;
      }

      .story-structure-story {
        font-size: 16px;
        font-weight: 500;
      }

      .story-structure-excerpt {
        font-size: 13px;
        font-weight: 500;
      }

      .story-structure-output {
        font-size: 15px;
        font-weight: 600;
      }

      .story-structure-callout {
        font-size: 16px;
        font-weight: 600;
        text-anchor: middle;
      }

      .story-structure-section-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .story-structure-right-item {
        font-size: 16px;
        font-weight: 500;
      }

      .story-membrane-layout {
        position: absolute;
        inset: 0;
      }

      .story-membrane-svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .story-membrane-svg text {
        font-family: var(--font-body);
      }

      .story-membrane-label {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .story-membrane-label-accent {
        letter-spacing: 0.08em;
      }

      .story-membrane-story {
        font-size: 16px;
        font-weight: 500;
      }

      .story-membrane-stream-label {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .story-membrane-chip {
        font-size: 13px;
        font-weight: 600;
        text-anchor: middle;
      }

      .story-membrane-callout {
        font-size: 16px;
        font-weight: 600;
        text-anchor: middle;
      }

      .story-membrane-section-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .story-membrane-right-item {
        font-size: 16px;
        font-weight: 500;
      }

      .workflow-strip-layout {
        position: absolute;
        inset: 3% 0 8% 0;
        display: grid;
        grid-template-rows: 1fr auto;
        gap: 22px;
        align-items: center;
      }

      .workflow-stage-row {
        position: relative;
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          44px
          minmax(0, 1fr)
          44px
          minmax(0, 1fr)
          44px
          minmax(0, 1fr);
        align-items: center;
        min-height: 0;
        overflow: visible;
      }

      .workflow-stage {
        position: relative;
        min-height: 372px;
        padding: 28px 24px 22px;
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 18px;
        border-radius: 30px;
        border: 1px solid var(--soft-line);
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(247, 250, 248, 0.98) 100%
          );
        box-shadow: 0 18px 40px rgba(23, 50, 45, 0.08);
      }

      .workflow-stage::before {
        content: "";
        position: absolute;
        left: 24px;
        right: 24px;
        top: 18px;
        height: 4px;
        border-radius: 999px;
        background: rgba(23, 50, 45, 0.08);
      }

      .workflow-stage.role-focus {
        border-color: rgba(29, 118, 108, 0.28);
        background:
          radial-gradient(circle at 12% 12%, rgba(29, 118, 108, 0.12) 0%, rgba(29, 118, 108, 0) 42%),
          linear-gradient(
            180deg,
            rgba(233, 245, 242, 0.98) 0%,
            rgba(245, 251, 249, 0.98) 100%
          );
      }

      .workflow-stage.role-focus::before {
        background: linear-gradient(90deg, var(--accent) 0%, rgba(29, 118, 108, 0.18) 100%);
      }

      .workflow-stage.role-output {
        border-color: rgba(23, 50, 45, 0.12);
        background:
          radial-gradient(circle at 100% 0%, rgba(210, 196, 166, 0.14) 0%, rgba(210, 196, 166, 0) 46%),
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(249, 248, 244, 0.98) 100%
          );
      }

      .workflow-stage-head {
        padding-top: 12px;
      }

      .workflow-stage-label {
        font-family: var(--font-display);
        font-size: 38px;
        line-height: 1;
        letter-spacing: -0.04em;
      }

      .workflow-stage.role-focus .workflow-stage-label {
        color: var(--accent-deep);
      }

      .workflow-stage-detail {
        margin-top: 12px;
        min-height: 70px;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.34;
        font-weight: 600;
      }

      .workflow-stage-surface {
        position: relative;
        padding: 16px 16px 14px;
        border-radius: 22px;
        border: 1px solid rgba(23, 50, 45, 0.08);
        background: rgba(255, 255, 255, 0.9);
      }

      .workflow-stage.role-focus .workflow-stage-surface {
        border-color: rgba(29, 118, 108, 0.18);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }

      .workflow-artifact-label {
        margin-bottom: 10px;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--quiet);
      }

      .workflow-stage-items {
        display: grid;
        gap: 8px;
      }

      .workflow-stage-item {
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(244, 247, 246, 0.96);
        color: var(--ink);
        font-size: 15px;
        line-height: 1.25;
        font-weight: 700;
      }

      .workflow-stage.role-focus .workflow-stage-item {
        background: rgba(233, 245, 242, 0.96);
        color: var(--accent-deep);
      }

      .workflow-stage.role-output .workflow-stage-item {
        background: rgba(248, 247, 243, 0.98);
      }

      .workflow-stage-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-self: end;
      }

      .workflow-stage-tag {
        display: inline-flex;
        align-items: center;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid rgba(23, 50, 45, 0.1);
        background: rgba(255, 255, 255, 0.92);
        color: var(--muted);
        font-size: 12px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .workflow-stage.role-focus .workflow-stage-tag {
        border-color: rgba(29, 118, 108, 0.16);
        color: var(--accent-deep);
      }

      .workflow-connector-wrap {
        position: relative;
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
      }

      .workflow-connector {
        width: calc(100% - 8px);
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          rgba(23, 50, 45, 0.12) 0%,
          rgba(23, 50, 45, 0.18) 50%,
          rgba(23, 50, 45, 0.12) 100%
        );
      }

      .workflow-connector::before,
      .workflow-connector::after {
        content: "";
        position: absolute;
        top: 50%;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(23, 50, 45, 0.18);
        transform: translateY(-50%);
      }

      .workflow-connector::before {
        left: -2px;
      }

      .workflow-connector::after {
        right: -2px;
      }

      .workflow-handoff {
        position: absolute;
        left: 50%;
        top: 56%;
        transform: translate(-50%, -50%);
        width: 188px;
        padding: 12px 12px 10px;
        border-radius: 20px;
        border: 1px solid rgba(29, 118, 108, 0.18);
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(245, 251, 249, 0.98) 100%
          );
        box-shadow: 0 14px 28px rgba(23, 50, 45, 0.1);
        z-index: 2;
      }

      .workflow-handoff-label {
        margin-bottom: 8px;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent-deep);
      }

      .workflow-handoff-items {
        display: grid;
        gap: 7px;
      }

      .workflow-handoff-item {
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(233, 245, 242, 0.96);
        color: var(--accent-deep);
        font-size: 12px;
        line-height: 1.2;
        font-weight: 800;
      }

      .workflow-handoff-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }

      .workflow-handoff-tag {
        display: inline-flex;
        align-items: center;
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid rgba(29, 118, 108, 0.16);
        background: rgba(255, 255, 255, 0.94);
        color: var(--accent-deep);
        font-size: 11px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .workflow-strip-footer {
        justify-self: center;
        max-width: 760px;
        color: var(--quiet);
        font-size: 16px;
        line-height: 1.35;
        font-weight: 700;
        text-align: center;
      }

      .transform-layout {
        position: absolute;
        inset: 4% 0 9% 0;
        display: grid;
        grid-template-columns: 1.05fr 0.92fr 1fr;
        align-items: center;
        gap: 28px;
      }

      .story-object {
        position: relative;
        min-height: 348px;
        padding: 28px 28px 34px;
        border: 1px solid var(--soft-line);
        border-radius: 38% 34% 36% 32% / 24% 34% 28% 30%;
        background:
          radial-gradient(circle at 24% 24%, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0) 46%),
          linear-gradient(135deg, #f9f4eb 0%, #f2ebe1 100%);
        box-shadow: 0 18px 40px rgba(23, 50, 45, 0.08);
      }

      .story-object::after {
        content: "";
        position: absolute;
        right: 30px;
        bottom: -20px;
        width: 62px;
        height: 62px;
        border-radius: 18px 22px 24px 28px;
        background: linear-gradient(135deg, #f4ecdf 0%, #efe4d4 100%);
        transform: rotate(34deg);
      }

      .story-fragments {
        display: grid;
        gap: 12px;
        margin-top: 18px;
      }

      .story-fragment {
        max-width: max-content;
        padding: 12px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: 0 8px 18px rgba(23, 50, 45, 0.05);
        font-size: 22px;
        font-weight: 700;
        line-height: 1.2;
      }

      .story-fragment:nth-child(2n) {
        margin-left: 38px;
      }

      .story-fragment:nth-child(3n) {
        margin-left: 16px;
      }

      .transform-core-wrap {
        display: grid;
        gap: 18px;
        justify-items: center;
      }

      .transform-core {
        position: relative;
        width: 100%;
        min-height: 216px;
        padding: 28px 28px 26px;
        border-radius: 30px;
        background: linear-gradient(135deg, #23877b 0%, var(--accent) 52%, var(--accent-deep) 100%);
        box-shadow: 0 22px 48px rgba(23, 50, 45, 0.16);
        color: #f8fffd;
      }

      .transform-core::before {
        content: "";
        position: absolute;
        inset: 12px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 22px;
      }

      .transform-label {
        position: relative;
        z-index: 1;
        margin-top: 18px;
        font-family: var(--font-display);
        font-size: 42px;
        line-height: 1.03;
        letter-spacing: -0.04em;
      }

      .transform-caption {
        position: relative;
        z-index: 1;
        margin-top: 14px;
        max-width: 18ch;
        color: rgba(248, 255, 253, 0.78);
        font-size: 19px;
        line-height: 1.3;
        font-weight: 600;
      }

      .transform-callout {
        max-width: 288px;
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(29, 118, 108, 0.24);
        background: rgba(255, 255, 255, 0.96);
        text-align: center;
        font-size: 18px;
        line-height: 1.28;
        font-weight: 700;
        box-shadow: 0 12px 28px rgba(23, 50, 45, 0.07);
      }

      .output-card {
        min-height: 360px;
        padding: 28px;
      }

      .output-sections {
        display: grid;
        gap: 14px;
        margin-top: 20px;
      }

      .output-section {
        padding: 14px 16px;
        border-radius: 16px;
        background: linear-gradient(180deg, #f2f6f5 0%, #edf2f1 100%);
      }

      .output-line,
      .artifact-row {
        font-size: 20px;
        line-height: 1.28;
        font-weight: 700;
      }

      .output-note {
        margin-top: 16px;
        font-size: 17px;
        line-height: 1.35;
        color: var(--muted);
      }

      .transform-link {
        position: absolute;
        top: 50%;
        width: 44px;
        height: 2px;
        background: linear-gradient(90deg, rgba(23, 50, 45, 0.18) 0%, rgba(23, 50, 45, 0.06) 100%);
      }

      .transform-link-left {
        left: calc(33.333% - 8px);
      }

      .transform-link-right {
        right: calc(33.333% - 10px);
      }

      .artifact-layout {
        position: absolute;
        inset: 3% 0 7% 0;
      }

      .artifact-card {
        position: absolute;
        left: 24%;
        right: 24%;
        top: 10%;
        bottom: 10%;
        padding: 26px 26px 24px;
      }

      .artifact-label {
        font-size: 15px;
      }

      .artifact-sections {
        display: grid;
        gap: 14px;
        margin-top: 20px;
      }

      .artifact-section {
        padding: 16px;
        border-radius: 18px;
        background: linear-gradient(180deg, #f5f8f7 0%, #eef3f1 100%);
      }

      .artifact-callout {
        position: absolute;
        width: 248px;
        padding: 18px 18px 20px;
      }

      .artifact-callout-label {
        font-family: var(--font-display);
        font-size: 28px;
        line-height: 1.04;
        letter-spacing: -0.03em;
      }

      .artifact-callout-detail {
        margin-top: 12px;
        font-size: 18px;
        line-height: 1.3;
        font-weight: 700;
        color: var(--muted);
      }

      .anchor-left-top {
        left: 2%;
        top: 6%;
      }

      .anchor-left-bottom {
        left: 0;
        bottom: 12%;
      }

      .anchor-right-middle {
        right: 2%;
        top: 31%;
      }

      .anchor-right-top {
        right: 2%;
        top: 8%;
      }

      .hero-metric-layout {
        position: absolute;
        inset: 4% 0 10% 0;
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        grid-template-rows: 1fr auto;
        gap: 22px 28px;
      }

      .hero-block {
        padding: 28px 30px 28px;
        background: linear-gradient(135deg, rgba(29, 118, 108, 0.08) 0%, rgba(255, 255, 255, 0.98) 42%, rgba(255, 255, 255, 0.98) 100%);
      }

      .hero-assumptions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .hero-primary-metric {
        margin-top: 24px;
        font-family: var(--font-display);
        font-size: 84px;
        line-height: 0.95;
        letter-spacing: -0.06em;
      }

      .hero-secondary-line {
        margin-top: 16px;
        font-size: 21px;
        line-height: 1.32;
        color: var(--muted);
        font-weight: 700;
      }

      .scenario-stack {
        display: grid;
        gap: 16px;
      }

      .scenario-tile {
        padding: 22px 22px 20px;
      }

      .scenario-metric {
        margin-top: 14px;
        font-family: var(--font-display);
        font-size: 48px;
        line-height: 0.98;
        letter-spacing: -0.05em;
      }

      .scenario-detail {
        margin-top: 12px;
        font-size: 18px;
        line-height: 1.3;
        font-weight: 700;
        color: var(--muted);
      }

      .hero-bottom-line {
        grid-column: 1 / -1;
        align-self: end;
        font-size: 23px;
        line-height: 1.28;
        font-weight: 800;
        color: var(--ink);
      }
    </style>
  </head>
  <body>
    <div class="figure-stage mode-${escapeHtml(spec.meta.mode)} theme-${escapeHtml(
      theme.id
    )}">
      <section class="figure-slide family-${escapeHtml(spec.meta.family)}">
        <div class="figure-inner">
          ${
            showChrome
              ? `<header class="chrome">
                  <h1 class="title">${escapeHtml(spec.chrome.title)}</h1>
                  ${
                    spec.chrome.subtitle
                      ? `<p class="subtitle">${escapeHtml(spec.chrome.subtitle)}</p>`
                      : ""
                  }
                  ${
                    spec.chrome.chips.length > 0
                      ? `<div class="chips">${renderChips(spec.chrome.chips)}</div>`
                      : ""
                  }
                </header>`
              : ""
          }
          <main class="body-shell">
            ${bodyHtml}
          </main>
        </div>
        ${
          spec.chrome.footnote
            ? `<div class="footnote">${escapeHtml(spec.chrome.footnote)}</div>`
            : ""
        }
      </section>
    </div>
  </body>
</html>
`;
};
