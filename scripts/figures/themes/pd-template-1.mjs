export const pdTemplate1Theme = {
  id: "pd-template-1",
  label: "Designer PD template 1",
  fonts: {
    body: '"Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    display: '"Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    importUrl:
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap",
  },
  tokens: {
    stageBackground: "#ffffff",
    slideBackground: "#ffffff",
    slideOverlay: "none",
    surfaceCanvas: "#ffffff",
    ink: "#000000",
    muted: "rgba(0, 0, 0, 0.72)",
    quiet: "rgba(0, 0, 0, 0.42)",
    line: "rgba(0, 0, 0, 0.15)",
    softLine: "rgba(0, 0, 0, 0.08)",
    card: "rgba(255, 255, 255, 0)",
    cardSoft: "rgba(255, 255, 255, 0)",
    accent: "#7F699B",
    accentDeep: "#6f5a8c",
    accentSoft: "rgba(127, 105, 155, 0.12)",
    neutral: "#d8d2e0",
    neutralSoft: "#f4f1f8",
    shadow: "none",
    shadowSoft: "none",
    radiusXl: "0px",
    radiusLg: "0px",
    radiusMd: "0px",
  },
  layout: {
    stagePadding: "0px",
    slideRadius: "0px",
    chromePadding: {
      fullSlide: "52px 62px 34px",
      bodyFirst: "52px 62px 34px",
      bodyOnly: "36px 48px 24px",
    },
    headerRows: {
      fullSlide: "130px 1fr",
      bodyFirst: "120px 1fr",
      bodyOnly: "1fr",
    },
  },
};

export const renderPdTemplate1ThemeCss = () => {
  const { fonts, tokens, layout } = pdTemplate1Theme;

  return `
      @import url("${fonts.importUrl}");

      :root {
        --stage-background: ${tokens.stageBackground};
        --slide-background: ${tokens.slideBackground};
        --slide-overlay: ${tokens.slideOverlay};
        --surface-canvas: ${tokens.surfaceCanvas};
        --ink: ${tokens.ink};
        --muted: ${tokens.muted};
        --quiet: ${tokens.quiet};
        --line: ${tokens.line};
        --soft-line: ${tokens.softLine};
        --card: ${tokens.card};
        --card-soft: ${tokens.cardSoft};
        --accent: ${tokens.accent};
        --accent-deep: ${tokens.accentDeep};
        --accent-soft: ${tokens.accentSoft};
        --neutral: ${tokens.neutral};
        --neutral-soft: ${tokens.neutralSoft};
        --shadow: ${tokens.shadow};
        --shadow-soft: ${tokens.shadowSoft};
        --radius-xl: ${tokens.radiusXl};
        --radius-lg: ${tokens.radiusLg};
        --radius-md: ${tokens.radiusMd};
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
        max-width: 1240px;
      }

      .title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 46px;
        line-height: 1.08;
        letter-spacing: -0.045em;
        font-weight: 700;
      }

      .subtitle {
        margin: 14px 0 0;
        max-width: 980px;
        font-size: 24px;
        line-height: 1.35;
        color: var(--muted);
        font-weight: 400;
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
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.9);
        color: var(--muted);
        font-size: 16px;
        font-weight: 500;
      }

      .body-shell {
        position: relative;
        min-height: 0;
      }

      .footnote {
        position: absolute;
        left: 62px;
        bottom: 20px;
        max-width: 1120px;
        font-size: 13px;
        line-height: 1.35;
        color: rgba(0, 0, 0, 0.34);
      }

      .theme-pd-template-1 .proof-tiles {
        inset: 20% 8% 12% 8%;
        gap: 140px;
        align-items: start;
      }

      .theme-pd-template-1 .proof-tiles.with-motif::before {
        inset: 8% 4% 18% 4%;
        background:
          repeating-linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.035) 0,
            rgba(0, 0, 0, 0.035) 1px,
            transparent 1px,
            transparent 118px
          ),
          repeating-linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.025) 0,
            rgba(0, 0, 0, 0.025) 1px,
            transparent 1px,
            transparent 84px
          );
        opacity: 0.75;
        filter: none;
      }

      .theme-pd-template-1 .proof-tiles.has-hero-motif {
        padding-top: 300px;
      }

      .theme-pd-template-1 .proof-tiles.motif-booked-month-view {
        padding-top: 470px;
      }

      .theme-pd-template-1 .proof-tiles.motif-photo-substrate,
      .theme-pd-template-1 .proof-tiles.motif-reception-window-photo,
      .theme-pd-template-1 .proof-tiles.motif-waiting-room-reality,
      .theme-pd-template-1 .proof-tiles.motif-doctor-packed-schedule {
        padding-top: 356px;
      }

      .theme-pd-template-1 .proof-tiles.motif-schedule-columns,
      .theme-pd-template-1 .proof-tiles.motif-next-available-slot,
      .theme-pd-template-1 .proof-tiles.motif-search-to-slot-care-path,
      .theme-pd-template-1 .proof-tiles.motif-demand-queue-visualization {
        padding-top: 332px;
      }

      .theme-pd-template-1 .proof-tiles.motif-appointment-book-pages,
      .theme-pd-template-1 .proof-tiles.motif-appointment-card-sequence {
        padding-top: 348px;
      }

      .theme-pd-template-1 .proof-tiles.motif-photo-diptych,
      .theme-pd-template-1 .proof-tiles.motif-phone-and-calendar-diptych {
        padding-top: 352px;
      }

      .theme-pd-template-1 .proof-tiles.motif-phone-and-scheduling-screen,
      .theme-pd-template-1 .proof-tiles.motif-appointment-book-photo {
        padding-top: 404px;
      }

      .theme-pd-template-1 .proof-motif {
        position: absolute;
        left: 6%;
        right: 6%;
        top: 2%;
        z-index: 0;
      }

      .theme-pd-template-1 .motif-photo-substrate .photo-substrate-shell {
        position: relative;
        width: min(1180px, 100%);
        height: 272px;
        margin: 0 auto;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.08);
      }

      .theme-pd-template-1 .motif-photo-substrate .photo-substrate-frame {
        width: 100%;
        height: 100%;
      }

      .theme-pd-template-1 .motif-photo-substrate .photo-substrate-overlay {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.32) 100%
          );
        pointer-events: none;
      }

      .theme-pd-template-1 .motif-photo-diptych .photo-diptych-grid {
        width: min(1120px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 26px;
      }

      .theme-pd-template-1 .motif-photo-diptych .photo-diptych-frame {
        height: 238px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.76);
      }

      .theme-pd-template-1 .motif-photo-device .photo-device-shell {
        width: 300px;
        margin: 0 auto;
        padding: 14px;
        border: 1px solid rgba(0, 0, 0, 0.10);
        background: #ffffff;
      }

      .theme-pd-template-1 .motif-photo-device .photo-device-frame {
        width: 100%;
        height: 340px;
        padding: 8px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: rgba(0, 0, 0, 0.03);
      }

      .theme-pd-template-1 .motif-photo-device .photo-device-media {
        width: 100%;
        height: 100%;
      }

      .theme-pd-template-1 .motif-photo-card .photo-card-shell {
        width: min(520px, 100%);
        margin: 0 auto;
      }

      .theme-pd-template-1 .motif-photo-card .photo-card-frame {
        width: 100%;
        height: 320px;
        border: 1px solid rgba(0, 0, 0, 0.08);
      }

      .theme-pd-template-1 .proof-tile {
        z-index: 1;
      }

      .theme-pd-template-1 .motif-booked-month-view .month-card,
      .theme-pd-template-1 .motif-next-available-slot .timeline-card {
        width: min(860px, 100%);
        margin: 0 auto;
        padding: 20px 22px 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(0, 0, 0, 0.015);
      }

      .theme-pd-template-1 .motif-booked-month-view .month-card-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 14px;
        gap: 18px;
      }

      .theme-pd-template-1 .motif-booked-month-view .month-card-title {
        font-size: 20px;
        line-height: 1;
        letter-spacing: -0.03em;
        font-weight: 700;
      }

      .theme-pd-template-1 .motif-booked-month-view .month-card-range {
        font-size: 14px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.52);
      }

      .theme-pd-template-1 .motif-booked-month-view .month-weekdays {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin-bottom: 10px;
      }

      .theme-pd-template-1 .motif-booked-month-view .weekday-label {
        font-size: 13px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.48);
      }

      .theme-pd-template-1 .motif-booked-month-view .month-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
      }

      .theme-pd-template-1 .motif-booked-month-view .day-card {
        min-height: 68px;
        padding: 8px 8px 7px;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(0, 0, 0, 0.08);
      }

      .theme-pd-template-1 .motif-booked-month-view .day-date {
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.56);
      }

      .theme-pd-template-1 .motif-booked-month-view .day-lines {
        display: grid;
        gap: 4px;
        margin-top: 8px;
      }

      .theme-pd-template-1 .motif-booked-month-view .day-line {
        position: relative;
        padding: 4px 5px;
        padding-left: 10px;
        font-size: 10px;
        line-height: 1;
        letter-spacing: -0.01em;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(0, 0, 0, 0.08);
        color: rgba(0, 0, 0, 0.82);
      }

      .theme-pd-template-1 .motif-booked-month-view .day-full .day-line::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: rgba(0, 0, 0, 0.24);
      }

      .theme-pd-template-1 .motif-booked-month-view .day-open {
        background: #ffffff;
        border: 2px solid rgba(0, 0, 0, 0.56);
      }

      .theme-pd-template-1 .motif-booked-month-view .day-open .day-line {
        background: rgba(0, 0, 0, 0.03);
        color: rgba(0, 0, 0, 0.82);
        font-weight: 600;
      }

      .theme-pd-template-1 .motif-booked-month-view .day-light .day-line {
        background: rgba(255, 255, 255, 0.82);
        color: rgba(0, 0, 0, 0.50);
        border-style: dashed;
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-board {
        width: min(980px, 100%);
        margin: 0 auto;
        padding: 18px 18px 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(0, 0, 0, 0.015);
      }

      .theme-pd-template-1 .month-card-tag,
      .theme-pd-template-1 .timeline-card-tag {
        width: max-content;
        margin: 16px auto 0;
        font-size: 15px;
        line-height: 1;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.56);
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-board-header {
        margin-bottom: 14px;
        font-size: 14px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.52);
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-columns-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 18px;
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-column {
        padding: 0;
        border: 0;
        background: transparent;
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-column-head {
        padding: 10px 10px 8px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.72);
        font-size: 14px;
        line-height: 1;
        letter-spacing: -0.02em;
        font-weight: 700;
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-slot {
        display: flex;
        position: relative;
        align-items: center;
        min-height: 32px;
        margin-top: 8px;
        padding: 0 9px 0 13px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.88);
        font-size: 12px;
        line-height: 1;
        letter-spacing: -0.01em;
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-slot span {
        color: rgba(0, 0, 0, 0.80);
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-slot-booked {
        background: rgba(255, 255, 255, 0.88);
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-slot-booked::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: rgba(0, 0, 0, 0.24);
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-slot-light {
        background: rgba(255, 255, 255, 0.64);
        border-style: dashed;
      }

      .theme-pd-template-1 .motif-schedule-columns .schedule-slot-open {
        background: #ffffff;
        border: 2px solid rgba(0, 0, 0, 0.56);
        font-weight: 700;
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-card {
        padding: 24px 40px 18px;
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-title {
        margin-bottom: 18px;
        font-size: 16px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.56);
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-track {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        align-items: start;
        gap: 24px;
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-step {
        position: relative;
        display: grid;
        justify-items: center;
        gap: 12px;
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-step::after {
        content: "";
        position: absolute;
        top: 32px;
        left: calc(50% + 34px);
        width: calc(100% - 68px);
        height: 2px;
        background: rgba(0, 0, 0, 0.10);
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-step:last-child::after {
        content: none;
      }

      .theme-pd-template-1 .motif-next-available-slot .date-card {
        position: relative;
        display: grid;
        justify-items: center;
        gap: 4px;
        width: 68px;
        padding: 8px 0 10px;
        border: 1px solid rgba(0, 0, 0, 0.10);
        background: rgba(255, 255, 255, 0.78);
      }

      .theme-pd-template-1 .motif-next-available-slot .date-card-open {
        background: #ffffff;
        border: 2px solid rgba(0, 0, 0, 0.56);
      }

      .theme-pd-template-1 .motif-next-available-slot .date-month {
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.48);
      }

      .theme-pd-template-1 .motif-next-available-slot .date-day {
        font-size: 28px;
        line-height: 1;
        letter-spacing: -0.04em;
        font-weight: 600;
      }

      .theme-pd-template-1 .motif-next-available-slot .date-cross {
        position: absolute;
        inset: 8px;
      }

      .theme-pd-template-1 .motif-next-available-slot .date-cross::before,
      .theme-pd-template-1 .motif-next-available-slot .date-cross::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 10%;
        width: 80%;
        height: 2px;
        background: rgba(0, 0, 0, 0.18);
      }

      .theme-pd-template-1 .motif-next-available-slot .date-cross::before {
        transform: rotate(35deg);
      }

      .theme-pd-template-1 .motif-next-available-slot .date-cross::after {
        transform: rotate(-35deg);
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-label {
        font-size: 13px;
        line-height: 1;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.56);
      }

      .theme-pd-template-1 .motif-next-available-slot .timeline-arrow {
        width: min(840px, 100%);
        height: 2px;
        margin: 18px auto 0;
        background: linear-gradient(
          90deg,
          rgba(0, 0, 0, 0.02) 0%,
          rgba(0, 0, 0, 0.18) 68%,
          rgba(0, 0, 0, 0.36) 100%
        );
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path {
        width: min(980px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: 230px 74px 250px 1fr;
        align-items: center;
        gap: 18px;
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-node,
      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-outcome {
        padding: 18px 18px 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.9);
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-node-center {
        background: rgba(0, 0, 0, 0.03);
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-eyebrow {
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.50);
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-label {
        margin-top: 8px;
        font-size: 22px;
        line-height: 1.05;
        letter-spacing: -0.03em;
        font-weight: 600;
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-arrow {
        position: relative;
        height: 2px;
        background: rgba(0, 0, 0, 0.14);
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-arrow::after {
        content: "";
        position: absolute;
        right: -2px;
        top: -4px;
        width: 10px;
        height: 10px;
        border-top: 2px solid rgba(0, 0, 0, 0.18);
        border-right: 2px solid rgba(0, 0, 0, 0.18);
        transform: rotate(45deg);
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-branches {
        display: grid;
        gap: 16px;
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-branch {
        display: grid;
        grid-template-columns: 34px 1fr;
        align-items: center;
        gap: 14px;
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-branch-line {
        position: relative;
        height: 2px;
        background: rgba(0, 0, 0, 0.12);
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-branch-line::after {
        content: "";
        position: absolute;
        right: -2px;
        top: -4px;
        width: 10px;
        height: 10px;
        border-top: 2px solid rgba(0, 0, 0, 0.16);
        border-right: 2px solid rgba(0, 0, 0, 0.16);
        transform: rotate(45deg);
      }

      .theme-pd-template-1 .motif-search-to-slot-care-path .care-path-outcome-break {
        border-style: dashed;
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-spread {
        width: min(920px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 26px;
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-page {
        position: relative;
        padding: 18px 18px 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.86);
        box-shadow: 0 10px 18px rgba(0, 0, 0, 0.03);
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-page::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 18px;
        width: 2px;
        background: rgba(0, 0, 0, 0.08);
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-page-next {
        border-width: 2px;
        border-color: rgba(0, 0, 0, 0.46);
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-week {
        margin-left: 16px;
        margin-bottom: 12px;
        font-size: 14px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.52);
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-row {
        display: grid;
        grid-template-columns: 46px 1fr;
        gap: 14px;
        align-items: start;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-day {
        margin-left: 16px;
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.48);
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-entry-stack {
        display: grid;
        gap: 6px;
      }

      .theme-pd-template-1 .motif-appointment-book-pages .book-entry {
        padding: 6px 8px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.92);
        font-size: 12px;
        line-height: 1;
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .queue-stage {
        width: min(980px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1.2fr 180px 0.95fr;
        gap: 26px;
        align-items: center;
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .queue-label {
        margin-bottom: 12px;
        font-size: 14px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.52);
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-stack,
      .theme-pd-template-1 .motif-demand-queue-visualization .opening-stack {
        position: relative;
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-ticket,
      .theme-pd-template-1 .motif-demand-queue-visualization .opening-ticket {
        padding: 10px 12px;
        margin-top: 10px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.9);
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-ticket:nth-child(3) {
        transform: translateX(18px);
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-ticket:nth-child(4) {
        transform: translateX(36px);
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-ticket:nth-child(5) {
        transform: translateX(54px);
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-ticket:nth-child(6) {
        transform: translateX(72px);
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-type,
      .theme-pd-template-1 .motif-demand-queue-visualization .opening-state {
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.50);
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .request-name,
      .theme-pd-template-1 .motif-demand-queue-visualization .opening-time {
        margin-top: 5px;
        font-size: 14px;
        line-height: 1;
        font-weight: 600;
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .queue-bottleneck {
        display: grid;
        justify-items: center;
        gap: 14px;
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .queue-throat {
        width: 120px;
        height: 88px;
        clip-path: polygon(0 12%, 100% 0, 100% 100%, 0 88%);
        border: 1px solid rgba(0, 0, 0, 0.10);
        background:
          linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.03) 0%,
            rgba(0, 0, 0, 0.08) 52%,
            rgba(0, 0, 0, 0.03) 100%
          );
      }

      .theme-pd-template-1 .motif-demand-queue-visualization .queue-caption {
        font-size: 12px;
        line-height: 1.2;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
        color: rgba(0, 0, 0, 0.52);
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .card-sequence {
        width: min(940px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 24px;
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .appointment-card {
        position: relative;
        min-height: 168px;
        padding: 18px 18px 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.03);
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .appointment-card-open {
        border-width: 2px;
        border-color: rgba(0, 0, 0, 0.46);
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .appointment-card-head {
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.48);
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .appointment-card-date {
        margin-top: 16px;
        font-size: 30px;
        line-height: 1;
        letter-spacing: -0.04em;
        font-weight: 600;
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .appointment-card-patient {
        margin-top: 10px;
        font-size: 14px;
        line-height: 1.2;
        color: rgba(0, 0, 0, 0.70);
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .appointment-card-stamp {
        position: absolute;
        right: 14px;
        bottom: 16px;
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border: 1px solid rgba(0, 0, 0, 0.14);
        color: rgba(0, 0, 0, 0.56);
        background: rgba(255, 255, 255, 0.86);
      }

      .theme-pd-template-1 .motif-appointment-card-sequence .appointment-card-open .appointment-card-stamp {
        border-color: rgba(0, 0, 0, 0.46);
        color: rgba(0, 0, 0, 0.84);
        font-weight: 700;
      }

      .theme-pd-template-1 .proof-tile {
        position: relative;
        padding: 0 0 42px 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }

      .theme-pd-template-1 .proof-graphic {
        position: relative;
        margin: 0 0 22px 0;
      }

      .theme-pd-template-1 .graphic-calendar-delay {
        display: grid;
        grid-template-columns: repeat(4, 58px);
        grid-template-rows: repeat(2, 28px);
        gap: 10px;
      }

      .theme-pd-template-1 .graphic-calendar-delay .g-cell {
        display: block;
        border: 1px solid rgba(0, 0, 0, 0.09);
        background: rgba(0, 0, 0, 0.02);
      }

      .theme-pd-template-1 .graphic-calendar-delay .g-cell-dark {
        background: rgba(0, 0, 0, 0.13);
        border-color: rgba(0, 0, 0, 0.18);
      }

      .theme-pd-template-1 .graphic-calendar-delay .g-appointment {
        background: rgba(0, 0, 0, 0.22);
        border-color: rgba(0, 0, 0, 0.22);
      }

      .theme-pd-template-1 .graphic-one-in-ten {
        display: flex;
        gap: 12px;
        align-items: center;
        padding-top: 8px;
      }

      .theme-pd-template-1 .graphic-one-in-ten .g-chip {
        width: 28px;
        height: 28px;
        border: 1px solid rgba(0, 0, 0, 0.10);
        background: rgba(0, 0, 0, 0.05);
      }

      .theme-pd-template-1 .graphic-one-in-ten .g-chip-dark {
        background: rgba(0, 0, 0, 0.22);
        border-color: rgba(0, 0, 0, 0.22);
      }

      .theme-pd-template-1 .graphic-booked-out {
        display: flex;
        gap: 16px;
        align-items: center;
        padding-top: 6px;
      }

      .theme-pd-template-1 .graphic-booked-out .g-bar {
        width: 92px;
        height: 22px;
        background: rgba(0, 0, 0, 0.09);
      }

      .theme-pd-template-1 .graphic-booked-out .g-bar-dark {
        background: rgba(0, 0, 0, 0.22);
      }

      .theme-pd-template-1 .graphic-broken-care-path {
        display: flex;
        align-items: center;
        gap: 18px;
        padding-top: 6px;
      }

      .theme-pd-template-1 .graphic-broken-care-path .g-node {
        position: relative;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.14);
      }

      .theme-pd-template-1 .graphic-broken-care-path .g-node::after {
        content: "";
        position: absolute;
        top: 8px;
        left: 18px;
        width: 18px;
        height: 2px;
        background: rgba(0, 0, 0, 0.12);
      }

      .theme-pd-template-1 .graphic-broken-care-path .g-node:last-child::after {
        content: none;
      }

      .theme-pd-template-1 .graphic-broken-care-path .g-node-break {
        width: 28px;
        height: 28px;
        border-radius: 0;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.18);
      }

      .theme-pd-template-1 .graphic-broken-care-path .g-node-break::before {
        content: "";
        position: absolute;
        inset: 2px;
        background:
          linear-gradient(45deg, transparent 46%, rgba(0, 0, 0, 0.18) 46%, rgba(0, 0, 0, 0.18) 54%, transparent 54%);
      }

      .theme-pd-template-1 .proof-eyebrow {
        margin-bottom: 12px;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.46);
      }

      .theme-pd-template-1 .proof-metric {
        margin-top: 0;
        font-family: var(--font-display);
        font-size: 86px;
        line-height: 0.95;
        letter-spacing: -0.055em;
        font-weight: 300;
      }

      .theme-pd-template-1 .proof-detail {
        margin-top: 18px;
        max-width: none;
        font-size: 18px;
        line-height: 1.24;
        font-weight: 400;
        letter-spacing: -0.03em;
        color: rgba(0, 0, 0, 0.78);
      }

      .theme-pd-template-1 .proof-kicker {
        margin-top: 14px;
        font-size: 20px;
        line-height: 1.18;
        font-weight: 600;
        letter-spacing: -0.03em;
        color: #000000;
      }
  `;
};
