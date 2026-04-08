# Story Streams Gemini

## Goal

Compare Gemini image generation against Gemini HTML/SVG generation for the
same figure brief, and decide how to use Gemini inside the pitch-deck workflow.

## Current Direction

- the image model has stronger design taste out of the box
- the HTML path is more literal, but returns editable source immediately
- the best near-term workflow is likely:
  `gemini:image -> choose the composition -> gemini:html -> local refinement`

## Active Inputs

- canonical figure spec:
  `/Users/kabeer/Code/rkdesignerclone/projects/designer-health/figures/specs/slide-04-story-streams-v1.json`
- image prompt:
  `/Users/kabeer/Code/rkdesignerclone/projects/designer-health/experiments/story-streams-gemini/prompts/gemini-image.txt`
- HTML prompt:
  `/Users/kabeer/Code/rkdesignerclone/projects/designer-health/experiments/story-streams-gemini/prompts/gemini-html.txt`

## Output Dirs

- image pass:
  `/Users/kabeer/Code/rkdesignerclone/output/figures/gemini/story-streams-gemini-v2`
- HTML pass:
  `/Users/kabeer/Code/rkdesignerclone/output/figures/gemini/story-streams-html-v2`

## Promotion Target

- if the Gemini path becomes part of the normal workflow, promote the chosen
  prompt contract and wrapper conventions into `projects/figures/` docs and
  the `scripts/llm/` tooling
- if one of the HTML/SVG outputs is strong enough, fold the composition back
  into a canonical figure spec or renderer family
