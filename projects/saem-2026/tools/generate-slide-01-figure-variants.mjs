#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { captureHtmlScreenshot } from "../../../scripts/utils/html-screenshot-lib.mjs";
import { touchProjectManifestRefreshToken } from "../../../lib/repo/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const projectRoot = resolve(repoRoot, "projects/saem-2026");
const deckSpecPath = resolve(projectRoot, "deck-spec.json");
const variantsRoot = resolve(projectRoot, "slide-figures/slide-01/variants");
const shellImageRelativePath =
  "../../../../templates/saem-annual-meeting-template-v1/template.png";

const slideSpecText = `# Slide 1 - Microlearning for Emergency Medicine

## Status

- current deck numbering: slide 1
- legacy source mapping: same as current
- decision state: OPEN

## Why this slide exists

- establish seriousness
- frame the talk as rigorous rather than trendy
- make the audience trust the deck before the argument begins

## Locked slide thesis

Microlearning belongs in emergency medicine because the environment rewards
learning formats that respect time pressure and interruption.

## Slide purpose brief

- top claim:
  this is a serious educational argument, not a lightweight med-ed fad talk
- support claim:
  the deck should open with confidence and restraint
- non-goals:
  - do not explain the whole concept here
  - do not show a workflow yet

## Figure job

- set the emotional and aesthetic tone
- imply clarity under pressure
- avoid generic medical conference opener cliches
- keep the title, subtitle, and SAEM shell stable
- generate five figure-only alternatives for right-side exploration

## Locked copy

- header:
  \`Microlearning for Emergency Medicine\`
- subheader:
  \`Small learning episodes, durable clinical impact.\`
- presenter line:
  \`Rana Kabeer · Timothy J. Batchelor · Moises Gallegos\`
- institution line:
  \`Stanford Department of Emergency Medicine\`

## Visual rules

- restrained editorial hero, not a logo wall
- high hierarchy, low clutter
- avoid cheesy stock imagery
- keep the right-side visual field abstract and editorial rather than literal
- save presenter portraits for the dedicated intro slide immediately after this opener
- modern academic editorial style, not startup dashboard polish

## Immediate next refinement

- produce five title-slide figure alternatives:
  - connected rings for workflow fit, retrieval, and adaptation
  - interrupted shift timeline with a micro-window
  - stacked microlearning cards
  - signal-to-structure lattice
  - pulse-window rhythm system
- choose one winner and then refine spacing, density, and label tone
`;

const buildFigurePanel = ({ innerHtml, calloutHtml = "" }) => `
  <div style="position: relative; width: 620px; height: 470px;">
    <div style="position: absolute; inset: 30px 56px 54px 62px; border-radius: 40px; background: linear-gradient(145deg, rgba(235,241,247,0.78) 0%, rgba(248,250,252,0.98) 100%); border: 1px solid rgba(10, 25, 47, 0.08); box-shadow: 0 22px 42px rgba(15, 32, 64, 0.08);"></div>
    ${innerHtml}
    ${calloutHtml}
  </div>
`;

const buildHtml = ({ figureMarkup }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Microlearning for Emergency Medicine</title>
</head>
<body style="margin:0;padding:0;background:#FDFDFD;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;width:1920px;height:1080px;overflow:hidden;position:relative;">
  <img class="shell" src="${shellImageRelativePath}" alt="" aria-hidden="true" style="position:absolute;top:0;left:0;width:1920px;height:1080px;z-index:1;" />
  <div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;">
    <div style="display:flex;width:100%;height:830px;padding:0 150px;box-sizing:border-box;align-items:center;">
      <div style="flex:1.08;padding-right:72px;margin-top:-44px;">
        <p style="margin:0 0 18px 0;font-size:22px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#5B6B7D;">
          SAEM 2026 Annual Meeting
        </p>
        <h1 style="font-size:84px;font-weight:700;color:#0A192F;margin:0 0 28px 0;line-height:1.03;letter-spacing:-1.6px;">
          Microlearning for<br/>Emergency Medicine
        </h1>
        <div style="width:92px;height:6px;background-color:#C8102E;margin-bottom:34px;border-radius:3px;"></div>
        <h2 style="font-size:40px;font-weight:320;color:#4A5D73;margin:0 0 42px 0;line-height:1.36;letter-spacing:-0.5px;">
          Small learning episodes,<br/>durable clinical impact.
        </h2>
        <div style="max-width:860px;padding:24px 28px;border-radius:28px;border:1px solid rgba(10, 25, 47, 0.09);background:linear-gradient(180deg, rgba(255,255,255,0.90) 0%, rgba(246,249,252,0.92) 100%);box-shadow:0 18px 36px rgba(15, 32, 64, 0.07);">
          <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6C7A8C;">
            Presented By
          </p>
          <p style="margin:0;font-size:28px;font-weight:600;line-height:1.45;color:#13263F;">
            Rana Kabeer
            <span style="color:#8B98A8;">&nbsp;·&nbsp;</span>
            Timothy J. Batchelor
            <span style="color:#8B98A8;">&nbsp;·&nbsp;</span>
            Moises Gallegos
          </p>
          <p style="margin:12px 0 0 0;font-size:22px;font-weight:400;color:#5B6B7D;">
            Stanford Department of Emergency Medicine
          </p>
        </div>
      </div>
      <div style="flex:0.92;display:flex;justify-content:flex-end;align-items:center;margin-top:-26px;">
        ${figureMarkup}
      </div>
    </div>
  </div>
</body>
</html>
`;

const ringsFigure = () =>
  buildFigurePanel({
    innerHtml: `
      <svg width="620" height="470" viewBox="0 0 620 470" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;">
        <circle cx="202" cy="156" r="88" fill="rgba(255,255,255,0.72)" stroke="#0E4F8A" stroke-width="6" />
        <circle cx="390" cy="126" r="64" fill="rgba(255,255,255,0.86)" stroke="#F29AAA" stroke-width="5" />
        <circle cx="414" cy="302" r="86" fill="rgba(255,255,255,0.78)" stroke="#CBD5E1" stroke-width="4" />
        <circle cx="202" cy="156" r="56" fill="rgba(0,90,156,0.08)" />
        <circle cx="390" cy="126" r="36" fill="rgba(200,16,46,0.08)" />
        <circle cx="414" cy="302" r="44" fill="rgba(10,25,47,0.06)" />
        <path d="M208 158 C264 146 318 138 356 128" stroke="#B7C5D6" stroke-width="2.5" stroke-dasharray="5 7" />
        <path d="M248 206 C302 238 352 268 402 304" stroke="#B7C5D6" stroke-width="2.5" stroke-dasharray="5 7" />
        <path d="M390 190 C398 224 404 254 412 284" stroke="#D86C7F" stroke-width="2.5" stroke-dasharray="4 8" />
        <circle cx="202" cy="156" r="10" fill="#005A9C" />
        <circle cx="390" cy="126" r="9" fill="#C8102E" />
        <circle cx="414" cy="302" r="11" fill="#0A192F" />
      </svg>
      <div style="position:absolute;left:106px;top:88px;padding:12px 18px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);font-size:18px;font-weight:700;color:#0E2544;">Workflow Fit</div>
      <div style="position:absolute;left:356px;top:76px;padding:12px 18px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);font-size:18px;font-weight:700;color:#A31F34;">Retrieval</div>
      <div style="position:absolute;left:320px;top:346px;padding:12px 18px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);font-size:18px;font-weight:700;color:#243B53;">Adaptation</div>
    `,
    calloutHtml: `
      <div style="position:absolute;left:138px;top:332px;width:366px;padding:24px 26px;border-radius:28px;background:rgba(255,255,255,0.88);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);">
        <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6B7A8C;">Opening frame</p>
        <p style="margin:0;font-size:23px;font-weight:600;line-height:1.4;color:#10233E;">A modern learning format for a clinical environment built around interruption, urgency, and just-in-time decision-making.</p>
      </div>
    `,
  });

const timelineFigure = () =>
  buildFigurePanel({
    innerHtml: `
      <svg width="620" height="470" viewBox="0 0 620 470" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;">
        <line x1="92" y1="302" x2="552" y2="302" stroke="#C6D0DB" stroke-width="3" />
        <rect x="96" y="232" width="102" height="70" rx="16" fill="#DDE6F0" />
        <rect x="210" y="196" width="86" height="106" rx="16" fill="#CED9E6" />
        <rect x="314" y="242" width="122" height="60" rx="16" fill="#DDE6F0" />
        <rect x="448" y="214" width="100" height="88" rx="16" fill="#D4DFEA" />
        <path d="M186 302 L186 166" stroke="#C8102E" stroke-width="3" stroke-dasharray="7 8" />
        <path d="M278 302 L278 144" stroke="#C8102E" stroke-width="3" stroke-dasharray="7 8" />
        <path d="M374 302 L374 182" stroke="#C8102E" stroke-width="3" stroke-dasharray="7 8" />
        <path d="M490 302 L490 140" stroke="#C8102E" stroke-width="3" stroke-dasharray="7 8" />
        <path d="M186 166 L178 180 L194 180 Z" fill="#C8102E" />
        <path d="M278 144 L270 158 L286 158 Z" fill="#C8102E" />
        <path d="M374 182 L366 196 L382 196 Z" fill="#C8102E" />
        <path d="M490 140 L482 154 L498 154 Z" fill="#C8102E" />
        <rect x="334" y="326" width="148" height="52" rx="18" fill="rgba(255,255,255,0.94)" stroke="#0E4F8A" stroke-width="2" />
        <line x1="408" y1="302" x2="408" y2="326" stroke="#0E4F8A" stroke-width="2" />
        <circle cx="408" cy="302" r="5" fill="#0E4F8A" />
        <text x="408" y="357" text-anchor="middle" fill="#0E4F8A" font-size="19" font-weight="700" font-family="Arial, sans-serif">Micro-window</text>
        <text x="408" y="379" text-anchor="middle" fill="#0E4F8A" font-size="16" font-weight="600" font-family="Arial, sans-serif">3 minutes</text>
      </svg>
      <div style="position:absolute;left:88px;top:110px;padding:10px 14px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#BE123C;">Interruptions</div>
      <div style="position:absolute;left:238px;top:92px;padding:10px 14px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#10233E;">Shift rhythm</div>
    `,
    calloutHtml: `
      <div style="position:absolute;left:118px;top:342px;width:214px;padding:18px 20px;border-radius:24px;background:rgba(255,255,255,0.88);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);">
        <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#6B7A8C;">Claim</p>
        <p style="margin:0;font-size:20px;font-weight:600;line-height:1.35;color:#10233E;">Learning has to fit the shift, not interrupt it.</p>
      </div>
    `,
  });

const cardsFigure = () =>
  buildFigurePanel({
    innerHtml: `
      <div style="position:absolute;left:122px;top:92px;width:338px;height:256px;border-radius:34px;background:linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(245,248,251,0.96) 100%);border:1px solid rgba(10,25,47,0.08);box-shadow:0 22px 40px rgba(15,32,64,0.10);"></div>
      <div style="position:absolute;left:160px;top:132px;width:282px;height:62px;border-radius:20px;background:#F5F8FB;border:1px solid rgba(10,25,47,0.08);display:flex;align-items:center;padding:0 18px;box-sizing:border-box;">
        <div style="width:14px;height:14px;border-radius:50%;background:#0E4F8A;margin-right:14px;"></div>
        <div style="font-size:22px;font-weight:700;color:#10233E;">Clinical trigger</div>
      </div>
      <div style="position:absolute;left:160px;top:210px;width:282px;height:62px;border-radius:20px;background:#F5F8FB;border:1px solid rgba(10,25,47,0.08);display:flex;align-items:center;padding:0 18px;box-sizing:border-box;">
        <div style="width:14px;height:14px;border-radius:50%;background:#C8102E;margin-right:14px;"></div>
        <div style="font-size:22px;font-weight:700;color:#10233E;">90-second pearl</div>
      </div>
      <div style="position:absolute;left:160px;top:288px;width:282px;height:62px;border-radius:20px;background:#F5F8FB;border:1px solid rgba(10,25,47,0.08);display:flex;align-items:center;padding:0 18px;box-sizing:border-box;">
        <div style="width:14px;height:14px;border-radius:50%;background:#0A192F;margin-right:14px;"></div>
        <div style="font-size:22px;font-weight:700;color:#10233E;">Retrieval ping</div>
      </div>
      <svg width="620" height="470" viewBox="0 0 620 470" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;">
        <path d="M474 126 C526 152 538 218 504 256 C472 292 412 298 384 262" stroke="#B8C4D5" stroke-width="3" stroke-dasharray="6 7" />
        <path d="M474 126 C510 92 540 100 556 126" stroke="#0E4F8A" stroke-width="3" />
        <circle cx="474" cy="126" r="10" fill="#0E4F8A" />
        <circle cx="508" cy="188" r="10" fill="#C8102E" />
        <circle cx="484" cy="252" r="10" fill="#0A192F" />
        <circle cx="420" cy="280" r="10" fill="#0E4F8A" opacity="0.8" />
      </svg>
      <div style="position:absolute;left:434px;top:80px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#0E4F8A;">Loop</div>
    `,
    calloutHtml: `
      <div style="position:absolute;left:352px;top:314px;width:202px;padding:18px 20px;border-radius:24px;background:rgba(255,255,255,0.90);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);">
        <p style="margin:0;font-size:20px;font-weight:600;line-height:1.35;color:#10233E;">Small episodes can still produce durable repetition.</p>
      </div>
    `,
  });

const latticeFigure = () =>
  buildFigurePanel({
    innerHtml: `
      <svg width="620" height="470" viewBox="0 0 620 470" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;">
        <defs>
          <linearGradient id="fadeLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#D7E0EA" />
            <stop offset="100%" stop-color="#8FA7C2" />
          </linearGradient>
        </defs>
        <path d="M132 122 L232 146 L306 108 L382 152 L470 126" stroke="url(#fadeLine)" stroke-width="3" />
        <path d="M132 236 L214 196 L306 232 L392 198 L478 236" stroke="url(#fadeLine)" stroke-width="3" />
        <path d="M148 330 L232 290 L314 328 L404 292 L494 324" stroke="url(#fadeLine)" stroke-width="3" />
        <path d="M132 122 L132 236 L148 330" stroke="#D7E0EA" stroke-width="3" />
        <path d="M232 146 L214 196 L232 290" stroke="#C8D4E1" stroke-width="3" />
        <path d="M306 108 L306 232 L314 328" stroke="#B8C7D8" stroke-width="3" />
        <path d="M382 152 L392 198 L404 292" stroke="#A6B9CD" stroke-width="3" />
        <path d="M470 126 L478 236 L494 324" stroke="#93A8C0" stroke-width="3" />
        <circle cx="132" cy="122" r="11" fill="#DBE5EF" />
        <circle cx="232" cy="146" r="11" fill="#C9D6E4" />
        <circle cx="306" cy="108" r="13" fill="#0E4F8A" />
        <circle cx="382" cy="152" r="11" fill="#E9B1BD" />
        <circle cx="470" cy="126" r="11" fill="#D8E2EC" />
        <circle cx="132" cy="236" r="11" fill="#E3EBF3" />
        <circle cx="214" cy="196" r="11" fill="#D4E0EA" />
        <circle cx="306" cy="232" r="13" fill="#0A192F" />
        <circle cx="392" cy="198" r="11" fill="#E9B1BD" />
        <circle cx="478" cy="236" r="11" fill="#D0DCE8" />
        <circle cx="148" cy="330" r="11" fill="#E7EEF4" />
        <circle cx="232" cy="290" r="11" fill="#D8E2EC" />
        <circle cx="314" cy="328" r="13" fill="#0E4F8A" />
        <circle cx="404" cy="292" r="11" fill="#E8B1BC" />
        <circle cx="494" cy="324" r="11" fill="#CEDAE7" />
      </svg>
      <div style="position:absolute;left:116px;top:82px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#6B7A8C;">Noise</div>
      <div style="position:absolute;left:268px;top:82px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#0E4F8A;">Structure</div>
      <div style="position:absolute;left:420px;top:82px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#A31F34;">Use</div>
    `,
    calloutHtml: `
      <div style="position:absolute;left:308px;top:346px;width:218px;padding:18px 20px;border-radius:24px;background:rgba(255,255,255,0.90);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);">
        <p style="margin:0;font-size:20px;font-weight:600;line-height:1.35;color:#10233E;">Microlearning turns diffuse exposure into usable signal.</p>
      </div>
    `,
  });

const pulseFigure = () =>
  buildFigurePanel({
    innerHtml: `
      <svg width="620" height="470" viewBox="0 0 620 470" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;">
        <line x1="100" y1="330" x2="540" y2="330" stroke="#D2DCE6" stroke-width="3" />
        <path d="M118 330 L156 330 L176 266 L198 382 L222 224 L248 330 L286 330" stroke="#0E4F8A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M300 330 L336 330 L356 284 L378 364 L398 248 L424 330 L454 330" stroke="#C8102E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M470 330 L498 330 L512 298 L526 350 L540 330" stroke="#0A192F" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="274" y="116" width="164" height="86" rx="28" fill="rgba(255,255,255,0.94)" stroke="#0E4F8A" stroke-width="2.5" />
        <text x="356" y="150" text-anchor="middle" fill="#0E4F8A" font-size="18" font-weight="700" font-family="Arial, sans-serif">3-minute pocket</text>
        <text x="356" y="178" text-anchor="middle" fill="#10233E" font-size="26" font-weight="700" font-family="Arial, sans-serif">Interruptible</text>
      </svg>
      <div style="position:absolute;left:112px;top:252px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#0E4F8A;">Workflow</div>
      <div style="position:absolute;left:308px;top:244px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#A31F34;">Retrieval</div>
      <div style="position:absolute;left:462px;top:288px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.92);border:1px solid rgba(10,25,47,0.08);font-size:16px;font-weight:700;color:#10233E;">Retention</div>
    `,
    calloutHtml: `
      <div style="position:absolute;left:118px;top:120px;width:126px;padding:16px 18px;border-radius:22px;background:rgba(255,255,255,0.90);border:1px solid rgba(10,25,47,0.08);box-shadow:0 16px 34px rgba(15,32,64,0.08);">
        <p style="margin:0;font-size:18px;font-weight:700;line-height:1.35;color:#10233E;">Rhythm, not lectures</p>
      </div>
    `,
  });

const variantDefinitions = [
  {
    id: "slide-01-figure-rings",
    label: "Slide 01 Figure Rings",
    summary: "Connected rings motif for workflow fit, retrieval, and adaptation.",
    figureMarkup: ringsFigure(),
  },
  {
    id: "slide-01-figure-timeline",
    label: "Slide 01 Figure Timeline",
    summary: "Interrupted shift timeline with a highlighted micro-window for learning.",
    figureMarkup: timelineFigure(),
  },
  {
    id: "slide-01-figure-cards",
    label: "Slide 01 Figure Cards",
    summary: "Stacked microlearning cards that frame trigger, pearl, and retrieval loop.",
    figureMarkup: cardsFigure(),
  },
  {
    id: "slide-01-figure-lattice",
    label: "Slide 01 Figure Lattice",
    summary: "Signal-to-structure lattice showing how small exposures become usable knowledge.",
    figureMarkup: latticeFigure(),
  },
  {
    id: "slide-01-figure-pulse",
    label: "Slide 01 Figure Pulse",
    summary: "Pulse-window system emphasizing short, interruptible learning rhythm.",
    figureMarkup: pulseFigure(),
  },
];

const ensureDir = async (dirPath) => {
  await mkdir(dirPath, { recursive: true });
  return dirPath;
};

const buildVariantRecord = (variant) => {
  const basePath = `projects/saem-2026/slide-figures/slide-01/variants/${variant.id}`;
  return {
    id: variant.id,
    label: variant.label,
    status: "candidate",
    summary: variant.summary,
    previewPath: `${basePath}/preview.png`,
    files: [
      {
        label: "Variant dir",
        path: basePath,
      },
      {
        label: "HTML",
        path: `${basePath}/generated.html`,
      },
      {
        label: "Preview",
        path: `${basePath}/preview.png`,
      },
    ],
  };
};

const main = async () => {
  await ensureDir(variantsRoot);

  for (const variant of variantDefinitions) {
    const variantDir = await ensureDir(resolve(variantsRoot, variant.id));
    const htmlPath = resolve(variantDir, "generated.html");
    const previewPath = resolve(variantDir, "preview.png");
    await writeFile(htmlPath, buildHtml({ figureMarkup: variant.figureMarkup }), "utf8");
    await captureHtmlScreenshot({
      inputPath: htmlPath,
      outputPath: previewPath,
      width: 1920,
      height: 1080,
      fullPage: false,
    });
  }

  const deckSpec = JSON.parse(await readFile(deckSpecPath, "utf8"));
  const slide = deckSpec.slides.find((entry) => entry.id === "slide-01");
  if (!slide) {
    throw new Error("Could not find slide-01 in deck-spec.json");
  }

  const existingVariants = Array.isArray(slide.variants) ? slide.variants : [];
  const preservedVariants = existingVariants.filter(
    (variant) => !String(variant?.id ?? "").startsWith("slide-01-figure-")
  );
  slide.variants = [
    ...preservedVariants,
    ...variantDefinitions.map((variant) => buildVariantRecord(variant)),
  ];
  slide.buildStatus = "figure variation test pass generated; choose a winning concept";
  slide.specText = slideSpecText;

  await writeFile(deckSpecPath, `${JSON.stringify(deckSpec, null, 2)}\n`, "utf8");
  await touchProjectManifestRefreshToken({ repoRoot });
};

await main();
