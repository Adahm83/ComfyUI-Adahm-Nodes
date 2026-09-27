# Contributing

Thank you for helping improve ComfyUI-Adahm-Nodes.

## Before changing code

- Read the repository `AGENTS.md` and the workspace instructions.
- Inspect the current node implementation before changing an existing node.
- Preserve workflow compatibility unless the change explicitly requires a
  behavior change.
- Do not modify ComfyUI core files or commit local machine paths, credentials,
  model files, generated archives, or personal screenshots.

## Verification

Use the embedded ComfyUI Python interpreter required by this project:

```powershell
& 'G:\ComfyUI_windows_portable\python_embeded\python.exe' -B -m unittest discover -s tests -v
node --test tests/node_id_badge_logic.test.mjs
node --check web/node_id_badges.js
```

Report live ComfyUI, browser, and GPU checks separately from automated tests.

## Pull requests

Describe the user-visible behavior, compatibility considerations, tests run,
and any checks that could not be run. Include screenshots for frontend or
canvas changes when practical.
