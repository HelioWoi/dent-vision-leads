# Prompt Export — AI Analysis Prompts Used in Project

This folder contains the exact source files that define or build AI prompts used for vehicle analysis flows.

## Root prompt files

- `constants.ts`
  - `DEFAULT_DENTVISION_SYSTEM_PROMPT`
  - `HAIL_DAMAGE_SYSTEM_PROMPT`
  - `LIVE_SCAN_SYSTEM_PROMPT`
  - `DEFAULT_DENTVISION_USER_PROMPT_TEMPLATE`
  - `HAIL_DAMAGE_USER_PROMPT_TEMPLATE`
  - `LIVE_SCAN_USER_PROMPT_TEMPLATE`

- `constants-v1-visual-spec.ts`
  - `V1_VISUAL_CLASSIFICATION_SPEC` (Category 1–7 visual sizing rules)

## Edge function prompt files

Inside `supabase-functions/`:

- `analyze-dents-secure.index.ts`
  - Dynamic `systemPrompt` + hail prepend + `userPrompt`
- `analyze-live-scan.index.ts`
  - Live scan frame analysis prompt
- `identify-panels.index.ts`
  - Panel identification prompt
- `verify-car-image.index.ts`
  - Vehicle presence verification prompt
- `get-car-mask.index.ts`
  - Vehicle polygon mask prompt
- `analyze-image-quality.index.ts`
  - Technical photo-quality prompt

## Notes

- These are copied snapshots from the current project state.
- Main car dent analysis currently runs through `analyze-dents-secure`.
- Prompt values can also be overridden by DB config (`admin_configs.systemPrompt` / `userPromptTemplate`).
