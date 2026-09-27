# Repository instructions

This repository contains custom nodes and frontend extensions for ComfyUI.

## Development rules

- Read the workspace `AGENTS.md` and `ENVIRONMENT.md` before development.
- Use `G:\ComfyUI_windows_portable\python_embeded\python.exe` for every
  Python command, test, lint check, or script.
- Preserve existing node behavior and workflow compatibility unless a change
  is explicitly requested.
- Keep custom display names prefixed with `Adahm` and internal node IDs
  globally unique.
- Do not modify ComfyUI core files.
- Follow the official ComfyUI custom-node walkthrough and inspect the installed
  ComfyUI source when compatibility differs from the walkthrough.

## Public repository rules

- Never commit credentials, personal paths, model files, generated archives,
  local backups, or private screenshots.
- Keep user-facing installation and usage information in `README.md`.
- Keep contributor expectations in `CONTRIBUTING.md` and release steps in
  `RELEASE.md`.
- Use small, reviewable commits and never force-push published history without
  explicit approval.
- Before a release, run the documented tests and clearly separate automated
  verification from live ComfyUI/browser/GPU checks.
