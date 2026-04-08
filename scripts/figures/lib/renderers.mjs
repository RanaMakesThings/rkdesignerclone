const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const join = (items) => items.filter(Boolean).join("");

const normalizeWidth = (width) => {
  const numeric = Number(width);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  if (numeric <= 1) {
    return numeric * 100;
  }
  return numeric;
};

const wrapText = (value, maxChars) => {
  const words = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
      continue;
    }
    current = next;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

const toClassSlug = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const renderSelectedMediaFrame = (media, extraClass = "") => {
  if (!media?.src) {
    return "";
  }

  const treatment = toClassSlug(media.treatment || "mono") || "mono";
  const style = [
    media.objectPosition ? `object-position:${escapeHtml(media.objectPosition)}` : "",
    Number.isFinite(media.opacity) ? `opacity:${media.opacity}` : "",
  ]
    .filter(Boolean)
    .join(";");

  return `
    <figure class="media-frame treatment-${treatment} ${extraClass}">
      <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt || "")}"${style ? ` style="${style}"` : ""} />
    </figure>
  `;
};

const resolveSelectionsForPlacement = (selections, placement) =>
  selections.filter((entry) => entry.placement === placement);

const resolveFirstSelection = (selections, placements) => {
  for (const placement of placements) {
    const match = selections.find((entry) => entry.placement === placement);
    if (match) {
      return match;
    }
  }
  return null;
};

const renderProofTiles = (spec) => {
  const body = spec.body;
  const motifKind = String(body.motif ?? "").trim();
  const motifClass = motifKind ? `motif-${toClassSlug(motifKind)}` : "";
  const usesGridMotif = motifKind === "calendar";
  const usesHeroMotif = new Set([
    "booked-month-view",
    "schedule-columns",
    "next-available-slot",
    "search-to-slot-care-path",
    "appointment-book-pages",
    "demand-queue-visualization",
    "appointment-card-sequence",
    "photo-substrate",
    "reception-window-photo",
    "waiting-room-reality",
    "doctor-packed-schedule",
    "appointment-book-photo",
    "photo-diptych",
    "phone-and-calendar-diptych",
    "phone-and-scheduling-screen",
  ]).has(motifKind);
  const selections = Array.isArray(spec.media?.resolvedSelections)
    ? spec.media.resolvedSelections
    : [];

  const renderProofMotif = (kind) => {
    if (
      [
        "photo-substrate",
        "reception-window-photo",
        "waiting-room-reality",
        "doctor-packed-schedule",
      ].includes(kind)
    ) {
      const media =
        resolveFirstSelection(selections, ["background", "motif", "hero"]) ??
        selections[0] ??
        null;

      if (!media) {
        return "";
      }

      return `
        <div class="proof-motif motif-photo-substrate" aria-hidden="true">
          <div class="photo-substrate-shell">
            ${renderSelectedMediaFrame(media, "photo-substrate-frame")}
            <div class="photo-substrate-overlay"></div>
          </div>
        </div>
      `;
    }

    if (["photo-diptych", "phone-and-calendar-diptych"].includes(kind)) {
      const left =
        resolveFirstSelection(selections, ["left", "motif-left"]) ??
        selections[0] ??
        null;
      const right =
        resolveFirstSelection(selections, ["right", "motif-right"]) ??
        selections[1] ??
        null;

      if (!left && !right) {
        return "";
      }

      return `
        <div class="proof-motif motif-photo-diptych" aria-hidden="true">
          <div class="photo-diptych-grid">
            ${left ? renderSelectedMediaFrame(left, "photo-diptych-frame") : '<div class="photo-diptych-frame photo-frame-empty"></div>'}
            ${right ? renderSelectedMediaFrame(right, "photo-diptych-frame") : '<div class="photo-diptych-frame photo-frame-empty"></div>'}
          </div>
        </div>
      `;
    }

    if (["phone-and-scheduling-screen"].includes(kind)) {
      const media =
        resolveFirstSelection(selections, ["device", "motif", "hero"]) ??
        selections[0] ??
        null;

      if (!media) {
        return "";
      }

      return `
        <div class="proof-motif motif-photo-device" aria-hidden="true">
          <div class="photo-device-shell">
            <div class="photo-device-frame">
              ${renderSelectedMediaFrame(media, "photo-device-media")}
            </div>
          </div>
        </div>
      `;
    }

    if (["appointment-book-photo"].includes(kind)) {
      const media =
        resolveFirstSelection(selections, ["motif", "hero", "background"]) ??
        selections[0] ??
        null;

      if (!media) {
        return "";
      }

      return `
        <div class="proof-motif motif-photo-card" aria-hidden="true">
          <div class="photo-card-shell">
            ${renderSelectedMediaFrame(media, "photo-card-frame")}
          </div>
        </div>
      `;
    }

    if (kind === "appointment-book-pages") {
      const pages = [
        {
          week: "Week of Mar 18",
          entries: [
            ["Mon", "8:30 J. Smith", "2:15 M. Chen"],
            ["Tue", "9:00 R. Shah", "1:45 P. Ruiz"],
            ["Wed", "8:15 D. Lee", "3:30 N. Kim"],
            ["Thu", "10:00 A. Park", "2:00 O. Diaz"],
          ],
        },
        {
          week: "Week of Apr 8",
          entries: [
            ["Mon", "8:00 T. Ali", "2:15 D. Moss"],
            ["Tue", "9:15 C. Green", "1:30 H. Lee"],
            ["Wed", "8:45 S. Kim", "3:00 A. Ruiz"],
            ["Thu", "Apr 11", "Next opening", "2:30 PM"],
          ],
        },
      ];

      return `
        <div class="proof-motif motif-appointment-book-pages" aria-hidden="true">
          <div class="book-spread">
            ${pages
              .map(
                (page, pageIndex) => `
                  <div class="book-page ${pageIndex === 1 ? "book-page-next" : ""}">
                    <div class="book-week">${escapeHtml(page.week)}</div>
                    ${page.entries
                      .map(
                        (entry) => `
                          <div class="book-row">
                            <div class="book-day">${escapeHtml(entry[0])}</div>
                            <div class="book-entry-stack">
                              ${entry
                                .slice(1)
                                .map((item) => `<div class="book-entry">${escapeHtml(item)}</div>`)
                                .join("")}
                            </div>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    if (kind === "booked-month-view") {
      const weeks = [
        [
          { date: "Mar 18", state: "full", lines: ["8:30 Patel", "1:45 Chen"] },
          { date: "Mar 19", state: "full", lines: ["9:00 Ruiz", "2:00 Shah"] },
          { date: "Mar 20", state: "full", lines: ["8:15 Lee", "3:30 Kim"] },
          { date: "Mar 21", state: "full", lines: ["10:00 Park", "2:15 Diaz"] },
          { date: "Mar 22", state: "full", lines: ["9:30 Ali", "4:00 Moss"] },
        ],
        [
          { date: "Mar 25", state: "full", lines: ["8:45 Shah", "1:30 Chen"] },
          { date: "Mar 26", state: "full", lines: ["9:15 Ruiz", "2:45 Green"] },
          { date: "Mar 27", state: "full", lines: ["8:00 Lee", "11:30 Ali"] },
          { date: "Mar 28", state: "full", lines: ["10:30 Patel", "3:00 Kim"] },
          { date: "Mar 29", state: "full", lines: ["9:00 Diaz", "1:00 Park"] },
        ],
        [
          { date: "Apr 1", state: "full", lines: ["8:30 Shah", "2:30 Lee"] },
          { date: "Apr 2", state: "full", lines: ["9:45 Green", "1:15 Ali"] },
          { date: "Apr 3", state: "full", lines: ["8:15 Chen", "2:00 Ruiz"] },
          { date: "Apr 4", state: "full", lines: ["9:30 Moss", "3:15 Patel"] },
          { date: "Apr 5", state: "full", lines: ["10:00 Park", "1:45 Diaz"] },
        ],
        [
          { date: "Apr 8", state: "full", lines: ["8:00 Lee", "2:15 Shah"] },
          { date: "Apr 9", state: "full", lines: ["9:15 Ruiz", "1:30 Kim"] },
          { date: "Apr 10", state: "full", lines: ["8:45 Chen", "3:00 Ali"] },
          { date: "Apr 11", state: "open", lines: ["Next opening", "2:30 PM"] },
          { date: "Apr 12", state: "light", lines: ["Waitlist only", ""] },
        ],
      ];

      return `
        <div class="proof-motif motif-booked-month-view" aria-hidden="true">
          <div class="month-card">
            <div class="month-card-top">
              <div class="month-card-title">Primary Care Scheduling</div>
              <div class="month-card-range">March-April 2024</div>
            </div>
            <div class="month-weekdays">
              ${["Mon", "Tue", "Wed", "Thu", "Fri"]
                .map((label) => `<span class="weekday-label">${label}</span>`)
                .join("")}
            </div>
            <div class="month-grid">
              ${weeks
                .flat()
                .map(
                  (day) => `
                    <div class="day-card day-${day.state}">
                      <div class="day-date">${escapeHtml(day.date)}</div>
                      <div class="day-lines">
                        ${day.lines
                          .filter(Boolean)
                          .map((line) => `<div class="day-line">${escapeHtml(line)}</div>`)
                          .join("")}
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="month-card-tag">First opening appears in week 4</div>
          </div>
        </div>
      `;
    }

    if (kind === "schedule-columns") {
      const clinicians = [
        {
          name: "Dr. Patel",
          slots: ["8:30 Chen", "9:15 Ruiz", "10:45 Kim", "1:15 Ali", "2:30 Diaz", "3:45 Moss"],
          open: null,
        },
        {
          name: "Dr. Lee",
          slots: ["8:00 Shah", "9:30 Chen", "11:00 Park", "1:45 Ruiz", "3:00 Green", "4:15 Ali"],
          open: null,
        },
        {
          name: "Dr. Ruiz",
          slots: ["8:15 Patel", "9:45 Kim", "11:30 Chen", "1:00 Shah", "2:15 Park", "3:30 Diaz"],
          open: null,
        },
        {
          name: "Dr. Shah",
          slots: ["8:45 Moss", "10:00 Green", "11:15 Ali", "1:30 Kim", "2:45 Ruiz", "4:00 Lee"],
          open: null,
        },
        {
          name: "Dr. Chen",
          slots: ["8:30 Patel", "9:00 Diaz", "10:15 Park", "11:45 Lee", "", ""],
          open: "2:30 open",
        },
      ];

      return `
        <div class="proof-motif motif-schedule-columns" aria-hidden="true">
          <div class="schedule-board">
            <div class="schedule-board-header">Week of March 11</div>
            <div class="schedule-columns-grid">
            ${clinicians
              .map((column) => {
                return `
                  <div class="schedule-column">
                    <div class="schedule-column-head">${escapeHtml(column.name)}</div>
                    ${column.slots
                      .map((slot) => {
                        const classes = ["schedule-slot"];
                        if (!slot) {
                          classes.push("schedule-slot-light");
                          return `<div class="${classes.join(" ")}"></div>`;
                        }
                        classes.push("schedule-slot-booked");
                        return `<div class="${classes.join(" ")}"><span>${escapeHtml(slot)}</span></div>`;
                      })
                      .join("")}
                    ${
                      column.open
                        ? `<div class="schedule-slot schedule-slot-open"><span>${escapeHtml(column.open)}</span></div>`
                        : ""
                    }
                  </div>
                `;
              })
              .join("")}
            </div>
          </div>
        </div>
      `;
    }

    if (kind === "next-available-slot") {
      const dates = [
        { day: "18", month: "MAR", state: "past", note: "requested" },
        { day: "25", month: "MAR", state: "past", note: "full" },
        { day: "01", month: "APR", state: "past", note: "full" },
        { day: "08", month: "APR", state: "open", note: "next opening" },
      ];

      return `
        <div class="proof-motif motif-next-available-slot" aria-hidden="true">
          <div class="timeline-card">
            <div class="timeline-title">Next available appointment</div>
            <div class="timeline-track">
              ${dates
                .map(
                  (entry, index) => `
                    <div class="timeline-step">
                      <div class="date-card ${entry.state === "open" ? "date-card-open" : "date-card-past"}">
                        <span class="date-month">${escapeHtml(entry.month)}</span>
                        <span class="date-day">${escapeHtml(entry.day)}</span>
                        ${entry.state === "past" ? `<span class="date-cross"></span>` : ""}
                      </div>
                      <span class="timeline-label">${escapeHtml(entry.note)}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="timeline-arrow"></div>
            <div class="timeline-card-tag">Four weeks from request to first opening</div>
          </div>
        </div>
      `;
    }

    if (kind === "search-to-slot-care-path") {
      return `
        <div class="proof-motif motif-search-to-slot-care-path" aria-hidden="true">
          <div class="care-path">
            <div class="care-path-node">
              <div class="care-path-eyebrow">Need arises</div>
              <div class="care-path-label">Patient needs care</div>
            </div>
            <div class="care-path-arrow"></div>
            <div class="care-path-node care-path-node-center">
              <div class="care-path-eyebrow">Scheduling work</div>
              <div class="care-path-label">Search for an opening</div>
            </div>
            <div class="care-path-branches">
              <div class="care-path-branch">
                <div class="care-path-branch-line"></div>
                <div class="care-path-outcome">
                  <div class="care-path-eyebrow">Access delay</div>
                  <div class="care-path-label">Week 4 slot</div>
                </div>
              </div>
              <div class="care-path-branch">
                <div class="care-path-branch-line"></div>
                <div class="care-path-outcome care-path-outcome-break">
                  <div class="care-path-eyebrow">Dropoff risk</div>
                  <div class="care-path-label">No slot available</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (kind === "demand-queue-visualization") {
      const requests = [
        ["New patient", "K. Patel"],
        ["Abdominal pain", "R. Shah"],
        ["Follow-up", "M. Chen"],
        ["Medication check", "A. Ruiz"],
        ["Referral", "D. Lee"],
      ];
      const openings = [
        ["Tue 2:30 PM", "available"],
        ["Thu 11:15 AM", "available"],
      ];

      return `
        <div class="proof-motif motif-demand-queue-visualization" aria-hidden="true">
          <div class="queue-stage">
            <div class="request-stack">
              <div class="queue-label">Incoming requests</div>
              ${requests
                .map(
                  (request) => `
                    <div class="request-ticket">
                      <div class="request-type">${escapeHtml(request[0])}</div>
                      <div class="request-name">${escapeHtml(request[1])}</div>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="queue-bottleneck">
              <div class="queue-throat"></div>
              <div class="queue-caption">Fixed appointment supply</div>
            </div>
            <div class="opening-stack">
              <div class="queue-label">Available appointments</div>
              ${openings
                .map(
                  (opening) => `
                    <div class="opening-ticket">
                      <div class="opening-time">${escapeHtml(opening[0])}</div>
                      <div class="opening-state">${escapeHtml(opening[1])}</div>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      `;
    }

    if (kind === "appointment-card-sequence") {
      const cards = [
        { date: "Mar 18", patient: "New patient", state: "full" },
        { date: "Mar 25", patient: "No opening", state: "full" },
        { date: "Apr 1", patient: "Waitlist only", state: "full" },
        { date: "Apr 8", patient: "Next available", state: "open" },
      ];

      return `
        <div class="proof-motif motif-appointment-card-sequence" aria-hidden="true">
          <div class="card-sequence">
            ${cards
              .map(
                (card, index) => `
                  <div class="appointment-card ${card.state === "open" ? "appointment-card-open" : "appointment-card-full"}" style="transform: rotate(${index === 0 ? "-5" : index === 1 ? "-2" : index === 2 ? "2" : "5"}deg);">
                    <div class="appointment-card-head">Appointment request</div>
                    <div class="appointment-card-date">${escapeHtml(card.date)}</div>
                    <div class="appointment-card-patient">${escapeHtml(card.patient)}</div>
                    <div class="appointment-card-stamp">${card.state === "open" ? "Available" : "Full"}</div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    return "";
  };

  const renderTileGraphic = (graphic) => {
    const kind = String(graphic?.kind ?? "").trim();
    if (!kind) {
      return "";
    }

    if (kind === "calendar-delay") {
      return `
        <div class="proof-graphic graphic-calendar-delay" aria-hidden="true">
          <span class="g-cell"></span>
          <span class="g-cell"></span>
          <span class="g-cell"></span>
          <span class="g-cell g-cell-dark"></span>
          <span class="g-cell"></span>
          <span class="g-cell"></span>
          <span class="g-cell"></span>
          <span class="g-cell g-appointment"></span>
        </div>
      `;
    }

    if (kind === "one-in-ten") {
      return `
        <div class="proof-graphic graphic-one-in-ten" aria-hidden="true">
          ${Array.from({ length: 10 })
            .map((_, index) =>
              `<span class="g-chip ${index === 9 ? "g-chip-dark" : ""}"></span>`
            )
            .join("")}
        </div>
      `;
    }

    if (kind === "booked-out") {
      return `
        <div class="proof-graphic graphic-booked-out" aria-hidden="true">
          <span class="g-bar"></span>
          <span class="g-bar"></span>
          <span class="g-bar"></span>
          <span class="g-bar g-bar-dark"></span>
        </div>
      `;
    }

    if (kind === "broken-care-path") {
      return `
        <div class="proof-graphic graphic-broken-care-path" aria-hidden="true">
          <span class="g-node"></span>
          <span class="g-node"></span>
          <span class="g-node"></span>
          <span class="g-node"></span>
          <span class="g-node g-node-break"></span>
        </div>
      `;
    }

    return "";
  };

  const tiles = body.tiles
    .map(
      (tile) => `
        <article class="proof-tile">
          ${renderTileGraphic(tile.graphic)}
          <div class="proof-eyebrow">${escapeHtml(tile.eyebrow)}</div>
          <div class="proof-metric">${escapeHtml(tile.metric)}</div>
          <div class="proof-detail">${escapeHtml(tile.detail)}</div>
          ${
            tile.kicker
              ? `<div class="proof-kicker">${escapeHtml(tile.kicker)}</div>`
              : ""
          }
        </article>
      `
    )
    .join("");

  return `
    <section class="proof-tiles ${usesGridMotif ? "with-motif" : ""} ${usesHeroMotif ? "has-hero-motif" : ""} ${motifClass}">
      ${renderProofMotif(motifKind)}
      ${tiles}
    </section>
  `;
};

const renderTrendBreakoutBanner = (body) => {
  const palette = {
    ink: "#18212b",
    muted: "#5f6b77",
    quiet: "#8c96a1",
    line: "#dbe2e8",
    lineSoft: "#edf2f5",
    panel: "#f7f9fb",
    accent: "#2f6f86",
    accentSoft: "#d9e7ee",
    accentDeep: "#1f5567",
    bannerBg: "#efe7da",
    bannerLine: "#d7c6b1",
    warm: "#8f7158",
  };

  const trend = body.trend ?? {};
  const breakout = body.breakout ?? {};
  const banner = body.banner ?? {};
  const points = [...(trend.points ?? [])].sort((a, b) => a.year - b.year);
  const bars = [...(breakout.bars ?? [])].sort((a, b) => b.value - a.value);

  const chart = { x: 84, y: 124, width: 900, height: 368 };
  const panel = { x: 1050, y: 132, width: 442, height: 372, radius: 28 };
  const bannerBox = { x: 84, y: 540, width: 1432, height: 220, radius: 34 };

  const minYear = Math.min(...points.map((point) => point.year));
  const maxYear = Math.max(...points.map((point) => point.year));
  const yearRange = Math.max(1, maxYear - minYear);
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const valueFloor = Math.floor(minValue / 2) * 2 - 2;
  const valueCeil = Math.ceil(maxValue / 2) * 2 + 2;
  const valueRange = Math.max(1, valueCeil - valueFloor);
  const yTicks = [];
  for (let tick = valueFloor; tick <= valueCeil; tick += 4) {
    yTicks.push(tick);
  }

  const plotted = points.map((point) => {
    const x =
      chart.x + (((point.year - minYear) / yearRange) * chart.width);
    const y =
      chart.y +
      chart.height -
      (((point.value - valueFloor) / valueRange) * chart.height);
    return { ...point, x, y };
  });

  const trendPath = plotted
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(" ");

  const yGrid = yTicks
    .map((tick) => {
      const y =
        chart.y +
        chart.height -
        (((tick - valueFloor) / valueRange) * chart.height);
      return `
        <line
          x1="${chart.x}"
          y1="${y.toFixed(2)}"
          x2="${(chart.x + chart.width).toFixed(2)}"
          y2="${y.toFixed(2)}"
          stroke="${tick === valueFloor ? palette.line : palette.lineSoft}"
          stroke-width="${tick === valueFloor ? "1.6" : "1"}"
        ></line>
        <text class="trend-breakout-axis-label" x="${chart.x - 18}" y="${(y + 4).toFixed(2)}" fill="${palette.quiet}" text-anchor="end">
          ${escapeHtml(tick)}
        </text>
      `;
    })
    .join("");

  const yearLabels = plotted
    .map(
      (point) => `
        <text class="trend-breakout-axis-label" x="${point.x.toFixed(2)}" y="${(chart.y + chart.height + 30).toFixed(2)}" fill="${palette.quiet}" text-anchor="middle">
          ${escapeHtml(point.year)}
        </text>
      `
    )
    .join("");

  const trendDots = plotted
    .map((point) => {
      const isLast = point.year === maxYear;
      const isCurrent = point.year === 2025;
      const radius = isLast ? 8.5 : 5.5;
      const fill = isLast ? palette.accentDeep : "#ffffff";
      const stroke = isLast ? palette.accentDeep : palette.accent;
      const textY = isLast ? point.y - 12 : point.y - 14;
      const textX = isLast ? point.x - 84 : point.x;
      const textAnchor = isLast ? "end" : "middle";
      const valueLabel = point.displayValue || `${point.value}`;
      return `
        <circle
          cx="${point.x.toFixed(2)}"
          cy="${point.y.toFixed(2)}"
          r="${radius}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${isLast ? "2" : "1.8"}"
        ></circle>
        <text
          class="${isLast ? "trend-breakout-value trend-breakout-value-strong" : "trend-breakout-value"}"
          x="${textX.toFixed(2)}"
          y="${textY.toFixed(2)}"
          fill="${isLast ? palette.accentDeep : palette.muted}"
          text-anchor="${textAnchor}"
        >${escapeHtml(valueLabel)}</text>
        ${
          isCurrent
            ? `<text class="trend-breakout-axis-label" x="${point.x.toFixed(2)}" y="${(point.y + 28).toFixed(2)}" fill="${palette.accentDeep}" text-anchor="middle">2025</text>`
            : ""
        }
      `;
    })
    .join("");

  const lastPoint = plotted[plotted.length - 1];
  const barMax = Math.max(...bars.map((bar) => bar.value));
  const barStartX = panel.x + 150;
  const barMaxWidth = 206;
  const breakoutBars = bars
    .map((bar, index) => {
      const y = panel.y + 112 + index * 54;
      const width = (bar.value / barMax) * barMaxWidth;
      const isFirst = index === 0;
      return `
        <text class="trend-breakout-bar-label" x="${panel.x + 28}" y="${y + 18}" fill="${palette.ink}">
          ${escapeHtml(bar.label)}
        </text>
        <rect
          x="${barStartX}"
          y="${y}"
          width="${barMaxWidth}"
          height="16"
          rx="8"
          fill="${palette.lineSoft}"
        ></rect>
        <rect
          x="${barStartX}"
          y="${y}"
          width="${width.toFixed(2)}"
          height="16"
          rx="8"
          fill="${isFirst ? palette.accentDeep : palette.accent}"
          opacity="${isFirst ? "1" : "0.82"}"
        ></rect>
        <text class="trend-breakout-bar-value" x="${(barStartX + barMaxWidth + 16).toFixed(2)}" y="${y + 14}" fill="${isFirst ? palette.accentDeep : palette.muted}">
          ${escapeHtml(bar.displayValue || `${bar.value}`)}
        </text>
      `;
    })
    .join("");

  const metricLines = wrapText(banner.metric, 9).slice(0, 2);
  const headlineLines = wrapText(banner.headline, 52).slice(0, 3);
  const detailLines = wrapText(banner.detail, 88).slice(0, 3);

  return `
    <section class="trend-breakout-layout">
      <svg
        class="trend-breakout-svg"
        viewBox="0 0 1600 900"
        role="img"
        aria-label="Physician wait times rising across benchmark survey years, 2025 specialty waits by specialty, and the primary care shortage designation banner."
      >
        <defs>
          <linearGradient id="trend-breakout-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fffdfa"></stop>
            <stop offset="100%" stop-color="#fbf8f2"></stop>
          </linearGradient>
          <radialGradient id="trend-breakout-glow" cx="92%" cy="10%" r="72%">
            <stop offset="0%" stop-color="rgba(47, 111, 134, 0.08)"></stop>
            <stop offset="100%" stop-color="rgba(47, 111, 134, 0)"></stop>
          </radialGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#trend-breakout-bg)"></rect>
        <rect width="1600" height="900" fill="url(#trend-breakout-glow)"></rect>

        <text class="trend-breakout-overline" x="${chart.x}" y="74" fill="${palette.quiet}">
          ${escapeHtml(trend.eyebrow)}
        </text>
        <text class="trend-breakout-title" x="${chart.x}" y="108" fill="${palette.ink}">
          ${escapeHtml(trend.label)}
        </text>
        <text class="trend-breakout-unit" x="${(chart.x + chart.width).toFixed(2)}" y="108" fill="${palette.quiet}" text-anchor="end">
          ${escapeHtml(trend.unitLabel)}
        </text>

        ${yGrid}
        <path
          d="${trendPath}"
          fill="none"
          stroke="${palette.accent}"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
        ${trendDots}
        <line
          x1="${(lastPoint.x - 72).toFixed(2)}"
          y1="${(lastPoint.y - 18).toFixed(2)}"
          x2="${(lastPoint.x - 10).toFixed(2)}"
          y2="${(lastPoint.y - 4).toFixed(2)}"
          stroke="${palette.accentDeep}"
          stroke-width="1.6"
          stroke-linecap="round"
        ></line>
        ${yearLabels}

        <rect
          x="${(lastPoint.x - 250).toFixed(2)}"
          y="${(lastPoint.y - 124).toFixed(2)}"
          width="170"
          height="56"
          rx="18"
          fill="${palette.accentSoft}"
          stroke="${palette.accent}"
          stroke-width="1.2"
        ></rect>
        <text class="trend-breakout-annotation-strong" x="${(lastPoint.x - 165).toFixed(2)}" y="${(lastPoint.y - 92).toFixed(2)}" fill="${palette.accentDeep}" text-anchor="middle">
          ${escapeHtml(trend.annotation?.headline ?? "")}
        </text>
        <text class="trend-breakout-annotation" x="${(lastPoint.x - 165).toFixed(2)}" y="${(lastPoint.y - 72).toFixed(2)}" fill="${palette.accentDeep}" text-anchor="middle">
          ${escapeHtml(trend.annotation?.detail ?? "")}
        </text>

        <rect
          x="${panel.x}"
          y="${panel.y}"
          width="${panel.width}"
          height="${panel.height}"
          rx="${panel.radius}"
          fill="${palette.panel}"
          stroke="${palette.line}"
          stroke-width="1.4"
        ></rect>
        <text class="trend-breakout-overline" x="${panel.x + 28}" y="${panel.y + 42}" fill="${palette.quiet}">
          ${escapeHtml(breakout.eyebrow || "2025 specialty breakout")}
        </text>
        <text class="trend-breakout-title trend-breakout-title-small" x="${panel.x + 28}" y="${panel.y + 76}" fill="${palette.ink}">
          ${escapeHtml(breakout.label)}
        </text>
        <text class="trend-breakout-unit" x="${(panel.x + panel.width - 28).toFixed(2)}" y="${panel.y + 76}" fill="${palette.quiet}" text-anchor="end">
          ${escapeHtml(breakout.unitLabel)}
        </text>
        ${breakoutBars}

        <rect
          x="${bannerBox.x}"
          y="${bannerBox.y}"
          width="${bannerBox.width}"
          height="${bannerBox.height}"
          rx="${bannerBox.radius}"
          fill="${palette.bannerBg}"
          stroke="${palette.bannerLine}"
          stroke-width="1.4"
        ></rect>
        <line
          x1="${bannerBox.x + 34}"
          y1="${bannerBox.y + 18}"
          x2="${bannerBox.x + bannerBox.width - 34}"
          y2="${bannerBox.y + 18}"
          stroke="${palette.accentDeep}"
          stroke-width="3"
          stroke-linecap="round"
          opacity="0.9"
        ></line>
        <text class="trend-breakout-overline" x="${bannerBox.x + 34}" y="${bannerBox.y + 42}" fill="${palette.warm}">
          ${escapeHtml(banner.eyebrow)}
        </text>
        ${metricLines
          .map(
            (line, index) => `
              <text class="trend-breakout-banner-number" x="${bannerBox.x + 34}" y="${bannerBox.y + 92 + index * 38}" fill="${palette.ink}">
                ${escapeHtml(line)}
              </text>
            `
          )
          .join("")}
        ${headlineLines
          .map(
            (line, index) => `
              <text class="trend-breakout-banner-headline" x="${bannerBox.x + 274}" y="${bannerBox.y + 102 + index * 34}" fill="${palette.ink}">
                ${escapeHtml(line)}
              </text>
            `
          )
          .join("")}
        ${detailLines
          .map(
            (line, index) => `
              <text class="trend-breakout-banner-detail" x="${bannerBox.x + 34}" y="${bannerBox.y + 172 + index * 26}" fill="${palette.muted}">
                ${escapeHtml(line)}
              </text>
            `
          )
          .join("")}
      </svg>
    </section>
  `;
};

const renderSegmentedFocusBar = (body) => {
  const segments = body.segments
    .map((segment) => {
      const width = normalizeWidth(segment.width);
      const roleClass =
        segment.role === "focus"
          ? "segment-focus"
          : segment.role === "neutral"
            ? "segment-neutral"
            : "segment-quiet";
      return `
        <div class="segment ${roleClass}" style="width:${width}%">
          <span>${escapeHtml(segment.label)}</span>
        </div>
      `;
    })
    .join("");

  const bullets = body.callout.bullets
    .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
    .join("");

  return `
    <section class="focus-bar-layout">
      <div class="bar-shell">
        <div class="bar-label">${escapeHtml(body.barLabel)}</div>
        <div class="focus-bar">${segments}</div>
      </div>
      <aside class="focus-callout">
        ${
          body.callout.title
            ? `<div class="callout-title">${escapeHtml(body.callout.title)}</div>`
            : ""
        }
        <ul>${bullets}</ul>
      </aside>
      <div class="focus-callout-link" aria-hidden="true"></div>
    </section>
  `;
};

const renderCompoundRibbonDayView = (body) => {
  const palette = {
    text: "#1f2937",
    muted: "#5d6b78",
    quiet: "#8593a1",
    outline: "#d7dde3",
    outlineSoft: "#e9eef2",
    neutralDark: "#aab2bb",
    neutralMid: "#cfd6dc",
    neutralSoft: "#e8ebef",
    accent: "#4f7c78",
    accentStrong: "#3f6f69",
    accentSoft: "#dfe9e7",
  };

  const heroSegments = (body.hero?.segments ?? []).map((segment) => ({
    ...segment,
    share: normalizeWidth(segment.width),
  }));
  const totalShare =
    heroSegments.reduce((sum, segment) => sum + segment.share, 0) || 100;
  const segments = heroSegments.map((segment) => ({
    ...segment,
    share: (segment.share / totalShare) * 100,
  }));
  const focusIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.role === "focus")
  );
  const focusStartShare = segments
    .slice(0, focusIndex)
    .reduce((sum, segment) => sum + segment.share, 0);
  const focusShare = segments[focusIndex]?.share ?? 0;

  const rulerTicks = (body.hero?.rulerTicks ?? []).length > 1
    ? body.hero.rulerTicks
    : [0, 5, 10, 15, 20];
  const minTick = Math.min(...rulerTicks);
  const maxTick = Math.max(...rulerTicks);
  const tickRange = Math.max(1, maxTick - minTick);

  const hero = {
    x: 272,
    y: 286,
    width: 1056,
    height: 72,
    radius: 22,
  };
  const labelBandY = 250;
  const rulerY = 216;
  const bracketTopY = 190;
  const calloutX = 244;
  const calloutY = 98;
  const transitionY = 468;
  const dayRowY = 556;
  const captionY = 734;

  const segmentRects = [];
  const segmentLabels = [];
  let currentX = hero.x;

  for (const segment of segments) {
    const width = (hero.width * segment.share) / 100;
    const centerX = currentX + width / 2;
    const fill =
      segment.role === "focus"
        ? palette.accent
        : segment.role === "neutral"
          ? palette.neutralDark
          : palette.neutralSoft;
    const labelColor =
      segment.role === "focus" ? palette.accentStrong : palette.muted;

    segmentRects.push(`
      <rect
        x="${currentX.toFixed(2)}"
        y="${hero.y}"
        width="${width.toFixed(2)}"
        height="${hero.height}"
        fill="${fill}"
        clip-path="url(#compound-ribbon-hero-clip)"
      ></rect>
    `);

    segmentLabels.push(`
      <text
        class="compound-ribbon-segment-label"
        x="${centerX.toFixed(2)}"
        y="${labelBandY}"
        fill="${labelColor}"
      >${escapeHtml(segment.label)}</text>
    `);

    currentX += width;
  }

  const focusStartX = hero.x + (hero.width * focusStartShare) / 100;
  const focusEndX = focusStartX + (hero.width * focusShare) / 100;
  const focusCenterX = focusStartX + (focusEndX - focusStartX) / 2;

  const rulerMarks = rulerTicks
    .map((tick) => {
      const x = hero.x + (((tick - minTick) / tickRange) * hero.width);
      return `
        <line
          x1="${x.toFixed(2)}"
          y1="${rulerY + 14}"
          x2="${x.toFixed(2)}"
          y2="${rulerY + 28}"
          stroke="${palette.outline}"
          stroke-width="1.5"
        ></line>
        <text
          class="compound-ribbon-ruler-tick"
          x="${x.toFixed(2)}"
          y="${rulerY}"
          fill="${palette.quiet}"
        >${escapeHtml(tick)}</text>
      `;
    })
    .join("");

  const calloutLines = (body.hero?.callout?.lines ?? [])
    .map((line, index) => {
      const className =
        index === 0
          ? "compound-ribbon-callout-line is-strong"
          : "compound-ribbon-callout-line";
      const compactWidth =
        line.length > 40 ? ' textLength="566" lengthAdjust="spacingAndGlyphs"' : "";
      return `
        <text
          class="${className}"
          x="${calloutX}"
          y="${calloutY + index * 30}"
          fill="${index === 0 ? palette.text : palette.muted}"
          ${compactWidth}
        >${escapeHtml(line)}</text>
      `;
    })
    .join("");

  const guideWidth = Number(body.dayView?.guideWidth) > 0 ? body.dayView.guideWidth : 165;
  const guideHeight = Number(body.dayView?.height) > 0 ? body.dayView.height : 24;
  const visitGap = Number(body.dayView?.gap) > 0 ? body.dayView.gap : 18;
  const newVisitGap =
    Number(body.dayView?.newVisitGap) > 0 ? body.dayView.newVisitGap : 44;
  const newVisitWidth =
    Number(body.dayView?.newVisitWidth) > 0 ? body.dayView.newVisitWidth : 150;
  const visitCount =
    Number.isInteger(body.dayView?.count) && body.dayView.count > 0
      ? body.dayView.count
      : 5;
  const reducedStoryShare = normalizeWidth(body.dayView?.reducedStoryWidthPct) / 100;

  const dayGuideRadius = 10;
  const reducedSegments = segments.map((segment, index) =>
    index === focusIndex
      ? {
          ...segment,
          width: guideWidth * reducedStoryShare,
          fill: "#c8d0d7",
        }
      : {
          ...segment,
          width: guideWidth * (segment.share / 100),
          fill:
            segment.role === "neutral"
              ? "#d6dde2"
              : segment.role === "focus"
                ? "#c8d0d7"
                : "#e8ebef",
        }
  );
  const reducedTotalWidth = reducedSegments.reduce(
    (sum, segment) => sum + segment.width,
    0
  );
  const dayRowWidth =
    guideWidth * visitCount +
    visitGap * Math.max(visitCount - 1, 0) +
    newVisitGap +
    newVisitWidth;
  const dayStartX = (1600 - dayRowWidth) / 2;

  const dayVisitDefs = [];
  const dayVisitGuides = [];
  const dayVisitRects = [];

  for (let visitIndex = 0; visitIndex < visitCount; visitIndex += 1) {
    const visitX = dayStartX + visitIndex * (guideWidth + visitGap);
    const clipId = `compound-ribbon-day-clip-${visitIndex}`;
    dayVisitDefs.push(`
      <clipPath id="${clipId}">
        <rect
          x="${visitX.toFixed(2)}"
          y="${dayRowY}"
          width="${reducedTotalWidth.toFixed(2)}"
          height="${guideHeight}"
          rx="${dayGuideRadius}"
          ry="${dayGuideRadius}"
        ></rect>
      </clipPath>
    `);
    dayVisitGuides.push(`
      <rect
        x="${visitX.toFixed(2)}"
        y="${dayRowY}"
        width="${guideWidth}"
        height="${guideHeight}"
        rx="${dayGuideRadius}"
        ry="${dayGuideRadius}"
        fill="none"
        stroke="${palette.outline}"
        stroke-width="1.5"
      ></rect>
    `);

    let visitSegmentX = visitX;
    for (const segment of reducedSegments) {
      dayVisitRects.push(`
        <rect
          x="${visitSegmentX.toFixed(2)}"
          y="${dayRowY}"
          width="${segment.width.toFixed(2)}"
          height="${guideHeight}"
          fill="${segment.fill}"
          clip-path="url(#${clipId})"
        ></rect>
      `);
      visitSegmentX += segment.width;
    }
  }

  const newVisitX =
    dayStartX +
    visitCount * guideWidth +
    Math.max(visitCount - 1, 0) * visitGap +
    newVisitGap;

  return `
    <section class="compound-ribbon-layout">
      <svg
        class="compound-ribbon-svg"
        viewBox="0 0 1600 900"
        role="img"
        aria-label="One highlighted visit segment gets shorter across repeated visits and creates room for one new visit."
      >
        <defs>
          <clipPath id="compound-ribbon-hero-clip">
            <rect
              x="${hero.x}"
              y="${hero.y}"
              width="${hero.width}"
              height="${hero.height}"
              rx="${hero.radius}"
              ry="${hero.radius}"
            ></rect>
          </clipPath>
          <filter id="compound-ribbon-shadow" x="-20%" y="-40%" width="140%" height="200%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="14"
              flood-color="#101828"
              flood-opacity="0.10"
            ></feDropShadow>
          </filter>
          ${dayVisitDefs.join("")}
        </defs>

        <rect x="0" y="0" width="1600" height="900" fill="#ffffff"></rect>

        <text class="compound-ribbon-overline" x="${hero.x - 20}" y="182" fill="${palette.quiet}">
          ${escapeHtml(body.hero?.label ?? "")}
        </text>

        <line
          x1="${hero.x}"
          y1="${rulerY + 22}"
          x2="${(hero.x + hero.width).toFixed(2)}"
          y2="${rulerY + 22}"
          stroke="${palette.outlineSoft}"
          stroke-width="2"
        ></line>
        ${rulerMarks}
        ${segmentLabels.join("")}

        <g filter="url(#compound-ribbon-shadow)">
          <rect
            x="${hero.x}"
            y="${hero.y}"
            width="${hero.width}"
            height="${hero.height}"
            rx="${hero.radius}"
            ry="${hero.radius}"
            fill="#f6f8fa"
          ></rect>
          ${segmentRects.join("")}
        </g>

        <path
          d="M ${focusStartX.toFixed(2)} ${hero.y} V ${bracketTopY} H ${focusEndX.toFixed(2)} V ${hero.y}"
          fill="none"
          stroke="${palette.accentStrong}"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>

        ${calloutLines}

        <g transform="translate(0 ${transitionY})">
          <line
            x1="512"
            y1="0"
            x2="690"
            y2="0"
            stroke="${palette.outline}"
            stroke-width="1.5"
          ></line>
          <line
            x1="910"
            y1="0"
            x2="1088"
            y2="0"
            stroke="${palette.outline}"
            stroke-width="1.5"
          ></line>
          <text class="compound-ribbon-transition" x="800" y="6" fill="${palette.muted}">
            ${escapeHtml(body.transitionLabel)}
          </text>
        </g>

        <text class="compound-ribbon-overline" x="${dayStartX.toFixed(2)}" y="518" fill="${palette.quiet}">
          ${escapeHtml(body.dayView?.label ?? "")}
        </text>

        ${dayVisitGuides.join("")}
        ${dayVisitRects.join("")}

        <rect
          x="${newVisitX.toFixed(2)}"
          y="${(dayRowY - 3).toFixed(2)}"
          width="${newVisitWidth}"
          height="${guideHeight + 8}"
          rx="11"
          ry="11"
          fill="${palette.accent}"
          filter="url(#compound-ribbon-shadow)"
        ></rect>
        <text
          class="compound-ribbon-new-visit-label"
          x="${(newVisitX + newVisitWidth / 2).toFixed(2)}"
          y="${dayRowY + 66}"
          fill="${palette.accentStrong}"
        >${escapeHtml(body.dayView?.newVisitLabel ?? "")}</text>

        <text class="compound-ribbon-caption" x="${dayStartX.toFixed(2)}" y="${captionY}" fill="${palette.muted}">
          ${escapeHtml(body.dayView?.caption ?? "")}
        </text>
      </svg>
    </section>
  `;
};

const renderCompoundRibbonBeforeAfter = (body) => {
  const palette = {
    blue: "#4A89C8",
    blueSoft: "#8FB4D8",
    medGray: "#97A0AA",
    lightGray: "#D9DEE3",
    green: "#4F7C78",
    text: "#1F2937",
    textSoft: "#374151",
    muted: "#6B7280",
    rulerMajor: "#9CA3AF",
    rulerMinor: "#D1D5DB",
    line: "#D1D5DB",
    bracket: "#9CA3AF",
  };

  const normalizeSegments = (segments) => {
    const total =
      segments.reduce((sum, segment) => sum + normalizeWidth(segment.width), 0) || 100;
    return segments.map((segment) => ({
      ...segment,
      share: (normalizeWidth(segment.width) / total) * 100,
      fill:
        segment.role === "focus"
          ? palette.blue
          : segment.role === "neutral"
            ? palette.medGray
            : palette.lightGray,
      labelFill: segment.role === "quiet" ? palette.text : "#ffffff",
    }));
  };

  const heroSegments = normalizeSegments(body.hero?.segments ?? []);
  const mechanismInputSegments = (body.mechanism?.segments ?? []).map((segment) => ({
    ...segment,
    rawWidth: normalizeWidth(segment.width),
  }));
  const beforeSegments = normalizeSegments(body.beforeRow?.segments ?? []).map((segment) => ({
    ...segment,
    fill: segment.role === "focus" ? palette.blueSoft : segment.fill,
  }));
  const afterSegments = normalizeSegments(body.afterRow?.segments ?? []).map((segment) => ({
    ...segment,
    fill: segment.role === "focus" ? palette.blueSoft : segment.fill,
  }));

  const hero = { x: 100, y: 44, width: 1000, height: 64, radius: 6 };
  const mechanism = {
    x: 100,
    y: 340,
    width: 430,
    topHeight: 22,
    bottomHeight: 30,
    barGap: 42,
    savedGap: 12,
    radius: 5,
  };
  const beforeRow = { x: 720, y: 350, width: 62, height: 38, gap: 14, radius: 5 };
  const afterRow = { x: 720, y: 430, width: 50, height: 38, gap: 14, radius: 5 };
  const newVisit = { width: 92, height: 38, radius: 5 };
  const makeClipRect = ({ x, y, width, height, radius }) => `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"></rect>
  `;

  const renderSegmentRects = ({
    segments,
    x,
    y,
    width,
    height,
    clipId,
    labelY = null,
    labelFontSize = 17,
    labelFontWeight = 500,
  }) => {
    let currentX = x;
    const rects = [];
    const labels = [];

    for (const segment of segments) {
      const segmentWidth = (width * segment.share) / 100;
      rects.push(`
        <rect
          x="${currentX.toFixed(2)}"
          y="${y}"
          width="${segmentWidth.toFixed(2)}"
          height="${height}"
          fill="${segment.fill}"
          clip-path="url(#${clipId})"
        ></rect>
      `);

      if (labelY !== null && segment.label) {
        labels.push(`
          <text
            x="${(currentX + segmentWidth / 2).toFixed(2)}"
            y="${labelY}"
            font-size="${labelFontSize}"
            font-weight="${labelFontWeight}"
            text-anchor="middle"
            fill="${segment.labelFill}"
          >${escapeHtml(segment.label)}</text>
        `);
      }

      currentX += segmentWidth;
    }

    return {
      rects: rects.join(""),
      labels: labels.join(""),
    };
  };

  const heroFocusIndex = Math.max(
    0,
    heroSegments.findIndex((segment) => segment.role === "focus")
  );
  const heroFocusStartShare = heroSegments
    .slice(0, heroFocusIndex)
    .reduce((sum, segment) => sum + segment.share, 0);
  const heroFocusShare = heroSegments[heroFocusIndex]?.share ?? 0;
  const heroFocusStartX = hero.x + (hero.width * heroFocusStartShare) / 100;
  const heroFocusWidth = (hero.width * heroFocusShare) / 100;
  const bracketInset = heroFocusWidth * 0.075;
  const bracketLeftX = heroFocusStartX + bracketInset;
  const bracketRightX = heroFocusStartX + heroFocusWidth - bracketInset;
  const bracketMidX = heroFocusStartX + heroFocusWidth / 2;

  const heroRender = renderSegmentRects({
    segments: heroSegments,
    x: hero.x,
    y: hero.y,
    width: hero.width,
    height: hero.height,
    clipId: "compound-ribbon-before-after-hero-clip",
    labelY: 86,
  });

  const mechanismSegments =
    mechanismInputSegments.length > 0
      ? normalizeSegments(mechanismInputSegments)
      : normalizeSegments([
          {
            label: body.hero?.segments?.[0]?.label ?? "Story reconstruction",
            width: 20,
            role: "focus",
          },
          {
            label: body.hero?.segments?.[1]?.label ?? "Physical exam",
            width: 20,
            role: "quiet",
          },
          {
            label: body.hero?.segments?.[2]?.label ?? "Decisions + counseling",
            width: 30,
            role: "neutral",
          },
        ]);
  const mechanismInputTotal =
    (mechanismInputSegments.length > 0
      ? mechanismInputSegments
      : [
          { rawWidth: 20, role: "focus" },
          { rawWidth: 20, role: "quiet" },
          { rawWidth: 30, role: "neutral" },
        ]
    ).reduce((sum, segment) => sum + segment.rawWidth, 0) || 70;
  const mechanismActualWidth = (mechanism.width * mechanismInputTotal) / 100;
  const mechanismSavedWidth = mechanism.width - mechanismActualWidth;
  const mechanismTopBar = {
    x: mechanism.x,
    y: mechanism.y,
    width: mechanism.width,
    height: mechanism.topHeight,
    radius: mechanism.radius,
  };
  const mechanismBottomBar = {
    x: mechanism.x,
    y: mechanism.y + mechanism.barGap,
    width: mechanismActualWidth,
    height: mechanism.bottomHeight,
    radius: mechanism.radius,
  };
  const mechanismSavedBox = {
    x: mechanismBottomBar.x + mechanismBottomBar.width + mechanism.savedGap,
    y: mechanismBottomBar.y,
    width: mechanismSavedWidth,
    height: mechanismBottomBar.height,
    radius: mechanism.radius,
  };
  const mechanismFocusIndex = Math.max(
    0,
    mechanismInputSegments.findIndex((segment) => segment.role === "focus")
  );
  const mechanismFocusStartShare = (
    mechanismInputSegments.length > 0
      ? mechanismInputSegments
      : [{ rawWidth: 20, role: "focus" }, { rawWidth: 20 }, { rawWidth: 30 }]
  )
    .slice(0, mechanismFocusIndex)
    .reduce((sum, segment) => sum + segment.rawWidth, 0);
  const mechanismFocusShare =
    (mechanismInputSegments[mechanismFocusIndex]?.rawWidth ?? 20);
  const mechanismTopFocusStartX = mechanismTopBar.x + (mechanismTopBar.width * heroFocusStartShare) / 100;
  const mechanismTopFocusEndX = mechanismTopFocusStartX + (mechanismTopBar.width * heroFocusShare) / 100;
  const mechanismBottomFocusStartX =
    mechanismBottomBar.x + (mechanismTopBar.width * mechanismFocusStartShare) / 100;
  const mechanismBottomFocusEndX =
    mechanismBottomFocusStartX + (mechanismTopBar.width * mechanismFocusShare) / 100;
  const mechanismBottomFocusWidth = mechanismBottomFocusEndX - mechanismBottomFocusStartX;
  const mechanismArrowInset = Math.min(16, mechanismBottomFocusWidth * 0.2);
  const mechanismArrowLeftHeadX =
    mechanismBottomFocusStartX + mechanismBottomFocusWidth / 2 - 6;
  const mechanismArrowRightHeadX =
    mechanismBottomFocusEndX - mechanismBottomFocusWidth / 2 + 6;
  const mechanismLabelLines = wrapText(
    body.mechanism?.label ?? "",
    42
  ).slice(0, 2);
  const mechanismLabelText = mechanismLabelLines
    .map(
      (line, index) => `
        <tspan x="${(mechanism.x + mechanism.width / 2).toFixed(2)}" dy="${index === 0 ? 0 : 18}">
          ${escapeHtml(line)}
        </tspan>
      `
    )
    .join("");
  const mechanismTopRender = renderSegmentRects({
    segments: heroSegments,
    x: mechanismTopBar.x,
    y: mechanismTopBar.y,
    width: mechanismTopBar.width,
    height: mechanismTopBar.height,
    clipId: "compound-ribbon-before-after-mechanism-top-clip",
    labelY: mechanismTopBar.y + 14,
    labelFontSize: 10.5,
    labelFontWeight: 600,
  });
  const mechanismBottomRender = renderSegmentRects({
    segments: mechanismSegments,
    x: mechanismBottomBar.x,
    y: mechanismBottomBar.y,
    width: mechanismBottomBar.width,
    height: mechanismBottomBar.height,
    clipId: "compound-ribbon-before-after-mechanism-bottom-clip",
    labelY: null,
    labelFontSize: 10.5,
    labelFontWeight: 600,
  });

  const renderVisitRow = ({ row, segments, count, prefix }) => {
    const defs = [];
    const rects = [];

    for (let index = 0; index < count; index += 1) {
      const x = row.x + index * (row.width + row.gap);
      const clipId = `${prefix}-${index}`;
      defs.push(`<clipPath id="${clipId}">${makeClipRect({ x, y: row.y, width: row.width, height: row.height, radius: row.radius })}</clipPath>`);
      const rendered = renderSegmentRects({
        segments,
        x,
        y: row.y,
        width: row.width,
        height: row.height,
        clipId,
      });
      rects.push(rendered.rects);
    }

    return {
      defs: defs.join(""),
      rects: rects.join(""),
    };
  };

  const beforeCount =
    Number.isInteger(body.beforeRow?.count) && body.beforeRow.count > 0
      ? body.beforeRow.count
      : 5;
  const afterCount =
    Number.isInteger(body.afterRow?.count) && body.afterRow.count > 0
      ? body.afterRow.count
      : 5;
  const beforeRowLabelX = 676;
  const afterRowLabelX = 676;
  const beforeRowRender = renderVisitRow({
    row: beforeRow,
    segments: beforeSegments,
    count: beforeCount,
    prefix: "compound-ribbon-before-row-clip",
  });
  const afterRowRender = renderVisitRow({
    row: afterRow,
    segments: afterSegments,
    count: afterCount,
    prefix: "compound-ribbon-after-row-clip",
  });

  const newVisitX = afterRow.x + afterCount * (afterRow.width + afterRow.gap);

  const calloutLines = (body.hero?.callout?.lines ?? [])
    .map((line, index) => {
      const fontWeight = index === 0 ? 700 : 400;
      const fontSize = index === 0 ? 16 : 15;
      const y = 200 + index * 22;
      const fill = index === 0 ? palette.text : palette.textSoft;
      return `
        <text
          x="${bracketMidX.toFixed(2)}"
          y="${y}"
          fill="${fill}"
          font-size="${fontSize}"
          font-weight="${fontWeight}"
          text-anchor="middle"
        >${escapeHtml(line)}</text>
      `;
    })
    .join("");

  return `
    <section class="compound-ribbon-layout">
      <svg
        class="compound-ribbon-svg"
        viewBox="0 0 1200 600"
        role="img"
        aria-label="A visit segment is highlighted, then shorter repeated visits create room for a new visit."
      >
        <defs>
          <filter id="compound-ribbon-before-after-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.05"></feDropShadow>
          </filter>
          <clipPath id="compound-ribbon-before-after-hero-clip">
            ${makeClipRect(hero)}
          </clipPath>
          <clipPath id="compound-ribbon-before-after-mechanism-top-clip">
            ${makeClipRect(mechanismTopBar)}
          </clipPath>
          <clipPath id="compound-ribbon-before-after-mechanism-bottom-clip">
            ${makeClipRect(mechanismBottomBar)}
          </clipPath>
          ${beforeRowRender.defs}
          ${afterRowRender.defs}
        </defs>

        <g filter="url(#compound-ribbon-before-after-shadow)">
          ${heroRender.rects}
        </g>
        ${heroRender.labels}

        <g fill="none" stroke="${palette.bracket}" stroke-width="1.5">
          <path d="M ${bracketLeftX.toFixed(2)} 145 L ${bracketLeftX.toFixed(2)} 155 L ${bracketRightX.toFixed(2)} 155 L ${bracketRightX.toFixed(2)} 145"></path>
          <path d="M ${bracketMidX.toFixed(2)} 155 L ${bracketMidX.toFixed(2)} 175"></path>
        </g>

        ${calloutLines}

        ${
          mechanismLabelText
            ? `<text
                x="${(mechanism.x + mechanism.width / 2).toFixed(2)}"
                y="294"
                fill="${palette.text}"
                font-size="16"
                font-weight="600"
                text-anchor="middle"
              >${mechanismLabelText}</text>`
            : ""
        }

        ${mechanismTopRender.rects}
        ${mechanismTopRender.labels}

        <g fill="none" stroke="${palette.line}" stroke-width="1.35" stroke-linecap="round" stroke-dasharray="1.5 5">
          <path d="M ${mechanismTopFocusStartX.toFixed(2)} ${(mechanismTopBar.y + mechanismTopBar.height + 8).toFixed(2)} V ${(mechanismBottomBar.y - 10).toFixed(2)}"></path>
          <path d="M ${mechanismTopFocusEndX.toFixed(2)} ${(mechanismTopBar.y + mechanismTopBar.height + 8).toFixed(2)} L ${mechanismBottomFocusEndX.toFixed(2)} ${(mechanismBottomBar.y - 10).toFixed(2)}"></path>
        </g>

        ${mechanismBottomRender.rects}
        ${mechanismBottomRender.labels}

        <g fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M ${(mechanismBottomFocusStartX + mechanismArrowInset).toFixed(2)} ${(mechanismBottomBar.y + mechanismBottomBar.height / 2).toFixed(2)} H ${mechanismArrowLeftHeadX.toFixed(2)}"></path>
          <path d="M ${mechanismArrowLeftHeadX.toFixed(2)} ${(mechanismBottomBar.y + mechanismBottomBar.height / 2).toFixed(2)} l -4 -4"></path>
          <path d="M ${mechanismArrowLeftHeadX.toFixed(2)} ${(mechanismBottomBar.y + mechanismBottomBar.height / 2).toFixed(2)} l -4 4"></path>
          <path d="M ${(mechanismBottomFocusEndX - mechanismArrowInset).toFixed(2)} ${(mechanismBottomBar.y + mechanismBottomBar.height / 2).toFixed(2)} H ${mechanismArrowRightHeadX.toFixed(2)}"></path>
          <path d="M ${mechanismArrowRightHeadX.toFixed(2)} ${(mechanismBottomBar.y + mechanismBottomBar.height / 2).toFixed(2)} l 4 -4"></path>
          <path d="M ${mechanismArrowRightHeadX.toFixed(2)} ${(mechanismBottomBar.y + mechanismBottomBar.height / 2).toFixed(2)} l 4 4"></path>
        </g>

        <rect
          x="${mechanismSavedBox.x.toFixed(2)}"
          y="${mechanismSavedBox.y}"
          width="${mechanismSavedBox.width.toFixed(2)}"
          height="${mechanismSavedBox.height}"
          rx="${mechanismSavedBox.radius}"
          fill="none"
          stroke="${palette.line}"
          stroke-width="1.5"
          stroke-dasharray="4 4"
        ></rect>
        <text
          x="${(mechanismSavedBox.x + mechanismSavedBox.width / 2).toFixed(2)}"
          y="${(mechanismSavedBox.y + mechanismSavedBox.height / 2 + 4).toFixed(2)}"
          fill="${palette.muted}"
          font-size="11.5"
          font-weight="600"
          text-anchor="middle"
        >${escapeHtml(body.mechanism?.savedLabel ?? "Time saved")}</text>

        ${
          body.transitionLabel
            ? `<text
                x="906"
                y="324"
                fill="${palette.muted}"
                font-size="12.5"
                font-weight="500"
                text-anchor="middle"
              >${escapeHtml(body.transitionLabel)}</text>`
            : ""
        }

        <g opacity="0.92">
          ${beforeRowRender.rects}
        </g>
        <text
          x="${beforeRowLabelX}"
          y="${(beforeRow.y + 5).toFixed(2)}"
          fill="${palette.text}"
          font-size="19"
          font-weight="700"
          text-anchor="middle"
        >${beforeCount}</text>
        <text
          x="${beforeRowLabelX}"
          y="${(beforeRow.y + 22).toFixed(2)}"
          fill="${palette.muted}"
          font-size="12.5"
          font-weight="600"
          text-anchor="middle"
        >visits</text>

        <g fill="none" stroke="${palette.muted}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.72">
          <path d="M 720 401 V 414"></path>
          <path d="M 715 409 L 720 414 L 725 409"></path>
        </g>

        <g opacity="0.92">
          ${afterRowRender.rects}
        </g>
        <text
          x="${afterRowLabelX}"
          y="${(afterRow.y + 5).toFixed(2)}"
          fill="${palette.text}"
          font-size="19"
          font-weight="700"
          text-anchor="middle"
        >${afterCount + 1}</text>
        <text
          x="${afterRowLabelX}"
          y="${(afterRow.y + 22).toFixed(2)}"
          fill="${palette.muted}"
          font-size="12.5"
          font-weight="600"
          text-anchor="middle"
        >visits</text>

        <g>
          <rect
            x="${newVisitX}"
            y="${afterRow.y}"
            width="${newVisit.width}"
            height="${newVisit.height}"
            rx="${newVisit.radius}"
            fill="${palette.green}"
          ></rect>
        </g>
        <text
          x="${(newVisitX + newVisit.width / 2).toFixed(2)}"
          y="${(afterRow.y + afterRow.height / 2 + 5).toFixed(2)}"
          fill="#ffffff"
          font-size="15"
          font-weight="600"
          text-anchor="middle"
        >${escapeHtml(body.afterRow?.newVisitLabel ?? "")}</text>
      </svg>
    </section>
  `;
};

const renderStoryToStructureTriptych = (body) => {
  const palette = {
    text: "#1f2937",
    muted: "#677483",
    quiet: "#8a949d",
    neutralFill: "#f5f7f8",
    neutralLine: "#dde3e8",
    accent: "#4f7c78",
    accentTint: "#e8f2f0",
    accentLine: "#6f9792",
  };

  const storyLines = wrapText(body.left?.storyText, 30);
  const left = { x: 176, y: 292, w: 354, h: 220, r: 28 };
  const middle = { x: 590, y: 278, w: 404, h: 246, r: 30 };
  const right = { x: 1054, y: 282, w: 318, h: 240, r: 18 };
  const middleInnerPad = 28;
  const rowHeight = (middle.h - middleInnerPad * 2) / 3;

  const storyText = storyLines
    .map(
      (line, index) => `
        <tspan x="${left.x + 28}" dy="${index === 0 ? 0 : 27}">${escapeHtml(line)}</tspan>
      `
    )
    .join("");

  const middleRows = (body.middle?.rows ?? [])
    .map((row, index) => {
      const rowTop = middle.y + middleInnerPad + index * rowHeight;
      const excerptLines = wrapText(row.sourceExcerpt, 25).slice(0, 3);
      const excerptText = excerptLines
        .map(
          (line, lineIndex) => `
            <tspan x="${middle.x + 26}" dy="${lineIndex === 0 ? 0 : 20}">${escapeHtml(line)}</tspan>
          `
        )
        .join("");
      const outputs = (row.outputs ?? [])
        .map(
          (item, itemIndex) => `
            <text
              class="story-structure-output"
              x="${middle.x + 222}"
              y="${rowTop + 19 + itemIndex * 24}"
              fill="${palette.text}"
            >${escapeHtml(item)}</text>
          `
        )
        .join("");

      return `
        <g>
          ${
            index < 2
              ? `<line x1="${middle.x + 24}" y1="${(rowTop + rowHeight - 7).toFixed(2)}" x2="${middle.x + middle.w - 24}" y2="${(rowTop + rowHeight - 7).toFixed(2)}" stroke="${palette.neutralLine}" stroke-width="1"/>`
              : ""
          }
          <text
            class="story-structure-excerpt"
            x="${middle.x + 26}"
            y="${rowTop + 20}"
            fill="${palette.muted}"
          >${excerptText}</text>
          ${outputs}
        </g>
      `;
    })
    .join("");

  const rightSections = (body.right?.sections ?? [])
    .map((section, index) => {
      const sectionTop = right.y + 42 + index * 62;
      const items = (section.items ?? [])
        .map(
          (item, itemIndex) => `
            <text
              class="story-structure-right-item"
              x="${right.x + 24}"
              y="${sectionTop + 24 + itemIndex * 22}"
              fill="${palette.text}"
            >${escapeHtml(item)}</text>
          `
        )
        .join("");

      return `
        <g>
          ${
            index > 0
              ? `<line x1="${right.x + 20}" y1="${sectionTop - 16}" x2="${right.x + right.w - 20}" y2="${sectionTop - 16}" stroke="${palette.neutralLine}" stroke-width="1"/>`
              : ""
          }
          <text
            class="story-structure-section-title"
            x="${right.x + 24}"
            y="${sectionTop}"
            fill="${palette.muted}"
          >${escapeHtml(section.title)}</text>
          ${items}
        </g>
      `;
    })
    .join("");

  return `
    <section class="story-structure-layout">
      <svg
        class="story-structure-svg"
        viewBox="0 0 1600 900"
        role="img"
        aria-label="Patient story on the left, story-to-structure translation chamber in the middle, and a decision-ready structure card on the right."
      >
        <rect width="1600" height="900" fill="#ffffff"></rect>

        <text class="story-structure-label" x="${left.x}" y="${left.y - 28}" fill="${palette.quiet}">
          ${escapeHtml(body.left?.label ?? "")}
        </text>
        <rect
          x="${left.x}"
          y="${left.y}"
          width="${left.w}"
          height="${left.h}"
          rx="${left.r}"
          fill="${palette.neutralFill}"
          stroke="${palette.neutralLine}"
          stroke-width="1"
        ></rect>
        <text
          class="story-structure-story"
          x="${left.x + 28}"
          y="${left.y + 48}"
          fill="${palette.muted}"
        >${storyText}</text>

        <text class="story-structure-label story-structure-label-accent" x="${middle.x}" y="${middle.y - 30}" fill="${palette.accent}">
          ${escapeHtml(body.middle?.label ?? "")}
        </text>
        <rect
          x="${middle.x}"
          y="${middle.y}"
          width="${middle.w}"
          height="${middle.h}"
          rx="${middle.r}"
          fill="${palette.accentTint}"
          stroke="${palette.accentLine}"
          stroke-width="3"
        ></rect>
        ${middleRows}
        <line
          x1="${middle.x + middle.w / 2}"
          y1="${middle.y + middle.h}"
          x2="${middle.x + middle.w / 2}"
          y2="${middle.y + middle.h + 18}"
          stroke="${palette.accentLine}"
          stroke-width="1.5"
          stroke-linecap="round"
        ></line>
        <text
          class="story-structure-callout"
          x="${middle.x + middle.w / 2}"
          y="${middle.y + middle.h + 48}"
          fill="${palette.accent}"
        >${escapeHtml(body.middle?.callout ?? "")}</text>

        <text class="story-structure-label" x="${right.x}" y="${right.y - 30}" fill="${palette.quiet}">
          ${escapeHtml(body.right?.label ?? "")}
        </text>
        <rect
          x="${right.x}"
          y="${right.y}"
          width="${right.w}"
          height="${right.h}"
          rx="${right.r}"
          fill="#ffffff"
          stroke="${palette.neutralLine}"
          stroke-width="1.5"
        ></rect>
        ${rightSections}
      </svg>
    </section>
  `;
};

const renderStoryToStructureMembrane = (body) => {
  const accent = body.middle?.accentColor || "#4a89c8";
  const accentTint = body.middle?.accentTint || "#eef4fb";
  const palette = {
    text: "#1f2937",
    muted: "#657180",
    quiet: "#8a949d",
    neutralFill: "#f6f7f8",
    neutralLine: "#dee4e8",
    accent,
    accentSoft: accentTint,
    accentLine: "#7ea1c6",
    stream1: "#f2f6fb",
    stream2: "#eef3f9",
    stream3: "#f4f7fb",
  };

  const left = { x: 188, y: 304, w: 344, h: 208, r: 28 };
  const middle = { x: 588, y: 286, w: 400, h: 232, r: 32 };
  const right = { x: 1048, y: 292, w: 314, h: 236, r: 18 };
  const storyLines = wrapText(body.left?.storyText, 31);
  const storyText = storyLines
    .map(
      (line, index) =>
        `<tspan x="${left.x + 30}" dy="${index === 0 ? 0 : 28}">${escapeHtml(line)}</tspan>`
    )
    .join("");
  const leftSweeps = (body.left?.highlightSweeps ?? [])
    .filter((sweep) => sweep.w > 0 && sweep.h > 0)
    .map(
      (sweep) => `
        <rect
          x="${left.x + sweep.x}"
          y="${left.y + sweep.y}"
          width="${sweep.w}"
          height="${sweep.h}"
          rx="${Math.min(12, sweep.h / 2)}"
          fill="${palette.accent}"
          opacity="0.10"
        ></rect>
      `
    )
    .join("");

  const streamColors = [palette.stream1, palette.stream2, palette.stream3];
  const streamNodes = (body.middle?.streams ?? [])
    .map((stream, index) => {
      const y = middle.y + 28 + index * 62;
      const chipX = middle.x + 190;
      const items = (stream.items ?? [])
        .map((item, itemIndex) => {
          const width = Math.max(100, Math.min(150, item.length * 8.2));
          const x = chipX + itemIndex * 126;
          return `
            <rect
              x="${x}"
              y="${y + 20}"
              width="${width}"
              height="28"
              rx="14"
              fill="#ffffff"
              stroke="${palette.accentLine}"
              stroke-width="1"
            ></rect>
            <text
              class="story-membrane-chip"
              x="${x + width / 2}"
              y="${y + 38}"
              fill="${palette.text}"
            >${escapeHtml(item)}</text>
          `;
        })
        .join("");

      return `
        <g>
          <path
            d="M ${middle.x + 18} ${y + 34}
               C ${middle.x + 84} ${y + 12}, ${middle.x + 126} ${y + 58}, ${middle.x + 176} ${y + 34}
               S ${middle.x + 300} ${y + 16}, ${middle.x + 374} ${y + 34}
               L ${middle.x + 374} ${y + 54}
               C ${middle.x + 306} ${y + 74}, ${middle.x + 242} ${y + 60}, ${middle.x + 176} ${y + 72}
               S ${middle.x + 88} ${y + 72}, ${middle.x + 18} ${y + 54} Z"
            fill="${streamColors[index] ?? palette.accentSoft}"
            stroke="${palette.accentLine}"
            stroke-width="1"
            opacity="${index === 1 ? "0.92" : "0.82"}"
          ></path>
          <text
            class="story-membrane-stream-label"
            x="${middle.x + 42}"
            y="${y + 38}"
            fill="${palette.accent}"
          >${escapeHtml(stream.label)}</text>
          ${items}
        </g>
      `;
    })
    .join("");

  const rightSections = (body.right?.sections ?? [])
    .map((section, index) => {
      const sectionTop = right.y + 40 + index * 64;
      const items = (section.items ?? [])
        .map(
          (item, itemIndex) => `
            <text
              class="story-membrane-right-item"
              x="${right.x + 24}"
              y="${sectionTop + 24 + itemIndex * 22}"
              fill="${palette.text}"
            >${escapeHtml(item)}</text>
          `
        )
        .join("");

      return `
        <g>
          ${
            index > 0
              ? `<line x1="${right.x + 20}" y1="${sectionTop - 16}" x2="${right.x + right.w - 20}" y2="${sectionTop - 16}" stroke="${palette.neutralLine}" stroke-width="1"/>`
              : ""
          }
          <text
            class="story-membrane-section-title"
            x="${right.x + 24}"
            y="${sectionTop}"
            fill="${palette.muted}"
          >${escapeHtml(section.title)}</text>
          ${items}
        </g>
      `;
    })
    .join("");

  return `
    <section class="story-membrane-layout">
      <svg
        class="story-membrane-svg"
        viewBox="0 0 1600 900"
        role="img"
        aria-label="Patient story on the left, story turned into grouped structure in the middle, and decision-ready structure on the right."
      >
        <rect width="1600" height="900" fill="#ffffff"></rect>

        <text class="story-membrane-label" x="${left.x}" y="${left.y - 28}" fill="${palette.quiet}">
          ${escapeHtml(body.left?.label ?? "")}
        </text>
        <rect
          x="${left.x}"
          y="${left.y}"
          width="${left.w}"
          height="${left.h}"
          rx="${left.r}"
          fill="${palette.neutralFill}"
          stroke="${palette.neutralLine}"
          stroke-width="1"
        ></rect>
        ${leftSweeps}
        <text class="story-membrane-story" x="${left.x + 30}" y="${left.y + 44}" fill="${palette.muted}">
          ${storyText}
        </text>

        <text class="story-membrane-label story-membrane-label-accent" x="${middle.x}" y="${middle.y - 28}" fill="${palette.accent}">
          ${escapeHtml(body.middle?.label ?? "")}
        </text>
        <rect
          x="${middle.x}"
          y="${middle.y}"
          width="${middle.w}"
          height="${middle.h}"
          rx="${middle.r}"
          fill="${palette.accentSoft}"
          stroke="${palette.accentLine}"
          stroke-width="2.5"
        ></rect>
        ${streamNodes}
        <line
          x1="${middle.x + middle.w / 2}"
          y1="${middle.y + middle.h}"
          x2="${middle.x + middle.w / 2}"
          y2="${middle.y + middle.h + 18}"
          stroke="${palette.accentLine}"
          stroke-width="1.5"
          stroke-linecap="round"
        ></line>
        <text
          class="story-membrane-callout"
          x="${middle.x + middle.w / 2}"
          y="${middle.y + middle.h + 48}"
          fill="${palette.accent}"
        >${escapeHtml(body.middle?.callout ?? "")}</text>

        <text class="story-membrane-label" x="${right.x}" y="${right.y - 28}" fill="${palette.quiet}">
          ${escapeHtml(body.right?.label ?? "")}
        </text>
        <rect
          x="${right.x}"
          y="${right.y}"
          width="${right.w}"
          height="${right.h}"
          rx="${right.r}"
          fill="#ffffff"
          stroke="${palette.neutralLine}"
          stroke-width="1.25"
        ></rect>
        ${rightSections}
      </svg>
    </section>
  `;
};

const renderWorkflowStrip = (body) => {
  const handoff = body.handoff;
  const cards = body.stages
    .map((stage, index) => {
      const items = (stage.items ?? [])
        .map((item) => `<div class="workflow-stage-item">${escapeHtml(item)}</div>`)
        .join("");
      const tags = (stage.tags ?? [])
        .map((tag) => `<span class="workflow-stage-tag">${escapeHtml(tag)}</span>`)
        .join("");
      const artifactLabel = stage.artifactLabel
        ? `<div class="workflow-artifact-label">${escapeHtml(stage.artifactLabel)}</div>`
        : "";
      const roleClass = toClassSlug(stage.role || "neutral") || "neutral";

      const card = `
        <article class="workflow-stage role-${roleClass}">
          <div class="workflow-stage-head">
            <div class="workflow-stage-label">${escapeHtml(stage.label)}</div>
            <div class="workflow-stage-detail">${escapeHtml(stage.detail)}</div>
          </div>
          <div class="workflow-stage-surface">
            ${artifactLabel}
            <div class="workflow-stage-items">${items}</div>
          </div>
          <div></div>
          <div class="workflow-stage-tags">${tags}</div>
        </article>
      `;

      if (index === body.stages.length - 1) {
        return card;
      }

      const showsHandoff = handoff && handoff.afterStageIndex === index;
      const handoffItems = showsHandoff
        ? (handoff.items ?? [])
            .map(
              (item) => `<div class="workflow-handoff-item">${escapeHtml(item)}</div>`
            )
            .join("")
        : "";
      const handoffTags = showsHandoff
        ? (handoff.tags ?? [])
            .map(
              (tag) => `<span class="workflow-handoff-tag">${escapeHtml(tag)}</span>`
            )
            .join("")
        : "";
      const handoffMarkup = showsHandoff
        ? `
          <div class="workflow-handoff">
            <div class="workflow-handoff-label">${escapeHtml(handoff.label)}</div>
            <div class="workflow-handoff-items">${handoffItems}</div>
            ${
              handoffTags
                ? `<div class="workflow-handoff-tags">${handoffTags}</div>`
                : ""
            }
          </div>
        `
        : "";

      return `
        ${card}
        <div class="workflow-connector-wrap${showsHandoff ? " has-handoff" : ""}">
          <div class="workflow-connector" aria-hidden="true"></div>
          ${handoffMarkup}
        </div>
      `;
    })
    .join("");

  return `
    <section class="workflow-strip-layout">
      <div class="workflow-stage-row">${cards}</div>
      ${
        body.footerNote
          ? `<div class="workflow-strip-footer">${escapeHtml(body.footerNote)}</div>`
          : ""
      }
    </section>
  `;
};

const renderTransformationFlow = (body) => {
  const fragments = body.left.fragments
    .map((fragment) => `<div class="story-fragment">${escapeHtml(fragment)}</div>`)
    .join("");

  const sections = body.right.sections
    .map(
      (section) => `
        <div class="output-section">
          ${section.title ? `<div class="output-section-title">${escapeHtml(section.title)}</div>` : ""}
          ${join(
            section.lines.map(
              (line) => `<div class="output-line">${escapeHtml(line)}</div>`
            )
          )}
        </div>
      `
    )
    .join("");

  return `
    <section class="transform-layout">
      <div class="story-object">
        <div class="object-label">${escapeHtml(body.left.label)}</div>
        <div class="story-fragments">${fragments}</div>
      </div>
      <div class="transform-core-wrap">
        <div class="transform-core">
          ${
            body.middle.eyebrow
              ? `<div class="transform-eyebrow">${escapeHtml(body.middle.eyebrow)}</div>`
              : ""
          }
          <div class="transform-label">${escapeHtml(body.middle.label)}</div>
          ${
            body.middle.caption
              ? `<div class="transform-caption">${escapeHtml(body.middle.caption)}</div>`
              : ""
          }
        </div>
        ${
          body.middle.callout
            ? `<div class="transform-callout">${escapeHtml(body.middle.callout)}</div>`
            : ""
        }
      </div>
      <div class="output-card">
        <div class="object-label">${escapeHtml(body.right.label)}</div>
        <div class="output-sections">${sections}</div>
        ${
          body.right.note
            ? `<div class="output-note">${escapeHtml(body.right.note)}</div>`
            : ""
        }
      </div>
      <div class="transform-link transform-link-left" aria-hidden="true"></div>
      <div class="transform-link transform-link-right" aria-hidden="true"></div>
    </section>
  `;
};

const renderHistoryWedge = (body) => {
  const barSegments = body.sourceBar.segments
    .map((segment) => {
      const width = normalizeWidth(segment.width);
      let background = "linear-gradient(180deg, #eef1f5 0%, #e5e9ee 100%)";
      let color = "rgba(10, 18, 28, 0.82)";

      if (segment.role === "focus") {
        background = "linear-gradient(135deg, #5b8dc7 0%, #4477ad 100%)";
        color = "#ffffff";
      } else if (segment.role === "neutral") {
        background = "linear-gradient(180deg, #a8b1bb 0%, #97a1ac 100%)";
        color = "#ffffff";
      }

      return `
        <div style="width:${width}%;display:flex;align-items:center;justify-content:center;padding:0 20px;background:${background};color:${color};font-size:18px;font-weight:600;line-height:1.15;text-align:center;">
          ${escapeHtml(segment.label)}
        </div>
      `;
    })
    .join("");

  const reasons = body.support.reasons
    .map(
      (reason, index) => `
        <div>
          <div style="font-family:var(--font-display);font-size:${index === 0 ? "27px" : "23px"};line-height:1.06;font-weight:${index === 0 ? "700" : "650"};color:#111827;letter-spacing:-0.03em;">
            ${escapeHtml(reason.title)}
          </div>
          ${
            reason.detail
              ? `<div style="margin-top:10px;max-width:42ch;color:rgba(20, 29, 39, 0.72);font-size:16px;line-height:1.38;font-weight:500;">
            ${escapeHtml(reason.detail)}
          </div>`
              : ""
          }
        </div>
      `
    )
    .join("");

  return `
    <section style="position:absolute;inset:0;">
      <div style="position:absolute;top:76px;left:122px;width:1042px;">
        <div style="display:flex;min-height:72px;border-radius:18px;overflow:hidden;box-shadow:0 14px 30px rgba(38, 50, 66, 0.08);">
          ${barSegments}
        </div>
      </div>

      <div style="position:absolute;left:164px;top:196px;display:flex;align-items:stretch;border-radius:24px;overflow:hidden;box-shadow:0 14px 26px rgba(31, 43, 58, 0.08);">
        <div style="width:352px;padding:30px 30px 26px;background:linear-gradient(135deg, #5b8dc7 0%, #4477ad 100%);display:flex;align-items:center;">
          <div style="font-family:var(--font-display);font-size:31px;line-height:1.02;font-weight:700;color:#ffffff;letter-spacing:-0.04em;">
            ${escapeHtml(body.hero.label)}
          </div>
        </div>
        <div style="width:658px;padding:20px 24px 18px;border:1px solid rgba(12, 20, 30, 0.06);border-left:none;background:linear-gradient(180deg, rgba(250, 251, 252, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);display:grid;gap:12px;">
          ${
            body.support.heading
              ? `<div style="font-family:var(--font-display);font-size:25px;line-height:1.04;font-weight:700;color:#0e1116;letter-spacing:-0.03em;">
            ${escapeHtml(body.support.heading)}
          </div>`
              : ""
          }
          ${reasons}
        </div>
      </div>
    </section>
  `;
};

const renderArtifactWithCallouts = (body) => {
  const sections = body.artifact.sections
    .map(
      (section) => `
        <div class="artifact-section">
          ${
            section.title
              ? `<div class="artifact-section-title">${escapeHtml(section.title)}</div>`
              : ""
          }
          ${join(
            section.rows.map(
              (row) => `<div class="artifact-row">${escapeHtml(row)}</div>`
            )
          )}
        </div>
      `
    )
    .join("");

  const callouts = body.callouts
    .map(
      (callout) => `
        <aside class="artifact-callout anchor-${escapeHtml(callout.anchorRegion)}">
          <div class="artifact-callout-label">${escapeHtml(callout.label)}</div>
          <div class="artifact-callout-detail">${escapeHtml(callout.detail)}</div>
        </aside>
      `
    )
    .join("");

  return `
    <section class="artifact-layout">
      <div class="artifact-card">
        <div class="artifact-label">${escapeHtml(body.artifact.label)}</div>
        <div class="artifact-sections">${sections}</div>
      </div>
      ${callouts}
    </section>
  `;
};

const renderHeroMetric = (body) => {
  const assumptions = body.hero.assumptions
    .map((item) => `<span class="assumption-chip">${escapeHtml(item)}</span>`)
    .join("");

  const scenarios = body.scenarios
    .map(
      (scenario) => `
        <article class="scenario-tile">
          <div class="scenario-label">${escapeHtml(scenario.label)}</div>
          <div class="scenario-metric">${escapeHtml(scenario.metric)}</div>
          <div class="scenario-detail">${escapeHtml(scenario.detail)}</div>
        </article>
      `
    )
    .join("");

  return `
    <section class="hero-metric-layout">
      <article class="hero-block">
        <div class="hero-label">${escapeHtml(body.hero.label)}</div>
        <div class="hero-assumptions">${assumptions}</div>
        <div class="hero-primary-metric">${escapeHtml(body.hero.primaryMetric)}</div>
        <div class="hero-secondary-line">${escapeHtml(body.hero.secondaryLine)}</div>
      </article>
      <div class="scenario-stack">${scenarios}</div>
      <div class="hero-bottom-line">${escapeHtml(body.bottomLine)}</div>
    </section>
  `;
};

export const renderFigureBody = (spec) => {
  const family = spec.meta.family;

  if (family === "proof_tiles") {
    return renderProofTiles(spec);
  }
  if (family === "trend_breakout_banner") {
    return renderTrendBreakoutBanner(spec.body);
  }
  if (family === "segmented_focus_bar") {
    return renderSegmentedFocusBar(spec.body);
  }
  if (family === "compound_ribbon_day_view") {
    return renderCompoundRibbonDayView(spec.body);
  }
  if (family === "compound_ribbon_before_after") {
    return renderCompoundRibbonBeforeAfter(spec.body);
  }
  if (family === "history_wedge") {
    return renderHistoryWedge(spec.body);
  }
  if (family === "story_to_structure_triptych") {
    return renderStoryToStructureTriptych(spec.body);
  }
  if (family === "story_to_structure_membrane") {
    return renderStoryToStructureMembrane(spec.body);
  }
  if (family === "workflow_strip") {
    return renderWorkflowStrip(spec.body);
  }
  if (family === "transformation_flow") {
    return renderTransformationFlow(spec.body);
  }
  if (family === "artifact_with_zoom_callouts") {
    return renderArtifactWithCallouts(spec.body);
  }
  if (family === "hero_metric_with_scenarios") {
    return renderHeroMetric(spec.body);
  }

  throw new Error(`Unsupported figure family: ${family}`);
};
