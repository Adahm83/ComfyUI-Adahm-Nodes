# Third-party notices

ComfyUI-Adahm-Nodes is distributed as a combined pack under GPL-3.0-only.
Copyright (c) 2026 Adahm83 applies to the Adahm contributions, not to upstream
authors' original code. Original third-party portions retain their applicable
copyright and license notices.

## ComfyUI-KJNodes — Kijai and contributors

Original repository: https://github.com/kijai/ComfyUI-KJNodes
Original license: GNU General Public License, version 3:
https://github.com/kijai/ComfyUI-KJNodes/blob/main/LICENSE

Affected files: `text_nodes.py`, `web/text_inputs.js`, and `web/text_nodes.js`.

The Adahm text nodes adapt the Join String Multi and Something To String nodes
and their dynamic-input behavior. The Adahm version makes every string socket
optional, skips missing or empty strings, removes the list-output option, and
adds workflow/API socket restoration. The converter retains the original
primitive/list conversion and unsupported-object passthrough behavior.
Normal caching was already present in the original converter.

These adaptations and their integration are distributed under GPL-3.0-only.
The complete GPL v3 text is included in `LICENSE`. Adahm modifications and
licensing notices were added on 2026-10-03; this does not imply that the original
authors endorse this pack.

## rgthree-comfy — Regis Gaughan, III (rgthree)

Original repository: https://github.com/rgthree/rgthree-comfy
Original license: MIT:
https://github.com/rgthree/rgthree-comfy/blob/main/LICENSE

Affected files: `lora_folder_loader.py` and `web/ausboss_lora_compat.js`.

The loader follows the Power LoRA Loader's serialized row format and flexible
optional-input approach, with an Adahm folder-population interface, stack text,
and local information popup. The rgthree-derived portions retain their MIT
notice below; the combined Adahm pack is distributed under GPL-3.0-only.

rgthree's AnyType helper also credits **pythongosssss**. That attribution is
retained for the shared any-type compatibility approach:
https://github.com/pythongosssss/ComfyUI-Custom-Scripts
(upstream license: MIT). A shared interface or short compatibility idiom is
not, by itself, a claim that an entire upstream implementation was copied.

### Retained rgthree MIT notice

```text
MIT License

Copyright (c) 2023 Regis Gaughan, III (rgthree)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ComfyUI — ComfyUI / Comfy-Org contributors

Original repository: https://github.com/Comfy-Org/ComfyUI
Original license: GPL v3:
https://github.com/Comfy-Org/ComfyUI/blob/master/LICENSE

ComfyUI provides the runtime and frontend APIs used by this pack. The
resolution selector follows the standard selector's purpose and adds a nominal
aspect-ratio STRING output. The Adahm file uses its own calculation and node
schema; it does not bundle or subclass the native selector implementation.
ComfyUI core files are not included or modified by this pack.

## k-diffusion — Katherine Crowson (crowsonkb)

Original repository: https://github.com/crowsonkb/k-diffusion
Original license: MIT:
https://github.com/crowsonkb/k-diffusion/blob/master/LICENSE

`legacy_dpmpp_sde.py` calls the sampling implementation supplied by ComfyUI.
It does not bundle the upstream DPM++ SDE implementation. The upstream project
retains its own copyright and license; its notices must be preserved if its
source is bundled in a future release.

## AUTOMATIC1111 — compatibility reference

Original repository: https://github.com/AUTOMATIC1111/stable-diffusion-webui
Original license: AGPL v3:
https://github.com/AUTOMATIC1111/stable-diffusion-webui/blob/master/LICENSE.txt

AUTOMATIC1111's legacy sampling behavior is the compatibility reference for
`legacy_dpmpp_sde.py`. No AUTOMATIC1111 source files are bundled or imported.
This credit is not an assertion that AGPL-licensed source has been relicensed
to GPL. If such source is incorporated later, its own obligations must be
reviewed before distribution.

## Earlier releases

This licensing change applies to the current combined pack and future
distribution of this version. It does not withdraw MIT permissions already
granted for previously published MIT versions.
