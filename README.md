🤗 [HuggingFace](https://huggingface.co/Adahm) | <img src="https://avatars.githubusercontent.com/u/117393426?s=60&v=4" alt="CivitAI logo" width="20" height="20" align="middle"> [CivitAI](https://civitai.com/user/Adahm)


# ComfyUI-Adahm-Nodes

A ComfyUI custom-node pack containing Adahm utility nodes and frontend helpers.

## What's included (Node List)

### Adahm Clear Previews on Start

---

Clears generated image previews when a workflow execution starts. The node
keeps the existing workflow-compatible behavior and exposes an enabled/
disabled switch.

<img src="docs/images/node-previews-node.png" alt="Resolution Selector example" width="30%">

* When __enabled__ - image previews are cleared at the beginning of execution of the workflow<br>
* When __disabled__ - standard ComfyUI behavior, previews stay until execution is finished, then updated with new image

*I use it in my workflow where I have multiple image preview windows stacked
next to each other while testing different samplers or small prompt changes.
Every time I generate a new seed or run the workflow, the previous previews
are cleared before the new images are generated.*

### Adahm Resolution Selector

---

Selects a nominal aspect ratio, megapixel target, and divisibility multiple.
It returns `width` and `height` as `INT`, plus `aspect_ratio` as the selected
nominal ratio string, such as `2:3`. The nominal ratio is preserved as an
explicit graph value rather than inferred from rounded dimensions.


*This is modified standard ComfyUI "Image Resolution" node. This was made for `Qwen Image 2.1` model T2I workflows in mind, where it is recommended to add `aspect ratio` to the `prompt`. With this node workflow is simplified, string value pulled directly from Image Resolution Node.*

Example:

<img src="docs/images/node-resolution-example.png" alt="Resolution Selector example" width="80%">

### Node badges

---

The frontend extension adds the ComfyUI setting:

`Adahm → Node Badge → Show Node Badges`

Available modes are:

- `All Off` — hide ID, lifecycle, and source badges;
- `On selection` — show those badges on selected nodes;
- `All On` — show those badges on all nodes.

The extension does not modify ComfyUI core files. It uses the installed
frontend badge behavior where available and supplies compatibility fallbacks
for frontend-only node renderers.

- On Selection:
<img src="docs/images/node-badges-on-selection.png" alt="Node badges on selection" width="50%">

- All ON
<img src="docs/images/node-badges-all-on.png" alt="All ON node badges" width="50%">

- All OFF
<img src="docs/images/node-badges-all-off.png" alt="All OFF node badges" width="50%">

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

## Contributing and releases

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development expectations and
[`RELEASE.md`](RELEASE.md) for the maintainer release checklist.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
