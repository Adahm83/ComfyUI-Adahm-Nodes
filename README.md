# ComfyUI-Adahm-Nodes

A ComfyUI custom-node pack containing Adahm utility nodes and frontend helpers.

## Features

### Adahm Clear Previews on Start

Clears generated image previews when a workflow execution starts. The node
keeps the existing workflow-compatible behavior and exposes an enabled/
disabled switch.

### Adahm Resolution Selector

Selects a nominal aspect ratio, megapixel target, and divisibility multiple.
It returns `width` and `height` as `INT`, plus `aspect_ratio` as the selected
nominal ratio string, such as `2:3`. The nominal ratio is preserved as an
explicit graph value rather than inferred from rounded dimensions.

### Node badges

The frontend extension adds the ComfyUI setting:

`Adahm → Node Badge → Show Node Badges`

Available modes are:

- `All Off` — hide ID, lifecycle, and source badges;
- `On selection` — show those badges on selected nodes;
- `All On` — show those badges on all nodes.

The extension does not modify ComfyUI core files. It uses the installed
frontend badge behavior where available and supplies compatibility fallbacks
for frontend-only node renderers.

![Node badges on selection](docs/images/node-badges-on-selection.svg)

![All node badges](docs/images/node-badges-all-on.svg)

## Installation

1. Open the ComfyUI `custom_nodes` directory.
2. Copy or clone this repository as `ComfyUI-Adahm-Nodes`.
3. Restart ComfyUI.
4. Refresh the browser page.

The pack requires a ComfyUI version with the current custom-node and frontend
extension APIs. Compatibility is tested against the maintainer's installed
ComfyUI environment; live browser and GPU checks are reported separately.

## Development tests

From the repository directory, use the embedded ComfyUI interpreter required
by this project:

```powershell
& 'G:\ComfyUI_windows_portable\python_embeded\python.exe' -B -m unittest discover -s tests -v
node --test tests/node_id_badge_logic.test.mjs
node --check web/node_id_badges.js
```

The Python tests do not require a running ComfyUI server or GPU. Frontend
behavior should also be checked in a live browser after restarting or
refreshing ComfyUI.

## Documentation and screenshots

Project documentation is kept in the repository so users can install and
understand the pack without access to the development workspace. Screenshot
placeholders live under [`docs/images`](docs/images/).

## Contributing and releases

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development expectations and
[`RELEASE.md`](RELEASE.md) for the maintainer release checklist.

## License

The license will be selected before the first public release.
